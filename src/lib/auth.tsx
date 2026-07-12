import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Tables } from './database.types'

export type Profile = Tables<'profiles'>

/** Mensagem de erro retornada por signIn (null = sucesso). */
export type SignInError = string | null

export interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, senha: string) => Promise<SignInError>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const applySession = async (session: Session | null): Promise<void> => {
      if (!session?.user) {
        if (active) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
        return
      }
      const nextProfile = await fetchProfile(session.user.id)
      if (!active) return
      if (!nextProfile) {
        // Usuário autenticado sem profile = não autorizado no painel.
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      setUser(session.user)
      setProfile(nextProfile)
      setLoading(false)
    }

    void supabase.auth.getSession().then(({ data }) => applySession(data.session))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // setTimeout evita deadlock: chamadas Supabase dentro do callback
      // de onAuthStateChange disputam o lock interno de auth.
      setTimeout(() => {
        void applySession(session)
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(
    async (email: string, senha: string): Promise<SignInError> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      })
      if (error || !data.user) {
        return 'Email ou senha inválidos.'
      }
      const nextProfile = await fetchProfile(data.user.id)
      if (!nextProfile) {
        await supabase.auth.signOut()
        return 'Sua conta não tem acesso ao painel. Fale com um administrador.'
      }
      setUser(data.user)
      setProfile(nextProfile)
      setLoading(false)
      return null
    },
    []
  )

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, loading, signIn, signOut }),
    [user, profile, loading, signIn, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.')
  }
  return ctx
}
