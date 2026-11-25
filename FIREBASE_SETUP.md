# Firebase / Google Cloud setup for TR Accounts

## 1. Firebase project and Google sign-in
1. Open https://console.firebase.google.com/ and sign in with the Gmail that will own TR Accounts cloud data.
2. Create or select the TR Accounts Firebase project.
3. Add a Web app and copy the Firebase config into `firebase-config.js`.
4. Firebase Authentication → Sign-in method: enable Google and save the support email.
5. Authentication → Settings → Authorized domains: add the hosted app domain if needed.

## 2. Firestore
1. Create Firestore Database in production mode.
2. Choose a region close to you.
3. Publish the rules from repository file `firestore.rules`.

## 3. Free same-number Self-SMS verification
- The app does **not** use Firebase Phone Authentication or Firebase SMS OTP, avoiding Firebase phone-verification SMS charges.
- In Profile, enter the mobile number, select SIM 1 or SIM 2, and run the same-number Self-SMS verification. The native Android app sends its own short verification SMS to that same number and matches the received message.
- This is a local/device verification gate only; it is not cryptographic proof to Firestore. Cloud rules protect data using the signed-in owner UID or an owner-approved device UID. Never publish rules that grant access based only on a local Self-SMS result.\n- TR Accounts now encrypt each cloud sync entry using AES-GCM-256 before Firestore writes. A separate `keyRecovery/dataKey` record holds the automatically generated cloud key, access-controlled by owner/approved-device Firestore rules. This is **cloud key escrow, not end-to-end encryption**: a Firebase project administrator could access the escrowed key and encrypted data. Gmail authentication can recover the cloud key on a new device. Publish the updated `firestore.rules` file before testing encrypted sync.
- Same Gmail uses the owner UID. Different Gmail/device access requires the owner's device approval flow.

## 5. Automatic encrypted backups\n- In Settings, tap **Backup Folder**. Android APK creates `Documents/TR Accounts/Backup`; browser builds use the folder picker when supported.\n- The app writes/updates a dated encrypted backup automatically when data changes. With Gmail login, backup files use the cloud-recoverable key escrow encryption format; without Gmail, local-key encryption is used and that file is only restorable on the same device.\n- Manual Backup downloads an encrypted file. Restore from file supports cloud-key encrypted backups after logging into the owning Gmail, and local-key backups only on the original device. Legacy password-encrypted and older unencrypted backups remain supported.\n\n## 6. Testing
- Publish Firestore rules after changes.
- Test with a new empty account and dummy entries first.
- Verify Gmail login, local same-number Self-SMS, sync, restore, conflict merge, and owner approval on two devices.
- Do not use the prototype as the only copy of real financial records until these tests pass.
