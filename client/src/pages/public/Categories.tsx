import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Category, Paginated, PostSummary, Tag } from '../../types'
import { get } from '../../lib/api'
import { PostCard } from './Home'

export function CategoryListPage() {
  const [categories, setCategories] = useState<Category[]>([])
  useEffect(() => {
    get<{ items: Category[] }>('/api/public/categories').then((d) => setCategories(d.items)).catch(() => {})
  }, [])
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="display-lg text-ink">文章分类</h1>
      <p className="mt-4 max-w-xl text-body">按主题浏览所有文章。</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            to={`/category/${c.slug}`}
            className="group rounded-lg border border-hairline bg-canvas p-8 transition-colors hover:border-primary/40"
          >
            <h2 className="text-lg font-medium text-ink group-hover:text-primary">{c.name}</h2>
            {c.description && <p className="mt-2 text-sm leading-relaxed text-body">{c.description}</p>}
            <p className="mt-4 text-[13px] text-muted-soft">{c.post_count} 篇文章</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    get<Paginated<PostSummary>>(`/api/public/posts?category=${slug}&pageSize=50`)
      .then((d) => setPosts(d.items))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [slug])
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <Link to="/categories" className="text-sm text-muted hover:text-primary">
        ← 全部分类
      </Link>
      <h1 className="display-lg mt-4 text-ink">分类：{slug}</h1>
      <div className="mt-10 space-y-6">
        {loading ? (
          <p className="py-10 text-center text-muted">加载中…</p>
        ) : posts.length === 0 ? (
          <p className="rounded-lg border border-hairline bg-canvas p-10 text-center text-body">该分类暂无文章</p>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </div>
  )
}

export function TagPage() {
  const { slug } = useParams<{ slug: string }>()
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [tag, setTag] = useState<Tag | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    get<{ items: Tag[] }>('/api/public/tags').then((d) => {
      setTag(d.items.find((t) => t.slug === slug) ?? null)
    }).catch(() => {})
    get<Paginated<PostSummary>>(`/api/public/posts?tag=${slug}&pageSize=50`)
      .then((d) => setPosts(d.items))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [slug])
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="display-lg text-ink">标签：{tag?.name ?? slug}</h1>
      {tag && <p className="mt-3 text-sm text-muted-soft">{tag.post_count} 篇文章</p>}
      <div className="mt-10 space-y-6">
        {loading ? (
          <p className="py-10 text-center text-muted">加载中…</p>
        ) : posts.length === 0 ? (
          <p className="rounded-lg border border-hairline bg-canvas p-10 text-center text-body">该标签暂无文章</p>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </div>
  )
}
