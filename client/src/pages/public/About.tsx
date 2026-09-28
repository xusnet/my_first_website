import { Link } from 'react-router-dom'
import { useSiteInfo } from '../../lib/site'
import { SpikeMark } from '../../components/SpikeMark'
import { Markdown } from '../../components/Markdown'

export function AboutPage() {
  const site = useSiteInfo()
  const aboutContent = (site['about.content'] || '').trim()
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
        {aboutContent ? (
          <Markdown content={aboutContent} />
        ) : (
          <p className="leading-relaxed text-body">{site['site.description']}</p>
        )}
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
