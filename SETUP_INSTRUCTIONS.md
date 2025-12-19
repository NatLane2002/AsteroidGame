# ⚠️ CRITICAL SETUP STEPS

The errors you are seeing (`auth/operation-not-allowed` and Status 400) are **Security Settings** that must be enabled in your Firebase Console. The code is working perfectly, but Firebase is blocking it until you flip the switches.

## STEP 1: Enable Cloud Firestore (The Database)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Build** -> **Firestore Database** in the left menu.
3. Click **Create Database**.
4. Select **Start in Test Mode** -> Next.
5. Select a location -> **Enable**.

## STEP 2: Enable Sign-In Methods (Fixes the "Sign up error")
1. In the left menu, click **Build** -> **Authentication**.
2. Click the **Sign-in method** tab.
3. Click **Email/Password**.
   - Toggle **Enable** to **ON**.
   - Click **Save**.
4. Click **Add new provider** -> Select **Google**.
   - Toggle **Enable** to **ON**.
   - Enter your email in "Project support email".
   - Click **Save**.

## STEP 3: Fix Google Sign-In (The "Status 400" Error)
Google blocks sign-ins from unauthorized websites. You must authorize your URLs.
1. Still in **Authentication** -> Click **Settings** tab.
2. Click **Authorized Domains**.
3. You will see `localhost` is there (this is why local testing works).
4. **IMPORTANT**: Click **Add Domain** and add your deployed URL (e.g., `your-app.vercel.app` or `your-app.netlify.app`).

## STEP 4: Update Security Rules
1. Call up **Firestore Database** -> **Rules**.
2. Paste this Code:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
3. Click **Publish**.

Once these 4 steps are done, your app will work **PERFECTLY**.
