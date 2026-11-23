# Firebase / Google Cloud setup for TR Accounts

This setup is required before Google sign-in or Cloud sync can work. It must be completed in the owner's Google account; the app cannot create or access a Firebase project without the owner signing in and granting access.

## 1. Create project
1. Open https://console.firebase.google.com/ and sign in with the Gmail you want to own TR Accounts data.
2. Create a project named **TR Accounts** (or a name you prefer). Analytics is optional; you may disable it.
3. In Project settings → General → Your apps, add a **Web app** named **TR Accounts Web**. Copy the Firebase config object values.

## 2. Enable Google sign-in
1. Firebase Console → Authentication → Get started → Sign-in method.
2. Enable **Google** provider.
3. Select the project's support email and save.
4. Authentication → Settings → Authorized domains: ensure the hosted app's domain is listed. GitHub Pages domains may be added if deploying there.

## 3. Create Firestore
1. Firebase Console → Firestore Database → Create database.
2. Start in production mode and choose a region close to you (region choice cannot easily be changed later).
3. Open Firestore → Rules, paste the contents of repository file `firestore.rules`, and Publish.

## 4. Add config to repository
1. In GitHub repo, open `firebase-config.js`.
2. Replace placeholder strings with values from the Web app config. Keep the property names as shown.
3. Commit the file. Firebase Web config values are public client identifiers; do not add service-account JSON or private keys to the app.

## 5. Owner-approved second-device access
1. Sign in on the owner's first device. The Settings page displays the owner's Firebase UID.
2. On the second device, sign in with Google, open Settings, paste the first device's Owner UID, and tap **Request Owner Approval**.
3. On the first device, Settings → Second Device Approval shows pending requests. Approve only a device you recognize.
4. After approval, the second device connects to the owner's cloud ledger. The approval is saved for that device's Google UID.

**Important:** Publish the updated `firestore.rules` file from this repository before testing this feature. Never approve an unknown device UID.

## 6. Testing before using financial records
- First test with an empty account and a small dummy entry.
- Sign in on the owner's device and verify Cloud upload.
- Do not test with important/real records until cloud sync, restore, permissions, and backup have been tested.
- Owner-approved second-device access is implemented in the app/rules but remains unverified until the updated Firestore rules are published and tested on two devices. Drive backup is not implemented.

