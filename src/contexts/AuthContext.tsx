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
    console.log('Setting up auth state listener...')
    const unsubscribe = subscribeToAuthChanges((authUser) => {
      console.log('Auth state changed:', authUser?.email || authUser?.uid || 'signed out')

      // Only update state after the first callback (persistence is ready)
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
