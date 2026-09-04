import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas text-muted">加载中…</div>
  if (!user) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  if (user.mustChangePassword && location.pathname !== '/admin/change-password') {
    return <Navigate to="/admin/change-password" replace />
  }
  return <>{children}</>
}
