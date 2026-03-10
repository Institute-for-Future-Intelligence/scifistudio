import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Firebase config - public client-side values (protected by security rules)
const firebaseConfig = {
  apiKey: "AIzaSyAhY7pFGcL8GJM8auu4TTQGFs3TlBV2oS8",
  authDomain: "sci-fi-studio.firebaseapp.com",
  projectId: "sci-fi-studio",
  storageBucket: "sci-fi-studio.firebasestorage.app",
  messagingSenderId: "231343877943",
  appId: "1:231343877943:web:1fc46e72331eb5e488f4b2",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
