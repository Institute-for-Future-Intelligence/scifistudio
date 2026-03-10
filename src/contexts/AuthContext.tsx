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
import { createContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User, subscribeToAuthChanges, signInWithGoogle, signInAnonymously, signOut } from '../services/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signInAnonymous: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const initialAuthCheckDone = useRef(false)

  useEffect(() => {
    // Persistence is configured at auth initialization, so we can subscribe immediately
    const unsubscribe = subscribeToAuthChanges((authUser) => {
      console.log('Auth state changed:', authUser?.email || authUser?.uid || 'signed out')

      if (!initialAuthCheckDone.current) {
        initialAuthCheckDone.current = true
        console.log('Initial auth check complete, user:', authUser?.email || 'none')
      }

      setUser(authUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const handleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Sign in failed:', error)
    }
  }

  const handleSignInAnonymous = async () => {
    try {
      await signInAnonymously()
    } catch (error) {
      console.error('Anonymous sign in failed:', error)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn: handleSignIn,
        signInAnonymous: handleSignInAnonymous,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
