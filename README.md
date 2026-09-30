# MediFind-App

MediFind helps people find participating nearby pharmacies that report a requested medicine in stock. Users can search by name, brand, or generic name, compare pharmacy-reported availability, request a reservation, and follow updates. Pharmacy teams manage their profile and inventory; admins approve listings and monitor activity.

MediFind is an inventory discovery platform. It does not diagnose, prescribe, recommend dosage, or decide whether a medicine is suitable for an individual. Stock and hours are pharmacy-reported and can change; users should confirm directly with a licensed pharmacist before travelling.

## Features

- Email/password and Google sign-in with Firebase Authentication, user profiles, password reset, role-aware pages, and account sign-out.
- Medicine search with debounce, case-insensitive partial matching across name, brand, generic name, strength, and form.
- Nearby pharmacy results with reported quantity and update time, open-hours indicator, area/name search, availability/low-stock/open filters, distance sorting/range when the user chooses to share browser location, and directions links.
- Pharmacy profile creation and approval status, logo upload to Firebase Storage, medicine catalog, inventory management, stock thresholds, and inventory activity summaries.
- Atomic reservations through callable Cloud Functions. Requests hold stock, enforce quantity limits, follow valid status transitions, and release stock on rejection, cancellation, or expiry.
- In-app user and pharmacy notifications, mark-as-read, and back-in-stock subscriptions.
- Admin overview, pharmacy approval/rejection, account disable/enable, catalog and inventory monitoring, reservations, and activity log entries.
- Clearly labelled demo dataset; every seeded sample record has `isDemo: true` and sample pharmacy names.

## Technology and layout

- Next.js App Router, React, TypeScript, Tailwind CSS 4, Lucide React.
- Firebase Authentication, Cloud Firestore, Cloud Storage, and Cloud Functions (Node.js 22).
- Zod and React Hook Form for pharmacy/catalog/inventory forms.
- Google Maps directions links and a lightweight map fallback; no maps API key is required.

The Next.js web client lives in `src/`. Firebase web configuration is in `src/lib/firebase/client.ts`. Firestore query/write helpers are in `src/lib/firebase/firestore.ts`. Trusted reservation, account-disable, scheduled expiry, pharmacy-approval sync, and restock notification logic is in `functions/src/index.ts`.

## Local setup

1. Install Node.js 22 or later and the Firebase CLI.
2. Copy `.env.example` to `.env.local`. Enter the Firebase Web App config values in the `NEXT_PUBLIC_FIREBASE_*` variables. Do not commit `.env.local`.
3. In Firebase Console, enable Email/Password and Google sign-in under Authentication → Sign-in method. Add `localhost` and your Vercel domain to Authentication → Settings → Authorized domains.
4. Create the Cloud Firestore database and Cloud Storage bucket for the Firebase project.
5. Install web dependencies with `npm install` and Cloud Functions dependencies with `npm --prefix functions install`.
6. Start the web app with `npm run dev` and open http://localhost:3000.

The Firebase web API key and project identifiers are browser configuration, not Admin credentials. Never put service-account JSON, private keys, or Firebase Admin credentials in `NEXT_PUBLIC_*` values or source files.

## Firebase deployment

Select the Firebase project (`firebase use --add`), then deploy its rules, indexes, and Cloud Functions:

