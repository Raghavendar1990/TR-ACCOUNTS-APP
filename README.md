# TR Accounts

Mobile-first personal ledger prototype for person-wise accounting. Telugu and English UI, dark/light themes, offline shell, local transactions, statements, backup, and PIN lock.

## Current modules
- Dashboard income, expense, balance totals
- Person-wise ledgers and balances
- Add income/expense transactions with date, description, payment method
- History search and income/expense filters
- Edit transaction, soft-delete to Recycle Bin, restore, permanent deletion
- Person-wise statements with date range and opening balance, print/PDF, WhatsApp text share
- Local JSON backup and restore
- Telugu/English switch and AMOLED dark/light theme
- Local PIN lock with hashed PIN and recovery code
- PWA manifest and offline service-worker shell

## Not yet connected
- Cloud sync / Firebase authentication and owner approval
- Business account and partner/investment modules
- Proof attachments (700 KB limit)
- Final user-selected logo/photo
- Native Android APK packaging

Cloud features are not active yet; current data is stored on the device/browser. Do not use this prototype as a sole financial record until backup and testing are complete.

## Validation
GitHub Actions checks inline JavaScript syntax and the web manifest JSON on pushes and pull requests.
