const admin = require("firebase-admin");

const config = require("../config");

const REGISTRATION_FIELDS = [
  "registrationId",
  "createdAt",
  "fullName",
  "email",
  "phone",
  "organization",
  "jobTitle",
  "ticketType",
  "attendanceMode",
  "city",
  "country",
  "referralSource",
  "notes",
  "consent",
  "status",
  "emailStatus",
  "certificateFile",
];

let firebaseApp;

function firebaseIsConfigured() {
  return config.firebase.enabled;
}

function cloudSyncEnabled() {
  return config.firebase.cloudSyncEnabled;
}

function authIsConfigured() {
  return config.firebase.authEnabled;
}

function initializeFirebase() {
  if (!firebaseIsConfigured()) {
    return null;
  }

  if (!firebaseApp) {
    firebaseApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId: config.firebase.projectId,
            clientEmail: config.firebase.clientEmail,
            privateKey: config.firebase.privateKey,
          }),
          storageBucket: config.firebase.storageBucket || undefined,
        });
  }

  return firebaseApp;
}

function normalizeRegistration(registration = {}) {
  const normalized = {};

  REGISTRATION_FIELDS.forEach((field) => {
    normalized[field] = String(registration[field] || "");
  });

  normalized.registrationId = String(registration.registrationId || "");
  normalized.createdAt = String(registration.createdAt || new Date().toISOString());
  normalized.updatedAt = String(registration.updatedAt || new Date().toISOString());

  return normalized;
}

function getFirestoreCollection() {
  if (!cloudSyncEnabled()) {
    return null;
  }

  initializeFirebase();
  return admin.firestore().collection(config.firebase.registrationsCollection);
}

function getFirebaseStatus() {
  return {
    enabled: firebaseIsConfigured(),
    cloudSyncEnabled: cloudSyncEnabled(),
    authEnabled: authIsConfigured(),
    collection: config.firebase.registrationsCollection,
    storageBucket: config.firebase.storageBucket ? "configured" : "not-configured",
    adminEmailsConfigured: config.firebase.adminEmails.length > 0,
  };
}

function formatAuthError(payload) {
  const code = String(payload?.error?.message || "");
  const messageMap = {
    EMAIL_NOT_FOUND: "This Firebase Auth account does not exist.",
    INVALID_PASSWORD: "The password is incorrect.",
    USER_DISABLED: "This Firebase Auth account has been disabled.",
    INVALID_LOGIN_CREDENTIALS: "The email or password is incorrect.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Too many login attempts. Try again in a little while.",
  };

  return new Error(messageMap[code] || "Firebase login failed. Check the account and Firebase settings.");
}

function isAdminUser(decodedToken) {
  const email = String(decodedToken?.email || "").trim().toLowerCase();
  const hasCustomClaim = decodedToken?.admin === true;

  if (config.firebase.adminEmails.length === 0) {
    return hasCustomClaim;
  }

  return hasCustomClaim || config.firebase.adminEmails.includes(email);
}

async function listCloudRegistrations() {
  if (!cloudSyncEnabled()) {
    return [];
  }

  const snapshot = await getFirestoreCollection().orderBy("createdAt", "asc").get();
  return snapshot.docs.map((document) =>
    normalizeRegistration({ registrationId: document.id, ...document.data() })
  );
}

async function upsertCloudRegistration(registration) {
  if (!cloudSyncEnabled()) {
    return {
      synced: false,
      reason: "cloud-sync-disabled",
    };
  }

  const normalized = normalizeRegistration(registration);
  await getFirestoreCollection()
    .doc(normalized.registrationId)
    .set(
      {
        ...normalized,
        syncSource: "eventflow-express",
        syncedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  return {
    synced: true,
    registrationId: normalized.registrationId,
  };
}

async function syncRegistrationsSnapshot(registrations = []) {
  if (!cloudSyncEnabled()) {
    return {
      synced: false,
      count: 0,
      reason: "cloud-sync-disabled",
    };
  }

  if (registrations.length === 0) {
    return {
      synced: true,
      count: 0,
    };
  }

  initializeFirebase();
  const firestore = admin.firestore();
  const collection = firestore.collection(config.firebase.registrationsCollection);
  const chunkSize = 400;

  for (let index = 0; index < registrations.length; index += chunkSize) {
    const batch = firestore.batch();
    const slice = registrations.slice(index, index + chunkSize);

    slice.forEach((registration) => {
      const normalized = normalizeRegistration(registration);
      batch.set(
        collection.doc(normalized.registrationId),
        {
          ...normalized,
          syncSource: "eventflow-express",
          syncedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  return {
    synced: true,
    count: registrations.length,
  };
}

async function verifyAdminIdToken(idToken) {
  initializeFirebase();
  const decodedToken = await admin.auth().verifyIdToken(idToken);

  if (!isAdminUser(decodedToken)) {
    throw new Error(
      "This account is not authorized for the admin dashboard. Add the email to FIREBASE_ADMIN_EMAILS or assign the admin custom claim."
    );
  }

  return decodedToken;
}

async function signInAdminWithPassword(email, password) {
  if (!authIsConfigured()) {
    throw new Error("Firebase admin authentication is not configured.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebase.webApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: String(email || "").trim(),
        password: String(password || ""),
        returnSecureToken: true,
      }),
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw formatAuthError(payload);
  }

  const decodedToken = await verifyAdminIdToken(payload.idToken);
  return {
    idToken: payload.idToken,
    email: decodedToken.email || payload.email,
    uid: decodedToken.uid,
  };
}

async function createAdminSessionCookie(idToken) {
  initializeFirebase();
  return admin.auth().createSessionCookie(idToken, {
    expiresIn: config.firebase.sessionDurationMs,
  });
}

async function verifyAdminSessionCookie(sessionCookie) {
  initializeFirebase();
  const decodedToken = await admin.auth().verifySessionCookie(sessionCookie, true);

  if (!isAdminUser(decodedToken)) {
    throw new Error("The Firebase session is not authorized for admin access.");
  }

  return decodedToken;
}

module.exports = {
  authIsConfigured,
  cloudSyncEnabled,
  createAdminSessionCookie,
  firebaseIsConfigured,
  getFirebaseStatus,
  listCloudRegistrations,
  signInAdminWithPassword,
  syncRegistrationsSnapshot,
  upsertCloudRegistration,
  verifyAdminSessionCookie,
};
