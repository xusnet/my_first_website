import { useCallback, useEffect, useState } from 'react'
import type { AuditLog, Paginated } from '../types'
import { get } from '../lib/api'
import { Alert, Badge, Button, Card, EmptyState, inputCls, Spinner } from '../components/admin-ui'

export function AuditLogs() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [result, setResult] = useState('')
  const [chain, setChain] = useState<{ valid: boolean; brokenAt?: number } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (search) q.set('search', search)
      if (action) q.set('action', action)
      if (result) q.set('result', result)
      const d = await get<Paginated<AuditLog>>(`/api/audit?${q}`, true)
      setItems(d.items)
      setTotal(d.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, search, action, result])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    get<{ items: string[] }>('/api/audit/actions', true).then((d) => setActions(d.items)).catch(() => {})
    get<{ valid: boolean; brokenAt?: number }>('/api/audit/verify', true).then(setChain).catch(() => {})
  }, [])

  const pageCount = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-md text-ink">审计日志</h1>
          <p className="mt-1 text-sm text-muted">共 {total} 条 · 哈希链防篡改，可追溯</p>
        </div>
        {chain && (
          <Badge tone={chain.valid ? 'teal' : 'coral'}>
            {chain.valid ? '审计链完整' : `审计链异常 @${chain.brokenAt}`}
          </Badge>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="搜索用户 / 资源 / 详情" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className={`${inputCls} max-w-[180px]`} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">全部操作</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={`${inputCls} max-w-[120px]`} value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }}>
          <option value="">全部结果</option>
          <option value="success">成功</option>
          <option value="failure">失败</option>
        </select>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-muted"><Spinner /> 加载中…</div>
        ) : items.length === 0 ? (
          <div className="p-8"><EmptyState>暂无审计记录</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">时间</th>
                  <th className="px-4 py-3">操作</th>
                  <th className="px-4 py-3">用户</th>
                  <th className="px-4 py-3">资源</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">结果</th>
                  <th className="px-4 py-3">详情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-soft">
                {items.map((a) => (
                  <tr key={a.id} className="align-top hover:bg-surface-soft/50">
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-muted">
                      {new Date(a.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-[12px] text-ink">{a.action}</code>
                    </td>
                    <td className="px-4 py-3 text-muted">{a.username ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{a.resource}{a.resource_id ? `#${a.resource_id}` : ''}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-muted-soft">{a.ip ?? '—'}</td>
                    <td className="px-4 py-3"><Badge tone={a.result === 'success' ? 'teal' : 'coral'}>{a.result === 'success' ? '成功' : '失败'}</Badge></td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-[12px] text-muted-soft" title={a.detail ?? ''}>
                      {a.detail ?? '—'}
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

      <Card>
        <h2 className="mb-2 text-base font-medium text-ink">关于审计日志</h2>
        <p className="text-sm leading-relaxed text-body">
          所有敏感操作（登录、口令修改、用户/角色/权限变更、文章发布删除等）均被记录。日志以哈希链组织——每条记录
          的 <code className="font-mono">log_hash</code> 由前一条记录哈希与本条内容计算得出，任何历史记录被篡改都会导致后续哈希断裂，
          从而实现防篡改与可追溯。
        </p>
      </Card>
    </div>
  )
}
