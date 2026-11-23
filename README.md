# TR Accounts Book

Mobile-first person-wise and business accounting app. This repository is an active prototype; features still require browser/device and deployment validation.

## Features in the current code
- Dashboard totals, person-wise ledgers, transaction add/edit, history filters, recycle-bin restore/delete
- Person-wise statements with date filtering, opening balance, running balance, print/PDF, and WhatsApp sharing
- Local JSON backup and restore; backup export attempts to include proof attachments encoded as Base64
- Optional image/PDF proof attachment (700 KB maximum), stored in IndexedDB
- Business ledgers and partner records
- Telugu/English UI labels and dark/light themes
- Local PIN hash and recovery-code flow
- Google sign-in and Firestore cloud sync module (Firebase configuration is included); requires Firebase Auth, authorized domains, and suitable Firestore rules
- PWA manifest, offline service-worker shell, Capacitor Android setup, and debug APK workflow

## Not yet implemented or verified
- Owner approval for second-device access
- Automated daily/weekly backup scheduling
- Full test coverage and real-device validation
- Final integration of the owner's original logo/photo
- Latest GitHub Actions validation, Pages deployment, and APK build status are not confirmed

## Data and safety
Local app data is saved in browser/device storage. Proof attachments are stored in IndexedDB. JSON backup export includes proofs when the proof records can be read; restore attempts to re-import them. Keep backups in a separate safe location and do not treat this prototype as the only financial record.

Cloud sync is implemented in the client module but is not considered production-ready until Firebase configuration, authentication domains, Firestore rules, conflict behavior, and multi-device testing are verified.

## Firebase
See [Firebase setup instructions](FIREBASE_SETUP.md). The current Firestore rules restrict users to documents keyed by their own authenticated UID; they do **not** implement owner-approved second-device access.

## Debug APK
The GitHub Actions workflow `.github/workflows/build-apk.yml` builds a debug APK and uploads it as the `TR-Accounts-debug-APK` artifact when it succeeds. The latest build has not been verified.

## Validation
Validation workflow checks should be reviewed in GitHub Actions after each relevant commit.