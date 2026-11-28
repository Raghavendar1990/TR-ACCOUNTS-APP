# TR Accounts Book

Mobile-first person-wise and business accounting app. This repository is an active prototype; features still require browser/device and deployment validation.

## Security and backups
- Automatic AES-256-GCM encryption for local ledger data and proof attachments; Android APK uses a non-exportable Android Keystore key, while web/PWA uses a non-exportable WebCrypto key in IndexedDB. Legacy local data and proof files are migrated in place.
- Cloud sync entries are AES-GCM encrypted before Firestore writes; key recovery uses Gmail-authenticated Firebase key escrow (not end-to-end encryption).
- Automatic dated encrypted backups in `Documents/.TRAccounts/Backup` on Android; browser builds use a folder picker when available. These user backups have no app-imposed expiry or 30-day cleanup.
- Gmail-authenticated encrypted backups can be restored on a new device after publishing the updated Firestore rules. Local-only encrypted backups require the original device key.
- Registration/profile metadata (name, phone, DOB, gender) is currently stored in localStorage without encryption; this is a known security gap. The separate app login PIN hash uses unsalted SHA-256 and needs a stronger password/PIN-hashing design before production.

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
- Cloud Sync requires Gmail sign-in; Firestore rules enforce owner UID or owner-approved device UID. SMS/self-SMS/OTP verification is not used by the app.
- Different-Gmail device access remains owner-approval based
- PWA manifest, offline service-worker shell, Capacitor Android setup, APK workflow with GitHub Release assets (release assets are not subject to Actions artifact retention expiry).

## Not yet implemented or verified
- Same-Gmail multi-device sync, conflict handling, and different-Gmail owner approval remain unverified
- Automated daily/weekly backup scheduling
- Full test coverage and real-device validation
- Privacy Policy, Play Console Data Safety declarations, and account/data deletion workflow
- Android merged-manifest permission audit and target SDK 36 migration
- Production release signing and Play Store AAB
- Final integration of the owner's original logo/photo
- Real-device tests, production Firebase verification, and Pages deployment are pending

## Data and safety
Local ledger data and proof files use encryption. Profile/registration fields are currently plaintext in localStorage. Keep backups in a separate safe location and do not treat this prototype as the only financial record.

Cloud Sync uses Gmail/Firebase Auth UID plus Firestore owner UID or owner-approved-device rules. No SMS or phone OTP is used. Publish updated rules and test sync/conflict/restore and owner approval on two devices before using real financial records.

## Firebase
See [Firebase setup instructions](FIREBASE_SETUP.md). Enable Google sign-in and Firestore, then publish the updated `firestore.rules`. Cloud access uses owner UID or owner-approved device; there is no SMS verification.

## Debug APK
The GitHub Actions workflow builds v1.0 and verifies APK signature/package metadata. Each build is published as a GitHub Release APK asset intended to remain available unless manually deleted. Stable signing secrets are optional; without them, the APK uses Android debug signing and must not be treated as a production release.

## Validation
Validation and build/deploy workflows must be reviewed in GitHub Actions after each relevant commit. No real-device or live Firebase verification is claimed.
