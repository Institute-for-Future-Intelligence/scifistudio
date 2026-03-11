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
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Firebase config - public client-side values (protected by security rules)
const firebaseConfig = {
  apiKey: "AIzaSyAhY7pFGcL8GJM8auu4TTQGFs3TlBV2oS8",
  authDomain: "sci-fi-studio.web.app",
  projectId: "sci-fi-studio",
  storageBucket: "sci-fi-studio.firebasestorage.app",
  messagingSenderId: "231343877943",
  appId: "1:231343877943:web:1fc46e72331eb5e488f4b2",
}

// Guard against re-initialization during HMR
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
setPersistence(auth, browserLocalPersistence)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
