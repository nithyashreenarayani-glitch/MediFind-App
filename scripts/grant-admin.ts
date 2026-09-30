import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const email = process.argv[2]?.trim().toLowerCase();
if (!projectId || !email) {
  console.error("Usage: set GOOGLE_CLOUD_PROJECT=<project-id> and run npm run grant:admin -- <email>");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
await getFirestore().collection("users").doc(user.uid).set({
  uid: user.uid,
  name: user.displayName || email.split("@")[0],
  email,
  phone: user.phoneNumber || "",
  role: "ADMIN",
  isDisabled: false,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
console.log(`Granted MediFind admin access to ${email}. The account must sign in again to refresh its custom claim.`);
