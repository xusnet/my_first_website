import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'

export function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/admin/login" replace />
  if (!user.isSuperadmin && !user.permissions.includes(perm)) {
    return (
      <div className="p-10 text-center text-muted">
        <p className="text-lg">没有权限访问此页面</p>
        <p className="mt-2 text-sm">请联系管理员为你分配相应权限。</p>
      </div>
    )
  }
  return <>{children}</>
}
