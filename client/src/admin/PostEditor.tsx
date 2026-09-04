import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Category, PostDetail, Tag } from '../types'
import { get, post, put } from '../lib/api'
import { useAuth } from '../store/AuthContext'
import { Alert, Button, Field, inputCls } from '../components/admin-ui'
import { Markdown } from '../components/Markdown'

export function PostEditor() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [tagNames, setTagNames] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    get<{ items: Category[] }>('/api/categories', true).then((d) => setCategories(d.items)).catch(() => {})
    get<{ items: Tag[] }>('/api/tags', true).then((d) => setTags(d.items)).catch(() => {})
    if (isEdit) {
      get<PostDetail>(`/api/posts/${id}`, true)
        .then((p) => {
          setTitle(p.title)
          setSlug(p.slug)
          setExcerpt(p.excerpt ?? '')
          setContent(p.content)
          setStatus(p.status === 'published' ? 'published' : 'draft')
          setCategoryIds(p.categories.map((c) => c.id!).filter(Boolean))
          setTagNames(p.tags.map((t) => t.name).join(', '))
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoaded(true))
    } else {
      setLoaded(true)
    }
  }, [id, isEdit])

  const save = async (targetStatus: 'draft' | 'published') => {
    setError('')
    setBusy(true)
    try {
      const body = {
        title,
        slug: slug || undefined,
        excerpt: excerpt || null,
        content,
        status: targetStatus,
        categoryIds,
        tagNames: tagNames.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      }
      if (isEdit) {
        await put(`/api/posts/${id}`, body, true)
      } else {
        await post('/api/posts', body, true)
      }
      navigate('/admin/posts')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return <p className="py-20 text-center text-muted">加载中…</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-md text-ink">{isEdit ? '编辑文章' : '写新文章'}</h1>
          <p className="mt-1 text-sm text-muted">使用 Markdown 编写，支持实时预览</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPreview((v) => !v)}>{preview ? '编辑' : '预览'}</Button>
          <Button variant="secondary" onClick={() => save('draft')} disabled={busy}>存草稿</Button>
          {hasPermission('post:publish') && (
            <Button onClick={() => save('published')} disabled={busy}>
              {status === 'published' && isEdit ? '保存并发布' : '发布'}
            </Button>
          )}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Field label="标题">
            <input className={`${inputCls} text-lg`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Slug" hint="留空则自动生成">
            <input className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <Field label="摘要">
            <textarea className={`${inputCls} h-20 resize-none`} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </Field>

          <div className="rounded-lg border border-hairline bg-canvas">
            {preview ? (
              <div className="p-6">
                <h1 className="display-md mb-4 text-ink">{title || '（无标题）'}</h1>
                {content ? (
                  <Markdown content={content} />
                ) : (
                  <p className="py-10 text-center text-muted">暂无内容</p>
                )}
              </div>
            ) : (
              <textarea
                className="min-h-[420px] w-full resize-y bg-transparent p-6 font-mono text-sm leading-relaxed text-ink outline-none"
                placeholder="在此输入 Markdown 内容…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Field label="状态">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </Field>
          <Field label="分类">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={categoryIds.includes(c.id)}
                    onChange={(e) =>
                      setCategoryIds(e.target.checked ? [...categoryIds, c.id] : categoryIds.filter((x) => x !== c.id))
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="标签" hint="逗号分隔；不存在的标签将自动创建">
            <input className={inputCls} value={tagNames} onChange={(e) => setTagNames(e.target.value)} placeholder="TypeScript, MariaDB" />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">已有标签</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const names = tagNames.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
                    if (!names.includes(t.name)) setTagNames([...names, t.name].join(', '))
                  }}
                  className="rounded-full bg-surface-soft px-2.5 py-1 text-[12px] text-muted hover:bg-surface-card hover:text-ink"
                >
                  #{t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
