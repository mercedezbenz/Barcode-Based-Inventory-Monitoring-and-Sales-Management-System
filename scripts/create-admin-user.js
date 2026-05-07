// Create admin user in Firestore
// Run this script to create the initial admin user document

import { initializeApp } from "firebase/app"
import { getFirestore, doc, setDoc } from "firebase/firestore"
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"

// Firebase config (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyBvOsda_wGGsT1f1tr_6oA9HZsgjUMdWWs",
  authDomain: "decktago.firebaseapp.com",
  projectId: "decktago",
  storageBucket: "decktago.firebasestorage.app",
  messagingSenderId: "590323015469",
  appId: "1:590323015469:web:8e5b7c8f9d0e1a2b3c4d5e",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

async function createAdminUser() {
  try {
    console.log("[v0] Creating admin user...")

    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, "admin@decktago.com", "admin123")

    const user = userCredential.user
    console.log("[v0] Firebase Auth user created:", user.uid)

    // Create user document in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: "admin@decktago.com",
      role: "admin",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log("[v0] Admin user document created successfully")
    console.log("Admin credentials:")
    console.log("Email: admin@decktago.com")
    console.log("Password: admin123")
  } catch (error) {
    console.error("[v0] Error creating admin user:", error)
  }
}

// Run the function
createAdminUser()
