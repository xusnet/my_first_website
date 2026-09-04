import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../types'
import { del, get, post, put } from '../lib/api'
import { useAuth } from '../store/AuthContext'
import { Alert, Button, Card, EmptyState, Field, inputCls, Spinner } from '../components/admin-ui'

function useCrud(path: string) {
  const { hasPermission } = useAuth()
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await get<{ items: Category[] }>(path, true)
      setItems(d.items)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => { setName(''); setSlug(''); setDescription(''); setEditing(null) }

  const save = async () => {
    setError('')
    try {
      if (editing) {
        await put(`${path}/${editing.id}`, { name, slug: slug || undefined, description: description || null }, true)
      } else {
        await post(path, { name, slug: slug || undefined, description: description || null }, true)
      }
      reset()
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const remove = async (c: Category) => {
    if (!confirm(`确认删除「${c.name}」？关联关系将一并移除。`)) return
    try {
      await del(`${path}/${c.id}`, true)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return { items, loading, error, setError, name, setName, slug, setSlug, description, setDescription, editing, setEditing, save, remove, reset, hasPermission }
}

export function Categories() {
  const c = useCrud('/api/categories')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-md text-ink">分类管理</h1>
        <p className="mt-1 text-sm text-muted">文章分类</p>
      </div>
      {c.error && <Alert tone="error">{c.error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-0">
          {c.loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-muted"><Spinner /> 加载中…</div>
          ) : c.items.length === 0 ? (
            <div className="p-8"><EmptyState>暂无分类</EmptyState></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-hairline bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3">名称</th>
                    <th className="px-5 py-3">Slug</th>
                    <th className="px-5 py-3">文章数</th>
                    <th className="px-5 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-soft">
                  {c.items.map((x) => (
                    <tr key={x.id} className="hover:bg-surface-soft/50">
                      <td className="px-5 py-3 font-medium text-ink">{x.name}</td>
                      <td className="px-5 py-3 font-mono text-[12px] text-muted">/{x.slug}</td>
                      <td className="px-5 py-3 text-muted">{x.post_count}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-3 text-sm">
                          {c.hasPermission('category:update') && (
                            <button type="button" className="text-ink hover:text-primary" onClick={() => { c.setEditing(x); c.setName(x.name); c.setSlug(x.slug); c.setDescription(x.description ?? '') }}>编辑</button>
                          )}
                          {c.hasPermission('category:delete') && (
                            <button type="button" className="text-error hover:opacity-70" onClick={() => c.remove(x)}>删除</button>
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
        <Card>
          <h2 className="text-base font-medium text-ink">{c.editing ? '编辑分类' : '新建分类'}</h2>
          <div className="mt-4 space-y-3">
            <Field label="名称"><input className={inputCls} value={c.name} onChange={(e) => c.setName(e.target.value)} /></Field>
            <Field label="Slug" hint="留空自动生成"><input className={inputCls} value={c.slug} onChange={(e) => c.setSlug(e.target.value)} /></Field>
            <Field label="描述"><input className={inputCls} value={c.description} onChange={(e) => c.setDescription(e.target.value)} /></Field>
            <div className="flex gap-2 pt-1">
              {c.hasPermission('category:create') && <Button onClick={c.save}>{c.editing ? '保存' : '创建'}</Button>}
              {c.editing && <Button variant="secondary" onClick={c.reset}>取消</Button>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export function Tags() {
  const c = useCrud('/api/tags')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-md text-ink">标签管理</h1>
        <p className="mt-1 text-sm text-muted">文章标签</p>
      </div>
      {c.error && <Alert tone="error">{c.error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-0">
          {c.loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-muted"><Spinner /> 加载中…</div>
          ) : c.items.length === 0 ? (
            <div className="p-8"><EmptyState>暂无标签</EmptyState></div>
          ) : (
            <div className="flex flex-wrap gap-2 p-5">
              {c.items.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-full border border-hairline bg-canvas pl-3 pr-1.5 py-1">
                  <span className="text-sm text-ink">#{t.name}</span>
                  <span className="text-[12px] text-muted-soft">{t.post_count}</span>
                  {c.hasPermission('tag:update') && (
                    <button type="button" className="text-[12px] text-muted hover:text-ink" onClick={() => { c.setEditing(t); c.setName(t.name) }}>改</button>
                  )}
                  {c.hasPermission('tag:delete') && (
                    <button type="button" className="text-[12px] text-error hover:opacity-70" onClick={() => c.remove(t)}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="text-base font-medium text-ink">{c.editing ? '编辑标签' : '新建标签'}</h2>
          <div className="mt-4 space-y-3">
            <Field label="名称"><input className={inputCls} value={c.name} onChange={(e) => c.setName(e.target.value)} /></Field>
            <div className="flex gap-2 pt-1">
              {c.hasPermission('tag:create') && <Button onClick={c.save}>{c.editing ? '保存' : '创建'}</Button>}
              {c.editing && <Button variant="secondary" onClick={c.reset}>取消</Button>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
