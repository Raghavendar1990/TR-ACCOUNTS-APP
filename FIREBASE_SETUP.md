# Firebase / Google Cloud setup for TR Accounts

## 1. Firebase project and Google sign-in
1. Open https://console.firebase.google.com/ and sign in with the Gmail that will own TR Accounts cloud data.
2. Create or select the TR Accounts Firebase project.
3. Add a Web app and copy the Firebase config into `firebase-config.js`.
4. Firebase Authentication → Sign-in method: enable Google and save the support email.
5. Authentication → Settings → Authorized domains: add the hosted app domain if needed.
6. Phone authentication is not used. Do not enable or configure Firebase Phone Auth for TR Accounts.

## 2. Firestore
1. Create Firestore Database in production mode.
2. Choose a region close to you.
3. Publish the rules from repository file `firestore.rules`.

## 3. Cloud sync and encryption
- Cloud Sync requires Gmail sign-in. Same Gmail uses the owner UID; access from a different Gmail/device requires the owner's device approval flow.
- No SMS, self-SMS, SIM selection, or OTP verification is used by the app.
- TR Accounts encrypts each cloud sync entry using AES-GCM-256 before Firestore writes. A separate `keyRecovery/dataKey` record holds the automatically generated cloud key, access-controlled by owner/approved-device Firestore rules. This is **cloud key escrow, not end-to-end encryption**: a Firebase project administrator could access the escrowed key and encrypted data. Gmail authentication can recover the cloud key on a new device. Publish the updated `firestore.rules` file before testing encrypted sync.
- Profile/registration metadata (name, phone, DOB, gender) is currently stored in localStorage without encryption. This is a known security gap; avoid using sensitive profile data until it is fixed.

## 4. Automatic encrypted backups
- In Settings, tap **Backup Folder**. Android APK creates `Documents/.TRAccounts/Backup`; browser builds use the folder picker when supported.
- The app writes/updates a dated encrypted backup automatically when data changes. With Gmail login, backup files use the cloud-recoverable key escrow encryption format; without Gmail, local-key encryption is used and that file is only restorable on the same device.
- Manual Backup downloads an encrypted file. Restore from file supports cloud-key encrypted backups after logging into the owning Gmail, and local-key backups only on the original device. Legacy password-encrypted and older unencrypted backups remain supported.

## 5. Testing
- Publish Firestore rules after changes.
- Test with a new empty account and dummy entries first.
- Verify Gmail login, sync, restore, conflict merge, and owner approval on two devices.
- Do not use the prototype as the only copy of real financial records until these tests pass.
