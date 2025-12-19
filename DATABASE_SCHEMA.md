# Cosmic Cats - Database Structure & Security Rules

Since you are using **Firebase Firestore**, there is **no SQL** code to run. Firestore is a NoSQL, document-oriented database that stores data in JSON-like structures.

However, strict structure and security are enforced using **Firestore Security Rules**.

## 1. Data Structure (JSON Schema)

The game automatically creates this structure for each user when they sign up.

### Collection: `users`
**Document ID:** `[User UID]` (from Firebase Auth)

```json
{
  "totalCoins": 1250,        // Total accumulated coins (Number)
  "highScore": 500000,       // All-time high score (Number)
  
  // Game Statistics
  "stats": {
    "totalGames": 42,        // Total games played
    "totalAsteroids": 1500,  // Total asteroids destroyed
    "totalAliens": 200,      // Total aliens defeated
    "totalSpacePirates": 50, // Total space pirates defeated
    "totalCoinsEarned": 3000 // Lifetime earnings
  },
  
  // Inventory
  "ownedItems": {
    "skins": ["default", "fire", "galaxy"],
    "trails": ["default", "fire"],
    "bullets": ["default", "plasma"],
    "backgrounds": ["default", "nebula"]
  },
  
  // Current Loadout
  "equippedItems": {
    "skin": "galaxy",
    "trail": "fire",
    "bullet": "plasma",
    "background": "nebula"
  },
  
  // Achievements (IDs)
  "achievements": [
    "first_flight",
    "asteroid_hunter_1",
    "millionaire"
  ],
  
  // User Settings
  "settings": {
    "mobileZoom": 1800,
    "controlScheme": "mouse" // "keyboard", "mouse", "mouse_only"
  },

  // Unlocked Modifiers
  "modifiers": {
    "fastMode": false,
    "nightmareMode": true, // Saved as true if unlocked
    "immortalMode": false
  },
  
  // Metadata
  "lastUpdated": Timestamp,  // Server timestamp
  "lastDevice": "Mozilla/5.0..." // User Agent string
}
```

## 2. Security Rules (The "SQL Code")

In the Firebase Console -> Firestore Database -> **Rules** tab, paste this code. This enforces that users can only read/write their OWN data and validates data types.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is signed in
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the document
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // USERS COLLECTION RULES
    match /users/{userId} {
      
      // Allow reading/writing only if you are the owner
      allow read, write: if isOwner(userId);
      
      // OPTIONAL: Strict Schema Validation (Advanced)
      // Ensures users can't upload garbage data
      allow create, update: if isOwner(userId)
        && request.resource.data.totalCoins is number
        && request.resource.data.totalCoins >= 0
        && request.resource.data.highScore is number
        && request.resource.data.stats is map
        && request.resource.data.ownedItems is map
        && request.resource.data.equippedItems is map;
    }
  }
}
```

## 3. How to Deploy

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **cosmic-cats-62d36**
3. Navigate to **Firestore Database** > **Rules**
4. Paste the code from section 2 above.
5. Click **Publish**.

This setup ensures your database is secure, structured, and "perfectly laid out" for your game!
