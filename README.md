# TR Accounts Book

Mobile-first person-wise and business accounting app. This repository is an active prototype; features still require browser/device and deployment validation.

## Security and backups
- Automatic AES-256-GCM encryption for local account data and proof attachments; Android APK uses a non-exportable Android Keystore key, while web/PWA uses a non-exportable WebCrypto key in IndexedDB. Legacy local data and proof files are migrated in place.
- Cloud sync entries are AES-GCM encrypted before Firestore writes; key recovery uses Gmail-authenticated Firebase key escrow (not end-to-end encryption).
- Automatic dated encrypted backups in `Documents/.TRAccounts/Backup` on Android; browser builds use a folder picker when available.
- Gmail-authenticated encrypted backups can be restored on a new device after publishing the updated Firestore rules. Local-only encrypted backups require the original device key.

## Features
- Dashboard totals, person-wise ledgers, transaction add/edit, history filters, recycle-bin restore/delete
- Person-wise statements with date filtering, opening balance, running balance, print/PDF, and WhatsApp sharing
- Local JSON backup and restore; proof attachments and IndexedDB storage
- Business Mode with multiple businesses, separate business-filtered ledgers, sales, purchases, inventory, customers, suppliers, expenses, payroll, cash/bank/UPI, reports and per-business profile settings
- Business profile: optional logo, two office phone numbers, address, GSTIN, editable details; details can be skipped during setup and completed later
- A4 invoice print/PDF with business details, item-level GST rate entry, and optional digital signature (upload or draw; include/exclude on each invoice)
- Telugu/English UI labels and dark/light themes
- Local PIN hash and recovery-code flow; App Lock reveals recovery only after five failed PIN attempts, then requires replacement PIN and recovery code
- Gmail/Google sign-in, same-Gmail owner access across devices, and Firestore cloud sync
- Cloud Sync requires Gmail sign-in and same-number Self-SMS verification on the device; cloud rules separately enforce owner UID or owner-approved device
- Different-Gmail device access remains owner-approval based
- PWA manifest, offline service-worker shell, Capacitor Android setup, and debug APK workflow

## Not yet implemented or verified
- Self-SMS and cloud sync require Gmail login and the local manual check; SMS delivery is not automatically confirmed
- Same-Gmail multi-device sync, conflict handling, and different-Gmail owner approval remain unverified
- Automated daily/weekly backup scheduling
- Full test coverage and real-device validation
- Final integration of the owner's original logo/photo
- Real-device tests, production Firebase verification, and Pages deployment are pending

## Data and safety
Local app data is saved in browser/device storage. Proof attachments are stored in IndexedDB. Keep backups in a separate safe location and do not treat this prototype as the only financial record.

Cloud Sync uses Gmail/Firebase Auth UID plus same-number Self-SMS verification on the current device as a local gate. No Firebase Phone Auth SMS is used, avoiding Firebase phone-OTP billing. Firestore rules independently enforce the owner UID or an owner-approved device UID; the local Self-SMS check is not cryptographic server proof and cannot by itself secure server access. Publish updated rules and test sync/conflict/restore and owner approval on two devices before using real financial records.

## Firebase
See [Firebase setup instructions](FIREBASE_SETUP.md). Enable Google sign-in and Firestore, then publish the updated `firestore.rules`. Same Gmail uses the same owner UID; the app's Self-SMS is a local verification gate. Different Gmail remains owner-approval based.

## Debug APK
The GitHub Actions workflow builds v2.1.0 and verifies APK signature/package metadata. Stable signing secrets are optional; without them, the artifact uses Android debug signing and must not be treated as a production release.

## Validation
Validation and build/deploy workflows must be reviewed in GitHub Actions after each relevant commit. No real-device or live Firebase verification is claimed.
