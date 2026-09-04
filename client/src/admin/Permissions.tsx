import { useEffect, useState } from 'react'
import type { Permission } from '../types'
import { get } from '../lib/api'
import { Card, EmptyState, Spinner } from '../components/admin-ui'

export function Permissions() {
  const [modules, setModules] = useState<Array<{ module: string; perms: Permission[] }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get<{ modules: Array<{ module: string; perms: Permission[] }> }>('/api/permissions', true)
      .then((d) => setModules(d.modules))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center gap-3 py-16 text-muted"><Spinner /> 加载中…</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-md text-ink">权限管理</h1>
        <p className="mt-1 text-sm text-muted">系统权限清单（只读），权限由角色分配</p>
      </div>
      {modules.length === 0 ? (
        <EmptyState>暂无权限数据</EmptyState>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {modules.map((m) => (
            <Card key={m.module}>
              <h2 className="mb-4 text-base font-medium text-ink">
                {m.module}
                <span className="ml-2 text-[12px] font-normal text-muted-soft">{m.perms.length} 项</span>
              </h2>
              <div className="space-y-2">
                {m.perms.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md bg-surface-soft/60 px-3 py-2">
                    <div>
                      <p className="text-sm text-ink">{p.name}</p>
                      {p.description && <p className="text-[12px] text-muted-soft">{p.description}</p>}
                    </div>
                    <code className="font-mono text-[12px] text-muted">{p.code}</code>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
