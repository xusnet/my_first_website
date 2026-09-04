import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Paginated, PostSummary } from '../types'
import { del, get, post } from '../lib/api'
import { useAuth } from '../store/AuthContext'
import { Alert, Badge, Button, Card, EmptyState, inputCls, Spinner } from '../components/admin-ui'

const STATUS: Record<string, { label: string; tone: 'teal' | 'neutral' | 'dark' }> = {
  published: { label: '已发布', tone: 'teal' },
  draft: { label: '草稿', tone: 'neutral' },
  archived: { label: '已归档', tone: 'dark' },
}

export function Posts() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<PostSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (search) q.set('search', search)
      if (status) q.set('status', status)
      const d = await get<Paginated<PostSummary>>(`/api/posts?${q}`, true)
      setItems(d.items)
      setTotal(d.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (p: PostSummary) => {
    if (!confirm(`确认删除文章「${p.title}」？`)) return
    try {
      await del(`/api/posts/${p.id}`, true)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const publish = async (p: PostSummary, s: 'published' | 'archived' | 'draft') => {
    try {
      await post(`/api/posts/${p.id}/publish`, { status: s }, true)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const pageCount = Math.ceil(total / 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-md text-ink">文章管理</h1>
          <p className="mt-1 text-sm text-muted">共 {total} 篇 · Markdown 编写</p>
        </div>
        {hasPermission('post:create') && (
          <Button onClick={() => navigate('/admin/posts/new')}>写新文章</Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="搜索标题 / 摘要" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className={`${inputCls} max-w-[140px]`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="archived">已归档</option>
        </select>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-muted"><Spinner /> 加载中…</div>
        ) : items.length === 0 ? (
          <div className="p-8"><EmptyState>暂无文章，点击「写新文章」开始创作</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">标题</th>
                  <th className="px-5 py-3">分类</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">作者</th>
                  <th className="px-5 py-3">更新</th>
                  <th className="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-soft">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-soft/50">
                    <td className="max-w-[280px] px-5 py-3">
                      <Link to={`/admin/posts/${p.id}/edit`} className="block truncate font-medium text-ink hover:text-primary">{p.title}</Link>
                      <span className="font-mono text-[12px] text-muted-soft">/{p.slug}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.categories.map((c) => <Badge key={c.slug} tone="neutral">{c.name}</Badge>)}
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge tone={STATUS[p.status]?.tone ?? 'neutral'}>{STATUS[p.status]?.label ?? p.status}</Badge></td>
                    <td className="px-5 py-3 text-muted">{p.author_name ?? p.author_username}</td>
                    <td className="px-5 py-3 text-[12px] text-muted">{new Date(p.updated_at).toLocaleDateString('zh-CN')}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-3 text-sm">
                        {hasPermission('post:update') && (
                          <Link to={`/admin/posts/${p.id}/edit`} className="text-ink hover:text-primary">编辑</Link>
                        )}
                        {hasPermission('post:publish') && p.status !== 'published' && (
                          <button type="button" className="text-accent-teal hover:opacity-70" onClick={() => publish(p, 'published')}>发布</button>
                        )}
                        {hasPermission('post:publish') && p.status === 'published' && (
                          <button type="button" className="text-muted hover:text-ink" onClick={() => publish(p, 'draft')}>下架</button>
                        )}
                        {hasPermission('post:delete') && (
                          <button type="button" className="text-error hover:opacity-70" onClick={() => remove(p)}>删除</button>
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
    </div>
  )
}
