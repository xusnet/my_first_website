import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser } from '../types'
import { get, post, tokenStore } from '../lib/api'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  hasPermission: (perm: string) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!tokenStore.access && !tokenStore.refresh) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await get<{ user: AuthUser }>('/api/auth/me', true)
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (username: string, password: string) => {
    const data = await post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
      '/api/auth/login',
      { username, password },
    )
    tokenStore.set(data.accessToken, data.refreshToken)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await post('/api/auth/logout', { refreshToken: tokenStore.refresh }, true)
    } catch {
      // ignore
    }
    tokenStore.clear()
    setUser(null)
  }, [])

  const hasPermission = useCallback(
    (perm: string) => !!user && (user.isSuperadmin || user.permissions.includes(perm)),
    [user],
  )

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser, hasPermission }),
    [user, loading, login, logout, refreshUser, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
