import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { Alert, Button, Field, inputCls, Spinner } from '../components/admin-ui'
import { SpikeMark } from '../components/SpikeMark'
import { post } from '../lib/api'

export function ChangePassword() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) {
      setError('两次输入的新口令不一致')
      return
    }
    setBusy(true)
    try {
      await post('/api/auth/change-password', { oldPassword, newPassword }, true)
      await logout()
      navigate('/admin/login', { replace: true })
    } catch (err) {
      setError((err as Error).message || '修改失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <SpikeMark className="h-8 w-8 text-primary" />
          <h1 className="mt-3 text-xl font-medium text-ink">设置新口令</h1>
          <p className="mt-1 text-center text-sm text-muted">
            欢迎，{user?.displayName ?? user?.username}。出于安全考虑，请先修改初始口令。
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5 rounded-lg border border-hairline bg-canvas p-8 shadow-sm">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="原口令">
            <input type="password" className={inputCls} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label="新口令" hint="至少 12 位，须含大写、小写、数字与特殊字符，且不与近期口令重复">
            <input type="password" className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required />
          </Field>
          <Field label="确认新口令">
            <input type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Spinner /> : '确认修改并重新登录'}
          </Button>
        </form>
      </div>
    </div>
  )
}
