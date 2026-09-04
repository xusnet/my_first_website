import { useCallback, useEffect, useState } from 'react'
import type { AdminUser, Paginated, Role } from '../types'
import { del, get, post, put } from '../lib/api'
import { useAuth } from '../store/AuthContext'
import { Alert, Badge, Button, Card, EmptyState, Field, inputCls, Spinner } from '../components/admin-ui'

const STATUS_LABEL: Record<string, { label: string; tone: 'teal' | 'coral' | 'neutral' | 'dark' }> = {
  active: { label: '正常', tone: 'teal' },
  disabled: { label: '已禁用', tone: 'neutral' },
  locked: { label: '已锁定', tone: 'coral' },
}

export function Users() {
  const { user: me, hasPermission } = useAuth()
  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ username: '', email: '', password: '', displayName: '', roleIds: [] as number[] })
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await get<Paginated<AdminUser>>(`/api/users?page=${page}&pageSize=10&search=${encodeURIComponent(search)}`, true)
      setItems(d.items)
      setTotal(d.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    get<{ items: Role[] }>('/api/roles', true).then((d) => setRoles(d.items)).catch(() => {})
  }, [])

  const createUser = async () => {
    setError('')
    try {
      await post('/api/users', createForm, true)
      setShowCreate(false)
      setCreateForm({ username: '', email: '', password: '', displayName: '', roleIds: [] })
      setPage(1)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const updateUser = async () => {
    if (!editing) return
    setError('')
    try {
      await put(`/api/users/${editing.id}`, {
        displayName: editing.display_name,
        email: editing.email,
        status: editing.status,
      }, true)
      setEditing(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const deleteUser = async (u: AdminUser) => {
    if (!confirm(`确认删除用户「${u.username}」？此操作不可恢复。`)) return
    try {
      await del(`/api/users/${u.id}`, true)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const assignRoles = async (u: AdminUser, roleIds: number[]) => {
    try {
      await put(`/api/users/${u.id}/roles`, { roleIds }, true)
      setNotice(`已更新「${u.username}」的角色`)
      setTimeout(() => setNotice(''), 3000)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const resetPassword = async () => {
    if (!resetTarget) return
    try {
      const r = await post<{ ok: boolean; password?: string }>(`/api/users/${resetTarget.id}/reset-password`, {}, true)
      const pwd = r.password ? ` 新口令：${r.password}` : ''
      alert(`已重置「${resetTarget.username}」的口令，该用户下次登录需强制改密。${pwd}`)
      setResetTarget(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const pageCount = Math.ceil(total / 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-md text-ink">用户管理</h1>
          <p className="mt-1 text-sm text-muted">共 {total} 个账号</p>
        </div>
        {hasPermission('user:create') && (
          <Button onClick={() => setShowCreate(true)}>新建用户</Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="flex gap-2">
        <input
          className={`${inputCls} max-w-xs`}
          placeholder="搜索用户名 / 邮箱 / 昵称"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-muted">
            <Spinner /> 加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8"><EmptyState>暂无用户</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">用户</th>
                  <th className="px-5 py-3">角色</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">最近登录</th>
                  <th className="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-soft">
                {items.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-soft/50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">
                        {u.display_name ?? u.username}
                        {u.is_superadmin ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">超级管理员</span> : null}
                      </div>
                      <div className="text-[12px] text-muted">@{u.username} · {u.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.map((r) => (
                          <select
                            key={r.code}
                            className="rounded-full border border-hairline bg-canvas px-2 py-0.5 text-[12px] text-ink"
                            value={r.code}
                            disabled={!hasPermission('user:assign-role')}
                            onChange={async (e) => {
                              const target = roles.find((x) => x.code === e.target.value)
                              if (!target) return
                              const next = u.roles.filter((x) => x.code !== r.code).map((x) => roles.find((y) => y.code === x.code)!.id)
                              if (target.id) next.push(target.id)
                              await assignRoles(u, next)
                            }}
                          >
                            {roles.map((rr) => (
                              <option key={rr.id} value={rr.code}>{rr.name}</option>
                            ))}
                          </select>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_LABEL[u.status]?.tone ?? 'neutral'}>{STATUS_LABEL[u.status]?.label ?? u.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-muted">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('zh-CN') : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {hasPermission('user:update') && (
                          <button type="button" className="text-sm text-ink hover:text-primary" onClick={() => setEditing(u)}>编辑</button>
                        )}
                        {hasPermission('user:reset-password') && (
                          <button type="button" className="text-sm text-ink hover:text-primary" onClick={() => setResetTarget(u)}>重置口令</button>
                        )}
                        {hasPermission('user:delete') && !u.is_superadmin && u.id !== me?.id && (
                          <button type="button" className="text-sm text-error hover:opacity-70" onClick={() => deleteUser(u)}>删除</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
          <span className="px-3 text-sm text-muted">{page} / {pageCount}</span>
          <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>下一页</Button>
        </div>
      )}

      {showCreate && (
        <Modal title="新建用户" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <Field label="用户名">
              <input className={inputCls} value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} />
            </Field>
            <Field label="邮箱">
              <input className={inputCls} type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            </Field>
            <Field label="显示名称">
              <input className={inputCls} value={createForm.displayName} onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })} />
            </Field>
            <Field label="初始口令" hint="留空则自动生成强口令；新用户首次登录需强制改密">
              <input className={inputCls} value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            </Field>
            <Field label="角色">
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={createForm.roleIds.includes(r.id)}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          roleIds: e.target.checked ? [...createForm.roleIds, r.id] : createForm.roleIds.filter((x) => x !== r.id),
                        })
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>取消</Button>
              <Button onClick={createUser}>创建</Button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`编辑用户 · ${editing.username}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="显示名称">
              <input className={inputCls} value={editing.display_name ?? ''} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} />
            </Field>
            <Field label="邮箱">
              <input className={inputCls} type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label="状态">
              <select className={inputCls} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as AdminUser['status'] })}>
                <option value="active">正常</option>
                <option value="disabled">禁用</option>
                <option value="locked">锁定</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={updateUser}>保存</Button>
            </div>
          </div>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`重置口令 · ${resetTarget.username}`} onClose={() => setResetTarget(null)}>
          <p className="text-sm text-body">
            将重置「{resetTarget.username}」的口令为随机强口令，并强制其下次登录时修改。该操作会被记录到审计日志。
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetTarget(null)}>取消</Button>
            <Button onClick={resetPassword}>确认重置</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-hairline bg-canvas p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
