import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { auth } from './firebase'

const googleProvider = new GoogleAuthProvider()

export const signInWithGoogle = async (): Promise<User | null> => {
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
  return onAuthStateChanged(auth, callback)
}

export type { User }
