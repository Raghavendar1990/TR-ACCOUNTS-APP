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

## 3. Firebase phone claim requirement
- Cloud Sync now requires a Firebase ID token with a phone-number claim matching the Profile number. The local Self-SMS check is not cloud authorization.
- Firestore rules independently require `request.auth.token.phone_number` for ledger sync entries and ledger-data writes.
- Firebase Console → Authentication → Sign-in method: enable **Phone** (and Google), configure authorized domains, and review billing/SMS limits.
- **Important:** The app currently does not implement Firebase Phone Authentication sign-in to acquire the phone claim. Cloud Sync is intentionally blocked until that app flow is implemented and tested. Enabling the provider alone will not unlock sync.
- Gmail owner UID and owner-approved device UID controls remain in place; different Gmail access remains owner-approval based.

## 4. Testing
- Publish Firestore rules after changes.
- Test with a new empty account and dummy entries first.
- Verify Firebase Phone Authentication claim, Gmail login, sync, restore, conflict merge, and owner approval on two devices.
- Do not use the prototype as the only copy of real financial records until these tests pass.
