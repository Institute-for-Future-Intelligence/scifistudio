/*
 * Copyright 2026 Institute for Future Intelligence, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
} from 'firebase/auth'
import { auth } from './firebase'

const googleProvider = new GoogleAuthProvider()

// Ensure local persistence is set before any sign-in
const ensurePersistence = setPersistence(auth, browserLocalPersistence)

export const signInWithGoogle = async (): Promise<User | null> => {
  await ensurePersistence
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
  // onAuthStateChanged will fire immediately with current user (or null if not signed in)
  // Firebase automatically restores the persisted user from IndexedDB/localStorage
  return onAuthStateChanged(auth, callback)
}

export type { User }
