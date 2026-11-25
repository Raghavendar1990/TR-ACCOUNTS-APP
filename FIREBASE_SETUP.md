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
- This is a local/device verification gate only; it is not cryptographic proof to Firestore. Cloud rules protect data using the signed-in owner UID or an owner-approved device UID. Never publish rules that grant access based only on a local Self-SMS result.
- Same Gmail uses the owner UID. Different Gmail/device access requires the owner's device approval flow.

## 4. Testing
- Publish Firestore rules after changes.
- Test with a new empty account and dummy entries first.
- Verify Gmail login, local same-number Self-SMS, sync, restore, conflict merge, and owner approval on two devices.
- Do not use the prototype as the only copy of real financial records until these tests pass.
