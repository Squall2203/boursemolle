import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  authModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
        return { error: "Email ou mot de passe incorrect." }
      }
      if (msg.includes("email not confirmed")) {
        return { error: "Vérifiez votre boîte email — confirmez votre inscription avant de vous connecter." }
      }
      if (msg.includes("too many requests") || msg.includes("rate limit")) {
        return { error: "Trop de tentatives. Attendez quelques minutes avant de réessayer." }
      }
      return { error: error.message }
    }
    return { error: null }
  }

  async function signUpWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes("already registered") || msg.includes("user already exists")) {
        return { error: "Un compte existe déjà avec cet email. Essayez de vous connecter." }
      }
      if (msg.includes("password")) {
        return { error: "Le mot de passe doit contenir au moins 6 caractères." }
      }
      return { error: error.message }
    }
    return { error: null }
  }

  async function signInWithGoogle(): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        authModalOpen,
        openAuthModal: () => setAuthModalOpen(true),
        closeAuthModal: () => setAuthModalOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider")
  return ctx
}
