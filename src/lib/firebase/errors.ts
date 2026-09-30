import type { AuthError } from "firebase/auth";

const friendlyErrors: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists. Try logging in instead.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/invalid-credential": "The email or password is incorrect. Please try again.",
  "auth/user-disabled": "This account is disabled. Contact support for help.",
  "auth/user-not-found": "No account was found with that email.",
  "auth/wrong-password": "The email or password is incorrect. Please try again.",
  "auth/weak-password": "Choose a stronger password with at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
  "auth/network-request-failed": "We could not connect. Check your internet connection and try again.",
  "auth/operation-not-allowed": "Email and password sign-in is not enabled for this Firebase project.",
  "auth/missing-email": "Enter your email address first.",
};

export function friendlyAuthError(error: unknown): string {
  const code = (error as Partial<AuthError>)?.code;
  return code && friendlyErrors[code]
    ? friendlyErrors[code]
    : "Something went wrong. Please try again in a moment.";
}
