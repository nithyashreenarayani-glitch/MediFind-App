# MediFind-App

MediFind is a pharmacy inventory discovery MVP concept: search for a medicine and find participating nearby pharmacies that report availability. It is an inventory platform, not a medical service. It does not diagnose, prescribe, recommend dosage, or determine whether a medicine is appropriate for an individual.

## Current implementation: Phases 1–2

The app includes the Next.js App Router, TypeScript, Tailwind CSS, a responsive landing page, optional Firebase client configuration, email/password registration and login, password reset, user profile documents, and role-guarded dashboard entry points. Search and pharmacy details are visual entry points only at this stage; there is no live inventory or reservation service yet. Do not interpret the sample pharmacy card on the landing page as live inventory.

## Stack

- Next.js App Router and React
- TypeScript
- Tailwind CSS 4
- Firebase Web SDK (Auth and Firestore clients are scaffolded)
- Lucide React icons

## Local development

1. Install Node.js 20.9 or later.
2. Copy `.env.example` to `.env.local` and fill in the web app values from Firebase Console → Project settings → Your apps. Firebase is optional for viewing the Phase 1 landing page.
3. In Firebase Console → Authentication → Sign-in method, enable Email/Password.
4. Create a Cloud Firestore database and deploy `firestore.rules` (Firebase CLI: `firebase deploy --only firestore:rules`). The project includes `firebase.json` for this rules file.
5. Run `npm install`.
6. Run `npm run dev` and open http://localhost:3000.

The client Firebase initializer is in `src/lib/firebase/client.ts`. It exports `null` services when configuration is missing, so pages can render without credentials. Auth pages are `/login`, `/register`, and `/reset-password`. Public signup may create a USER or PHARMACY profile; it cannot create an ADMIN profile. Pharmacy signup is not pharmacy approval. Admin authorization requires the trusted Firebase Auth custom claim `admin: true`; do not set it from browser code. No Admin SDK or server credential is included in this phase.

## Environment variables

See `.env.example` for the public Firebase web app configuration keys. No real credentials are included in this repository. Configure production values in the Vercel project environment settings. Do not commit `.env.local`.

## Firestore rules and indexes

`firestore.rules` allows a signed-in user to create and read only their own profile, prevents profile role changes, reserves ADMIN authority for a trusted Firebase Auth custom claim, and denies access to other collections until their feature-specific rules are implemented. Admin custom claims must be provisioned only by a trusted server environment. No composite indexes are required by the current Phase 2 queries, which use document reads only.

## Safety and inventory accuracy

Availability must be treated as pharmacy-reported and time-sensitive. A production inventory page should show when a record was last updated and ask users to confirm stock and opening hours with the pharmacy. Future search and reservation flows must not offer diagnosis, prescribing, or personalized medical guidance.

## Roadmap

- Phase 2: Firebase Authentication, role model, and Firestore types/services/security rules.
- Phase 3: medicine catalog search and pharmacy inventory discovery with demo data clearly labeled.
- Phase 4: pharmacy dashboard, inventory updates, and reservation lifecycle.
- Phase 5: user dashboard, in-app availability notifications, and admin approval tools.
- Phase 6: location-aware distance sorting, deployment setup, and end-to-end validation.

## Deployment

Deploy the repository as a Next.js project on Vercel. Set the Firebase web app environment variables in the Vercel project settings before enabling Firebase-backed features. Review Firestore security rules and access controls before connecting any non-demo data.
