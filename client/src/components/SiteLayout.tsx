import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { SpikeMark } from './SpikeMark'
import { useSiteInfo } from '../lib/site'
import { useAuth } from '../store/AuthContext'

const NAV = [
  { label: '首页', to: '/' },
  { label: '分类', to: '/categories' },
  { label: '关于', to: '/about' },
]

export function SiteLayout() {
  const site = useSiteInfo()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const close = () => setOpen(false)

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-hairline-soft bg-canvas/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-ink" onClick={close}>
            <SpikeMark className="h-5 w-5 text-primary" />
            <span className="text-[17px] font-medium tracking-tight">{site['site.title']}</span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${isActive ? 'text-ink' : 'text-body hover:text-ink'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </div>

          <div className="hidden items-center gap-4 md:flex">
            {user ? (
              <Link
                to="/admin"
                className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-on-primary transition-colors active:bg-primary-active"
              >
                管理后台
              </Link>
            ) : (
              <Link
                to="/admin/login"
                className="inline-flex h-10 items-center rounded-md border border-hairline bg-canvas px-5 text-sm font-medium text-ink"
              >
                登录
              </Link>
            )}
          </div>

          <button
            type="button"
            aria-label="打开菜单"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-ink md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </nav>

        {open && (
          <div className="border-t border-hairline-soft bg-canvas px-6 pb-8 pt-4 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={close}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-3 text-[15px] font-medium ${isActive ? 'bg-surface-card text-ink' : 'text-body hover:bg-surface-card hover:text-ink'}`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-hairline-soft pt-5">
              <Link
                to={user ? '/admin' : '/admin/login'}
                onClick={close}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary text-sm font-medium text-on-primary active:bg-primary-active"
              >
                {user ? '管理后台' : '登录 / 管理后台'}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet key={location.pathname} />
      </main>

      <footer className="bg-surface-dark">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <Link to="/" className="flex w-fit items-center gap-2 text-on-dark">
            <SpikeMark className="h-5 w-5" />
            <span className="text-[16px] font-medium tracking-tight">{site['site.title']}</span>
          </Link>
          <div className="mt-6 flex flex-wrap gap-6 text-sm text-on-dark-soft">
            <Link to="/" className="hover:text-on-dark">首页</Link>
            <Link to="/categories" className="hover:text-on-dark">分类</Link>
            <Link to="/about" className="hover:text-on-dark">关于</Link>
            <Link to="/admin/login" className="hover:text-on-dark">管理后台</Link>
          </div>
          <div className="mt-8 border-t border-on-dark-soft/15 pt-6 text-[13px] text-on-dark-soft">
            {site['site.footer']}
          </div>
          <div className="mt-3 text-center text-[13px] text-on-dark-soft">
            <a
              href="http://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-on-dark"
            >
              粤ICP备20067519号-1
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