```sh
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

Cloud Functions deployment and scheduled reservation expiry require a Firebase project on the Blaze billing plan. Functions use the `us-central1` region. The scheduled expiry job runs every 15 minutes. Reservation operations run in server-side Firestore transactions, so web clients cannot create or change reservation records directly.

Google sign-in uses Firebase's JavaScript `GoogleAuthProvider` with popup sign-in. Google sign-in must be enabled in the Firebase project and each development/production hostname must be in Firebase Authentication's authorized domains. See Firebase's [Google sign-in guide](https://firebase.google.com/docs/auth/web/google-signin).

## Firestore collections

| Collection | Purpose |
| --- | --- |
| `users/{uid}` | Private profile, role, account enabled state |
| `pharmacies/{pharmacyId}` | Owner, public contact/location, opening hours, approval state, logo URL |
| `medicines/{medicineId}` | Name, generic name, brand, strength, form, category, description |
| `inventory/{pharmacyId_medicineId}` | Reported units, low-stock threshold, status, visibility, update timestamp |
| `reservations/{reservationId}` | User/pharmacy/medicine IDs, requested units, status, expiry |
| `notifications/{notificationId}` | In-app user/pharmacy updates and read state |
| `notificationSubscriptions/{subscriptionId}` | User, medicine, optional pharmacy, active state |
| `favorites/{uid_pharmacyId}` | Saved pharmacy references |
| `activityLogs/{logId}` | Admin actions |

Stock states are computed as `quantity === 0` → `OUT_OF_STOCK`, `0 < quantity <= minimumStock` → `LOW_STOCK`, and `quantity > minimumStock` → `AVAILABLE`. Public search only displays records marked public after joining them to an approved pharmacy profile. Approval changes synchronize the inventory visibility flag through a Cloud Function.

## Security and roles

Deploy `firestore.rules` and `storage.rules` before using non-demo data. Public registration can create only `USER` or `PHARMACY` profiles; profile roles cannot be changed by the profile owner. A pharmacy listing begins as `PENDING`, and its stock remains private until an admin approves it. Public users can read only approved pharmacy records and public inventory. Profile data is private. Inventory writes are limited to the owning pharmacy, and reservation writes are limited to trusted Functions. Storage only accepts images under 3 MB at pharmacy logo paths.

Admin authority is a Firebase Authentication custom claim (`admin: true`), never a role field supplied by a browser. To provision an admin, authenticate the Firebase Admin SDK using Google Application Default Credentials from a trusted workstation or server, then run:

```sh
gcloud auth application-default login
$env:GOOGLE_CLOUD_PROJECT = "medifind-app-21f1a"
npm run grant:admin -- admin@example.com
```

The account must already exist in Firebase Authentication and must sign in again after provisioning so its token receives the claim. Keep ADC credentials outside the repository.

## Firestore indexes

`firestore.indexes.json` contains the composite indexes used by inventory availability, pharmacy inventory, user/pharmacy reservations, reservation expiry, notifications, subscriptions, and favorites. Deploy them with `firebase deploy --only firestore:indexes`. Avoid adding extra composite indexes until a query requires them.

## Demo dataset

The seed script writes ten catalog examples, five clearly named sample pharmacies, inventory examples, demo profiles, and completed sample reservation history. It requires Admin SDK Application Default Credentials and intentionally writes to the selected project, so use a separate Firebase development project for the demo:

```sh
gcloud auth application-default login
$env:GOOGLE_CLOUD_PROJECT = "your-development-project-id"
npm run seed:demo
```

All records are marked `isDemo: true`; sample pharmacy names and the user-facing availability banner identify the data as demonstration-only. The seed does not create sign-in credentials. There are no built-in demo passwords.

## Environment variables

See `.env.example` for the six public Firebase web app variables. The active local `.env.local` is ignored by Git. Configure the same values in Vercel Project Settings → Environment Variables for Preview and Production. Admin credentials are not environment variables in the web client.

## Vercel deployment

Import the GitHub repository into Vercel as a Next.js project, set the six `NEXT_PUBLIC_FIREBASE_*` variables, and deploy. Add the Vercel domain to Firebase Authentication's authorized domains. Deploy Firestore rules/indexes, Storage rules, and Cloud Functions separately with the Firebase CLI. Never deploy with open Firestore or Storage rules.

## Validation commands

```sh
npm run typecheck
npm run lint
npm run build
npm --prefix functions run build
```

Authentication flows, reservation concurrency, security rules, Google sign-in, and Firebase-backed dashboards should also be exercised against a dedicated Firebase development project or the Firebase Emulator Suite before production use. The app must not be described as real-time inventory unless a pharmacy system actually supplies live updates.

## Future improvements

Add pharmacy point-of-sale integrations, verified review workflows, stronger automated rules/Functions emulator tests, richer service-area geocoding, optional transactional email/push delivery, and accessibility/usability analytics. AI-based medical advice is deliberately excluded.
