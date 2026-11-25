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

## 3. Cloud access and Self-SMS check
- Cloud identity and owner data access use the signed-in Gmail/Google UID.
- In Profile, enter the mobile number. Send Number and Receive Number must be the same number.
- Tap **Verify same-number Self-SMS**. The app prepares an SMS to the same mobile with a check code. Send the SMS, return to TR Accounts, enter the code, confirm, and save the Profile.
- The app cannot automatically confirm SMS delivery; the code match is a manual check and is not cryptographic authentication.
- Firebase Phone Authentication is not used, so Firebase SMS OTP billing/provider setup is not required.
- The local Self-SMS check must be completed on each device before Cloud Sync. Same Gmail uses the same owner UID. Different Gmail access remains owner-approval based.

## 4. Testing
- Publish Firestore rules after changes.
- Test with a new empty account and dummy entries first.
- Verify Gmail login, Self-SMS check, sync, restore, and owner approval on two devices.
- Do not use the prototype as the only copy of real financial records until these tests pass.
