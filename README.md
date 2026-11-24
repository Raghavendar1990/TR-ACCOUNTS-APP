# TR Accounts Book

Mobile-first person-wise and business accounting app. This repository is an active prototype; features still require browser/device and deployment validation.

## Features in the current code
- Dashboard totals, person-wise ledgers, transaction add/edit, history filters, recycle-bin restore/delete
- Person-wise statements with date filtering, opening balance, running balance, print/PDF, and WhatsApp sharing
- Local JSON backup and restore; backup export attempts to include proof attachments encoded as Base64
- Optional image/PDF proof attachment (700 KB maximum), stored in IndexedDB
- Business ledgers and partner records
- Business Suite: business dashboard, sales/invoices, purchases, inventory/stock alerts, customers, suppliers, expenses, employees/payroll entries, cash/bank/UPI records, reports, CSV export, print/PDF report, business profile settings, day closing, and customer/supplier ledger summaries
- Telugu/English UI labels and dark/light themes
- Local PIN hash and recovery-code flow; App Lock reveals recovery only after five failed PIN attempts, then requires replacement PIN and recovery code
- Google sign-in, same-Gmail owner access across devices, and Firestore cloud sync\n- Required registered-mobile OTP verification on every device before Cloud Sync; Firebase Phone provider and phone-claim Firestore rules are required\n- Different-Gmail device access remains owner-approval based
- PWA manifest, offline service-worker shell, Capacitor Android setup, and debug APK workflow

## Not yet implemented or verified
- Firebase Phone OTP and cloud sync are code-gated but require Firebase Phone provider/domain setup and live verification
- Same-Gmail multi-device sync, conflict handling, and different-Gmail owner approval remain unverified
- Automated daily/weekly backup scheduling
- Full test coverage and real-device validation
- Final integration of the owner's original logo/photo
- Real-device tests, production Firebase verification, and Pages deployment are pending

## Data and safety
Local app data is saved in browser/device storage. Proof attachments are stored in IndexedDB. JSON backup export includes proofs when the proof records can be read; restore attempts to re-import them. Keep backups in a separate safe location and do not treat this prototype as the only financial record.

Cloud sync now blocks ledger synchronization until the signed-in Google account has a Firebase phone-number claim. Self-SMS is not authentication. Cloud sync is still not production-ready until Firebase Phone sign-in is enabled, authorized domains and Firestore rules are published, and multi-device conflict/restore tests are completed.

## Firebase
See [Firebase setup instructions](FIREBASE_SETUP.md). Enable Firebase Phone sign-in, then publish the updated `firestore.rules`. Same Gmail uses the same owner UID without approval, but every device must complete mobile OTP verification. Different Gmail remains owner-approval based. Test OTP, sync, and rules on two devices before relying on this feature.

## Debug APK
The GitHub Actions workflow builds v2.0.5 and verifies APK signature/package metadata. Stable signing secrets are optional; without them, the artifact uses Android debug signing and must not be treated as a production release.

## Validation
Validation and build/deploy workflows must be reviewed in GitHub Actions after each relevant commit. No real-device or live Firebase verification is claimed.