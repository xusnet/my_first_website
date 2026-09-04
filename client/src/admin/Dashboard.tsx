import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../lib/api'
import { Badge, Card, Spinner } from '../components/admin-ui'

interface DashboardData {
  stats: {
    users: number
    posts: number
    published: number
    drafts: number
    categories: number
    tags: number
    auditLogs: number
  }
  recentPosts: Array<{ id: number; title: string; status: string; updated_at: string; author_name: string }>
  recentAudits: Array<{ id: number; username: string | null; action: string; resource: string; result: string; created_at: string }>
}

function Stat({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const inner = (
    <Card className="text-center">
      <p className="display-md text-ink">{value}</p>
      <p className="mt-1 text-[13px] text-muted">{label}</p>
    </Card>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    get<DashboardData>('/api/dashboard', true).then(setData).catch(() => {})
  }, [])

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        <Spinner /> <span className="ml-3">加载中…</span>
      </div>
    )
  }

  const { stats, recentPosts, recentAudits } = data

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display-md text-ink">仪表盘</h1>
        <p className="mt-1 text-sm text-muted">站点内容与系统概览</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="用户" value={stats.users} to="/admin/users" />
        <Stat label="文章" value={stats.posts} to="/admin/posts" />
        <Stat label="已发布" value={stats.published} to="/admin/posts" />
        <Stat label="草稿" value={stats.drafts} to="/admin/posts" />
        <Stat label="分类" value={stats.categories} to="/admin/categories" />
        <Stat label="标签" value={stats.tags} to="/admin/tags" />
        <Stat label="审计日志" value={stats.auditLogs} to="/admin/audit" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-ink">最近文章</h2>
            <Link to="/admin/posts" className="text-sm text-primary hover:underline">全部 →</Link>
          </div>
          <div className="space-y-3">
            {recentPosts.length === 0 && <p className="text-sm text-muted">暂无文章</p>}
            {recentPosts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/admin/posts/${p.id}/edit`} className="truncate text-sm font-medium text-ink hover:text-primary">
                    {p.title}
                  </Link>
                  <p className="text-[12px] text-muted-soft">{p.author_name}</p>
                </div>
                <Badge tone={p.status === 'published' ? 'teal' : p.status === 'draft' ? 'neutral' : 'dark'}>
                  {p.status === 'published' ? '已发布' : p.status === 'draft' ? '草稿' : '已归档'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-ink">最近审计</h2>
            <Link to="/admin/audit" className="text-sm text-primary hover:underline">全部 →</Link>
          </div>
          <div className="space-y-3">
            {recentAudits.length === 0 && <p className="text-sm text-muted">暂无审计记录</p>}
            {recentAudits.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="font-mono text-[12px] text-ink">{a.action}</span>
                  <span className="ml-2 truncate text-muted">{a.username ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-muted-soft">{a.resource}</span>
                  <Badge tone={a.result === 'success' ? 'teal' : 'coral'}>
                    {a.result === 'success' ? '成功' : '失败'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
