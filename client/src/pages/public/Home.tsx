import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Category, Paginated, PostSummary, SiteInfo, Tag } from '../../types'
import { get } from '../../lib/api'
import { useSiteInfo } from '../../lib/site'

export function PostCard({ post }: { post: PostSummary }) {
  const date = post.published_at ? new Date(post.published_at).toLocaleDateString('zh-CN') : ''
  return (
    <article className="rounded-lg border border-hairline bg-canvas p-8 transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-center gap-2">
        {post.categories.map((c) => (
          <Link
            key={c.slug}
            to={`/category/${c.slug}`}
            className="rounded-full bg-surface-card px-3 py-1 text-[12px] font-medium tracking-[1px] text-ink uppercase hover:bg-surface-cream-strong"
          >
            {c.name}
          </Link>
        ))}
        {date && <span className="ml-auto text-[13px] text-muted-soft">{date}</span>}
      </div>
      <Link to={`/post/${post.slug}`}>
        <h2 className="display-md mt-4 text-ink hover:text-primary">{post.title}</h2>
      </Link>
      {post.excerpt && <p className="mt-3 leading-relaxed text-body">{post.excerpt}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {post.tags.map((t) => (
          <Link key={t.slug} to={`/tag/${t.slug}`} className="text-[13px] text-muted hover:text-primary">
            #{t.name}
          </Link>
        ))}
      </div>
    </article>
  )
}

export function Sidebar({ site }: { site: SiteInfo }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  useEffect(() => {
    get<{ items: Category[] }>('/api/public/categories').then((d) => setCategories(d.items)).catch(() => {})
    get<{ items: Tag[] }>('/api/public/tags').then((d) => setTags(d.items)).catch(() => {})
  }, [])
  return (
    <aside className="space-y-6">
      <div className="rounded-lg bg-surface-card p-6">
        <div className="flex items-center gap-3">
          {site['site.avatar_url'] ? (
            <img src={site['site.avatar_url']} alt={site['site.author']} className="h-12 w-12 rounded-full" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-display text-lg text-on-primary">
              {site['site.author'].slice(0, 1)}
            </span>
          )}
          <div>
            <p className="font-medium text-ink">{site['site.author']}</p>
            <p className="text-[13px] text-muted">个人技术博客</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-body">{site['site.description']}</p>
      </div>

      <div className="rounded-lg border border-hairline bg-canvas p-6">
        <h3 className="text-[13px] font-medium uppercase tracking-[1.5px] text-muted">分类</h3>
        <div className="mt-4 flex flex-col gap-2">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/category/${c.slug}`}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-body hover:bg-surface-card hover:text-ink"
            >
              <span>{c.name}</span>
              <span className="text-[12px] text-muted-soft">{c.post_count}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-hairline bg-canvas p-6">
        <h3 className="text-[13px] font-medium uppercase tracking-[1.5px] text-muted">标签</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((t) => (
            <Link
              key={t.id}
              to={`/tag/${t.slug}`}
              className="rounded-full bg-surface-soft px-3 py-1 text-[13px] text-body hover:bg-surface-card hover:text-ink"
            >
              #{t.name}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}

export function Home() {
  const site = useSiteInfo()
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    get<Paginated<PostSummary>>(`/api/public/posts?page=${page}&pageSize=6`)
      .then((d) => {
        setPosts(d.items)
        setTotal(d.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    window.scrollTo({ top: 0 })
  }, [page])

  const pageCount = Math.ceil(total / 6)

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-16">
      <header className="max-w-2xl">
        <p className="text-sm font-medium tracking-wide text-primary">{site['site.subtitle']}</p>
        <h1 className="display-xl mt-4 text-ink">{site['site.title']}</h1>
        <p className="mt-5 text-lg leading-relaxed text-body">{site['site.description']}</p>
      </header>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_300px]">
        <div>
          {loading ? (
            <p className="py-10 text-center text-muted">加载中…</p>
          ) : posts.length === 0 ? (
            <p className="rounded-lg border border-hairline bg-canvas p-10 text-center text-body">暂无文章</p>
          ) : (
            <div className="space-y-6">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex h-10 items-center rounded-md border border-hairline bg-canvas px-4 text-sm text-ink disabled:opacity-40"
              >
                上一页
              </button>
              <span className="px-3 text-sm text-muted">
                {page} / {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-10 items-center rounded-md border border-hairline bg-canvas px-4 text-sm text-ink disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          )}
        </div>

        <Sidebar site={site} />
      </div>
    </div>
  )
}
