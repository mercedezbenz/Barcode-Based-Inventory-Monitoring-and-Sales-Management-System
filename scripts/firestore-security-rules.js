console.log("🔥 FIRESTORE SECURITY RULES SETUP")
console.log("=".repeat(50))
console.log("")
console.log("⚠️  IMPORTANT: You need to apply these security rules to fix permission errors!")
console.log("")
console.log("📋 Steps to apply these rules:")
console.log("1. Go to https://console.firebase.google.com")
console.log("2. Select your 'decktago' project")
console.log("3. Navigate to: Firestore Database → Rules")
console.log("4. Replace ALL existing rules with the rules below")
console.log("5. Click 'Publish' to save the changes")
console.log("")
console.log("🚨 Without these rules, you'll get 'permission-denied' errors!")
console.log("")
console.log("=".repeat(50))
console.log("COPY THE RULES BELOW:")
console.log("=".repeat(50))

const firestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can read their own data, admins can read all
    match /users/{userId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Inventory collection - authenticated users can read, admins and staff can write
    match /inventory/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff'];
    }
    
    // Categories collection - authenticated users can read, admins can write
    match /categories/{categoryId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Documents collection - authenticated users can read, admins and staff can write
    match /documents/{documentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff'];
    }
    
    // Deliveries collection - authenticated users can read, all roles can write
    match /deliveries/{deliveryId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff', 'driver'];
    }
    
    // Stock movements collection - authenticated users can read, admins and staff can write
    match /stock_movements/{movementId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff'];
    }
  }
}`

console.log(firestoreRules)
console.log("")
console.log("=".repeat(50))
console.log("✅ After applying the rules:")
console.log("1. Run the 'create-admin-user.sql' script")
console.log("2. Try logging in with: admin@decktago.com / admin123")
console.log("3. The permission errors should be resolved!")
console.log("=".repeat(50))
