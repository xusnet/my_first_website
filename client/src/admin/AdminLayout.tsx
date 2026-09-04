import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { SpikeMark } from '../components/SpikeMark'
import { useSiteInfo } from '../lib/site'

interface NavItem {
  label: string
  to: string
  perm?: string
}

const NAV: NavItem[] = [
  { label: '仪表盘', to: '/admin', perm: 'dashboard:read' },
  { label: '文章管理', to: '/admin/posts', perm: 'post:read' },
  { label: '分类管理', to: '/admin/categories', perm: 'category:read' },
  { label: '标签管理', to: '/admin/tags', perm: 'tag:read' },
  { label: '用户管理', to: '/admin/users', perm: 'user:read' },
  { label: '角色管理', to: '/admin/roles', perm: 'role:read' },
  { label: '权限管理', to: '/admin/permissions', perm: 'permission:read' },
  { label: '审计日志', to: '/admin/audit', perm: 'audit:read' },
  { label: '站点设置', to: '/admin/settings', perm: 'settings:read' },
]

export function AdminLayout() {
  const { user, logout, hasPermission } = useAuth()
  const site = useSiteInfo()
  const navigate = useNavigate()

  const visibleNav = NAV.filter((n) => !n.perm || hasPermission(n.perm))

  const doLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen bg-surface-soft">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-canvas md:flex">
        <Link to="/" className="flex items-center gap-2 px-6 py-5 text-ink">
          <SpikeMark className="h-5 w-5 text-primary" />
          <span className="text-[15px] font-medium tracking-tight">{site['site.title']}</span>
        </Link>
        <nav className="flex-1 px-3 py-2">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/admin'}
              className={({ isActive }) =>
                `mb-1 flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-surface-card text-ink' : 'text-body hover:bg-surface-card/60 hover:text-ink'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-hairline px-3 py-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-on-primary">
              {String(user?.displayName ?? user?.username ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{user?.displayName ?? user?.username}</p>
              <p className="truncate text-[12px] text-muted">{user?.roles.join(' / ')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={doLogout}
            className="mt-3 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink hover:border-primary/50"
          >
            退出登录
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline bg-canvas/90 px-6 backdrop-blur">
          <div className="md:hidden">
            <Link to="/" className="flex items-center gap-2 text-ink">
              <SpikeMark className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{site['site.title']}</span>
            </Link>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-muted hover:text-ink">查看站点 ↗</Link>
            <button type="button" onClick={doLogout} className="text-sm text-muted hover:text-ink md:hidden">
              退出
            </button>
          </div>
        </header>

        {/* 移动端导航 */}
        <div className="flex gap-1 overflow-x-auto border-b border-hairline bg-canvas px-3 py-2 md:hidden">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/admin'}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium ${isActive ? 'bg-surface-card text-ink' : 'text-body'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>

        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
