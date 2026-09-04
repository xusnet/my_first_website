import { useCallback, useEffect, useState } from 'react'
import type { Permission, Role } from '../types'
import { del, get, post, put } from '../lib/api'
import { useAuth } from '../store/AuthContext'
import { Alert, Badge, Button, Card, EmptyState, Field, inputCls, Spinner } from '../components/admin-ui'

interface RoleForm {
  code: string
  name: string
  description: string
  permissionCodes: string[]
}

const emptyForm: RoleForm = { code: '', name: '', description: '', permissionCodes: [] }

export function Roles() {
  const { hasPermission } = useAuth()
  const [items, setItems] = useState<Role[]>([])
  const [permissionModules, setPermissionModules] = useState<Array<{ module: string; perms: Permission[] }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<RoleForm>(emptyForm)
  const [editing, setEditing] = useState<Role | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await get<{ items: Role[] }>('/api/roles', true)
      setItems(d.items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    get<{ modules: Array<{ module: string; perms: Permission[] }> }>('/api/permissions', true)
      .then((d) => setPermissionModules(d.modules))
      .catch(() => {})
  }, [load])

  const save = async () => {
    setError('')
    try {
      if (editing) {
        await put(`/api/roles/${editing.id}`, { name: form.name, description: form.description || null }, true)
      } else {
        await post('/api/roles', { ...form, description: form.description || null }, true)
      }
      setShowCreate(false)
      setEditing(null)
      setForm(emptyForm)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const savePermissions = async (role: Role, codes: string[]) => {
    try {
      await put(`/api/roles/${role.id}/permissions`, { permissionCodes: codes }, true)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const remove = async (r: Role) => {
    if (r.is_system) return
    if (!confirm(`确认删除角色「${r.name}」？`)) return
    try {
      await del(`/api/roles/${r.id}`, true)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const togglePermission = (role: Role, code: string) => {
    const has = role.permissions.includes(code)
    savePermissions(role, has ? role.permissions.filter((x) => x !== code) : [...role.permissions, code])
  }

  const toggleAll = (role: Role, codes: string[]) => {
    const allHave = codes.every((c) => role.permissions.includes(c))
    const without = new Set(role.permissions)
    codes.forEach((c) => (allHave ? without.delete(c) : without.add(c)))
    savePermissions(role, [...without])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-md text-ink">角色管理</h1>
          <p className="mt-1 text-sm text-muted">RBAC 角色定义与权限分配</p>
        </div>
        {hasPermission('role:create') && (
          <Button onClick={() => { setForm(emptyForm); setShowCreate(true); }}>新建角色</Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-muted"><Spinner /> 加载中…</div>
      ) : items.length === 0 ? (
        <EmptyState>暂无角色</EmptyState>
      ) : (
        <div className="space-y-6">
          {items.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-medium text-ink">{r.name}</h2>
                  <code className="rounded bg-surface-soft px-2 py-0.5 font-mono text-[12px] text-muted">{r.code}</code>
                  {r.is_system ? <Badge tone="coral">系统内置</Badge> : null}
                  <Badge tone="neutral">{r.userCount} 用户</Badge>
                </div>
                <div className="flex gap-3">
                  {hasPermission('role:update') && (
                    <button type="button" className="text-sm text-ink hover:text-primary" onClick={() => { setEditing(r); setForm({ code: r.code, name: r.name, description: r.description ?? '', permissionCodes: r.permissions }); }}>
                      编辑
                    </button>
                  )}
                  {hasPermission('role:delete') && !r.is_system && (
                    <button type="button" className="text-sm text-error hover:opacity-70" onClick={() => remove(r)}>删除</button>
                  )}
                </div>
              </div>
              {r.description && <p className="mt-2 text-sm text-muted">{r.description}</p>}

              {hasPermission('role:assign-permission') && (
                <div className="mt-5 space-y-4 border-t border-hairline pt-5">
                  {permissionModules.map((m) => (
                    <div key={m.module}>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium uppercase tracking-wide text-muted">{m.module}</span>
                        <button
                          type="button"
                          className="text-[12px] text-primary hover:underline"
                          onClick={() => toggleAll(r, m.perms.map((p) => p.code))}
                        >
                          全选 / 取消
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.perms.map((p) => (
                          <label
                            key={p.id}
                            className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] transition-colors ${
                              r.permissions.includes(p.code)
                                ? 'border-primary/40 bg-primary/10 text-ink'
                                : 'border-hairline bg-canvas text-muted hover:text-ink'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={r.permissions.includes(p.code)}
                              onChange={() => togglePermission(r, p.code)}
                            />
                            {p.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="新建角色" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <Field label="角色编码" hint="小写字母开头，仅含字母数字下划线横线">
              <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="角色名称">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="描述">
              <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="初始权限">
              <div className="flex flex-wrap gap-2">
                {permissionModules.flatMap((m) => m.perms).map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={form.permissionCodes.includes(p.code)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          permissionCodes: e.target.checked ? [...form.permissionCodes, p.code] : form.permissionCodes.filter((x) => x !== p.code),
                        })
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>取消</Button>
              <Button onClick={save}>创建</Button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`编辑角色 · ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="角色名称">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="描述">
              <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={save}>保存</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-hairline bg-canvas p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
