import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { Alert, Button, Field, inputCls, Spinner } from '../components/admin-ui'
import { SpikeMark } from '../components/SpikeMark'

export function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) {
    return <Navigate to={user.mustChangePassword ? '/admin/change-password' : '/admin'} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await login(username.trim(), password)
      navigate(u.mustChangePassword ? '/admin/change-password' : '/admin', { replace: true })
    } catch (err) {
      setError((err as Error).message || '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <SpikeMark className="h-8 w-8 text-primary" />
          <h1 className="mt-3 text-xl font-medium text-ink">Clark.Gong 管理后台</h1>
          <p className="mt-1 text-sm text-muted">请使用管理员账号登录</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5 rounded-lg border border-hairline bg-canvas p-8 shadow-sm">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="用户名 / 邮箱">
            <input
              className={inputCls}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="口令">
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Spinner /> : '登 录'}
          </Button>
        </form>
        <p className="mt-4 text-center text-[12px] text-muted-soft">连续登录失败将被临时锁定 · 口令须满足复杂口令要求</p>
      </div>
    </div>
  )
}
