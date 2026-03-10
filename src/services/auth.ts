import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  User,
} from 'firebase/auth'
import { auth } from './firebase'

const googleProvider = new GoogleAuthProvider()

// Set persistence to IndexedDB (more reliable than localStorage for long-term persistence)
// Falls back to localStorage if IndexedDB is not available
const persistenceReady = setPersistence(auth, indexedDBLocalPersistence)
  .then(() => console.log('Firebase auth persistence configured (IndexedDB)'))
  .catch(() => {
    // Fallback to localStorage if IndexedDB fails
    return setPersistence(auth, browserLocalPersistence)
      .then(() => console.log('Firebase auth persistence configured (localStorage fallback)'))
  })
  .catch((err) => console.error('Failed to set persistence:', err))

export const signInWithGoogle = async (): Promise<User | null> => {
  // Ensure persistence is configured before signing in
  await persistenceReady
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string }
    if (firebaseError.code === 'auth/popup-closed-by-user') {
      console.log('Popup closed by user')
      return null
    }
    console.error('Sign in error:', firebaseError.message)
    throw error
  }
}

export const signInAnonymously = async (): Promise<User | null> => {
  // Ensure persistence is configured before signing in
  await persistenceReady
  try {
    const result = await firebaseSignInAnonymously(auth)
    return result.user
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string }
    console.error('Anonymous sign in error:', firebaseError.message)
    throw error
  }
}

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth)
}

export const subscribeToAuthChanges = (
  callback: (user: User | null) => void
): (() => void) => {
  // onAuthStateChanged will fire immediately with current user (or null if not signed in)
  // Firebase automatically restores the persisted user from IndexedDB/localStorage
  return onAuthStateChanged(auth, callback)
}

// Export persistence promise for components that need to wait
export { persistenceReady }

export type { User }
