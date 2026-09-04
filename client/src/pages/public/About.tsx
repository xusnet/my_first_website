import { Link } from 'react-router-dom'
import { useSiteInfo } from '../../lib/site'
import { SpikeMark } from '../../components/SpikeMark'

export function AboutPage() {
  const site = useSiteInfo()
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center gap-4">
        {site['site.avatar_url'] ? (
          <img src={site['site.avatar_url']} alt={site['site.author']} className="h-16 w-16 rounded-full" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-display text-2xl text-on-primary">
            {site['site.author'].slice(0, 1)}
          </span>
        )}
        <div>
          <h1 className="display-md text-ink">{site['site.author']}</h1>
          <p className="text-sm text-muted">{site['site.subtitle']}</p>
        </div>
      </div>

      <div className="mt-10 rounded-lg border border-hairline bg-canvas p-8">
        <p className="leading-relaxed text-body">{site['site.description']}</p>
      </div>

      <h2 className="display-sm mt-12 text-ink">关于本站</h2>
      <div className="prose-blog mt-6">
        <p>
          本站是 <strong>{site['site.title']}</strong>，一个基于 <strong>Node.js + Express</strong> 与{' '}
          <strong>React</strong> 构建的个人技术博客。
        </p>
        <p>技术栈：</p>
        <ul>
          <li>数据库：MariaDB 11（最新稳定版）</li>
          <li>缓存：Redis 7</li>
          <li>安全：基于等保三级要求（复杂口令、登录失败锁定、RBAC、可追溯审计日志）</li>
        </ul>
        <p>内置 CMS 内容管理后台，支持用户 / 角色 / 权限 / 文章 / 分类 / 标签管理与审计日志。</p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link to="/" className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-on-primary">
          浏览文章
        </Link>
        <Link to="/categories" className="inline-flex h-10 items-center rounded-md border border-hairline bg-canvas px-5 text-sm font-medium text-ink">
          查看文章分类
        </Link>
      </div>

      <div className="mt-12 flex items-center gap-2 text-muted">
        <SpikeMark className="h-4 w-4" />
        <span className="text-sm">{site['site.footer']}</span>
      </div>
    </div>
  )
}
