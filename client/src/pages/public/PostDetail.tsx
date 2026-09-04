import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { PostDetail } from '../../types'
import { get } from '../../lib/api'
import { Markdown } from '../../components/Markdown'

export function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<PostDetail | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    get<PostDetail>(`/api/public/posts/${slug}`)
      .then(setPost)
      .catch((err: unknown) => {
        if ((err as { status?: number }).status === 404) setNotFound(true)
      })
  }, [slug])

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="display-lg text-ink">文章不存在</h1>
        <p className="mt-4 text-body">你访问的文章可能已被删除或尚未发布。</p>
        <Link to="/" className="mt-8 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-on-primary">
          返回首页
        </Link>
      </div>
    )
  }

  if (!post) {
    return <p className="py-24 text-center text-muted">加载中…</p>
  }

  const date = post.published_at ? new Date(post.published_at).toLocaleDateString('zh-CN') : ''

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-wrap items-center gap-2">
        {post.categories.map((c) => (
          <Link key={c.slug} to={`/category/${c.slug}`} className="rounded-full bg-surface-card px-3 py-1 text-[12px] font-medium tracking-[1px] text-ink uppercase">
            {c.name}
          </Link>
        ))}
      </div>
      <h1 className="display-xl mt-5 text-ink">{post.title}</h1>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>{post.author_name ?? post.author_username}</span>
        {date && (
          <>
            <span className="text-muted-soft">·</span>
            <span>{date}</span>
          </>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {post.tags.map((t) => (
          <Link key={t.slug} to={`/tag/${t.slug}`} className="text-[13px] text-muted hover:text-primary">
            #{t.name}
          </Link>
        ))}
      </div>

      <div className="mt-10 border-t border-hairline pt-10">
        <Markdown content={post.content} />
      </div>

      <div className="mt-16 rounded-lg bg-surface-card p-6 text-center">
        <p className="text-sm text-body">感谢阅读。欢迎分享你的想法。</p>
        <Link to="/" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          返回首页 →
        </Link>
      </div>
    </article>
  )
}
