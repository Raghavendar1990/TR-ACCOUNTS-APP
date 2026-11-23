# TR Accounts Book

Mobile-first personal and business ledger app. The repository currently contains a local-first prototype; listed modules are present in code but are not yet fully tested or production-ready.

## Modules present in code (testing pending)
- Dashboard income, expense, and balance totals
- Person-wise ledgers, add/rename/delete person
- Income and expense transaction entries (date, description, payment method)
- History search and type filters; edit transactions; move to Recycle Bin, restore, or permanently delete
- Person-wise statement filters, opening balance, print/PDF, and WhatsApp text sharing
- Local JSON backup and restore
- Optional image/PDF proof attachment (700 KB max), stored separately in IndexedDB
- Business ledgers and business entries
- Partner records, share %, investment, profit/withdrawal record entries
- Telugu/English labels and dark/light themes
- Local PIN with hashed PIN and recovery code
- PWA manifest and offline service-worker shell
- Capacitor Android configuration and a manual GitHub Actions debug-APK workflow

## Not implemented / not connected yet
- Firebase authentication and cloud sync
- Owner approval for second-device access
- Cloud backup/restore and account recovery
- Final owner-selected logo/photo integration
- Scheduled daily/weekly backup
- Production Android build, device testing, and full feature validation

## Data and safety
Current app data is saved locally in the browser/device. Proof attachments are stored separately and are not included in JSON backup. Cloud sync is not active. Do not rely on this prototype as the sole financial record until backups, testing, and cloud features are completed.

## Debug APK workflow
1. Open the repository on GitHub.
2. Open **Actions** → **Build Android APK**.
3. Choose **Run workflow**.
4. Wait for the run to finish successfully.
5. Download the **TR-Accounts-debug-APK** artifact.

APK generation has not yet been verified.

## Validation
GitHub Actions validation is configured to check inline JavaScript syntax and the manifest JSON on pushes and pull requests.
