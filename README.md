# TR Accounts Book

Mobile-first person-wise and business accounting app. This repository is an active prototype; features still require browser/device and deployment validation.

## Features
- Dashboard totals, person-wise ledgers, transaction add/edit, history filters, recycle-bin restore/delete
- Person-wise statements with date filtering, opening balance, running balance, print/PDF, and WhatsApp sharing
- Local JSON backup and restore; proof attachments and IndexedDB storage
- Business ledgers, partner records, Business Suite, sales/invoices, purchases, inventory, customers, suppliers, expenses, payroll, cash/bank/UPI records, reports, CSV export, print/PDF
- Telugu/English UI labels and dark/light themes
- Local PIN hash and recovery-code flow; App Lock reveals recovery only after five failed PIN attempts, then requires replacement PIN and recovery code
- Gmail/Google sign-in, same-Gmail owner access across devices, and Firestore cloud sync
- Same-number Self-SMS check (Send Number = Receive Number) before Cloud Sync; Firebase Phone OTP is not used
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

Cloud sync requires Gmail/Google sign-in and the app's same-number Self-SMS check. The app prepares an SMS to the entered mobile; Send Number and Receive Number are the same. The user manually sends the SMS and enters the code. The app cannot automatically confirm SMS delivery, and this check is not cryptographic authentication. Firestore access is protected by the signed-in Google UID and owner-approved device UIDs. Publish updated Firestore rules and test sync/conflict/restore on two devices before using real financial records.

## Firebase
See [Firebase setup instructions](FIREBASE_SETUP.md). Enable Google sign-in and Firestore, then publish the updated `firestore.rules`. Same Gmail uses the same owner UID without approval; every device must complete the local Self-SMS check before Cloud Sync. Different Gmail remains owner-approval based.

## Debug APK
The GitHub Actions workflow builds v2.0.5 and verifies APK signature/package metadata. Stable signing secrets are optional; without them, the artifact uses Android debug signing and must not be treated as a production release.

## Validation
Validation and build/deploy workflows must be reviewed in GitHub Actions after each relevant commit. No real-device or live Firebase verification is claimed.
