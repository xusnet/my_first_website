import { useEffect, useState } from 'react'
import type { SiteInfo } from '../types'
import { get, put } from '../lib/api'
import { useAuth } from '../store/AuthContext'
import { Alert, Button, Card, Field, inputCls } from '../components/admin-ui'

export function Settings() {
  const { user, hasPermission, refreshUser } = useAuth()
  const [site, setSite] = useState<SiteInfo | null>(null)
  const [profile, setProfile] = useState({ displayName: '', email: '' })
  const [me, setMe] = useState({ theme: 'light', language: 'zh-CN', emailNotifications: true, bio: '', socialGithub: '', socialTwitter: '', socialEmail: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (hasPermission('settings:read')) {
      get<SiteInfo>('/api/settings/site', true).then(setSite).catch(() => {})
    }
    setProfile({ displayName: user?.displayName ?? '', email: user?.email ?? '' })
    get<typeof me>('/api/settings/me', true).then((d) => setMe({ ...me, ...d })).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveSite = async () => {
    if (!site) return
    setError('')
    try {
      await put('/api/settings/site', site, true)
      setNotice('站点设置已保存')
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const saveProfile = async () => {
    setError('')
    try {
      await put('/api/settings/me/profile', { displayName: profile.displayName || null, email: profile.email }, true)
      await refreshUser()
      setNotice('个人资料已更新')
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const saveMe = async () => {
    setError('')
    try {
      await put('/api/settings/me', {
        theme: me.theme,
        language: me.language,
        emailNotifications: me.emailNotifications,
        bio: me.bio || null,
        socialGithub: me.socialGithub || null,
        socialTwitter: me.socialTwitter || null,
        socialEmail: me.socialEmail || null,
      }, true)
      setNotice('个人设置已保存')
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-md text-ink">设置</h1>
        <p className="mt-1 text-sm text-muted">站点配置与个人设置</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {hasPermission('settings:read') && site && (
        <Card>
          <h2 className="mb-4 text-base font-medium text-ink">站点设置</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="站点标题"><input className={inputCls} value={site['site.title']} onChange={(e) => setSite({ ...site, 'site.title': e.target.value })} /></Field>
            <Field label="副标题"><input className={inputCls} value={site['site.subtitle']} onChange={(e) => setSite({ ...site, 'site.subtitle': e.target.value })} /></Field>
            <Field label="作者"><input className={inputCls} value={site['site.author']} onChange={(e) => setSite({ ...site, 'site.author': e.target.value })} /></Field>
            <Field label="头像 URL"><input className={inputCls} value={site['site.avatar_url']} onChange={(e) => setSite({ ...site, 'site.avatar_url': e.target.value })} /></Field>
            <div className="md:col-span-2">
              <Field label="站点描述"><textarea className={`${inputCls} h-20 resize-none`} value={site['site.description']} onChange={(e) => setSite({ ...site, 'site.description': e.target.value })} /></Field>
            </div>
            <Field label="GitHub"><input className={inputCls} value={site['site.social.github']} onChange={(e) => setSite({ ...site, 'site.social.github': e.target.value })} /></Field>
            <Field label="Twitter / X"><input className={inputCls} value={site['site.social.twitter']} onChange={(e) => setSite({ ...site, 'site.social.twitter': e.target.value })} /></Field>
            <Field label="联系邮箱"><input className={inputCls} value={site['site.social.email']} onChange={(e) => setSite({ ...site, 'site.social.email': e.target.value })} /></Field>
            <Field label="页脚文案"><input className={inputCls} value={site['site.footer']} onChange={(e) => setSite({ ...site, 'site.footer': e.target.value })} /></Field>
          </div>
          {hasPermission('settings:update') && (
            <div className="mt-5"><Button onClick={saveSite}>保存站点设置</Button></div>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-medium text-ink">个人资料</h2>
          <div className="space-y-4">
            <Field label="显示名称"><input className={inputCls} value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} /></Field>
            <Field label="邮箱"><input className={inputCls} type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
            <Button onClick={saveProfile}>保存资料</Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-medium text-ink">个人设置</h2>
          <div className="space-y-4">
            <Field label="主题">
              <select className={inputCls} value={me.theme} onChange={(e) => setMe({ ...me, theme: e.target.value })}>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="system">跟随系统</option>
              </select>
            </Field>
            <Field label="语言">
              <select className={inputCls} value={me.language} onChange={(e) => setMe({ ...me, language: e.target.value })}>
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </Field>
            <Field label="个人简介"><textarea className={`${inputCls} h-20 resize-none`} value={me.bio} onChange={(e) => setMe({ ...me, bio: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GitHub"><input className={inputCls} value={me.socialGithub} onChange={(e) => setMe({ ...me, socialGithub: e.target.value })} /></Field>
              <Field label="Twitter / X"><input className={inputCls} value={me.socialTwitter} onChange={(e) => setMe({ ...me, socialTwitter: e.target.value })} /></Field>
            </div>
            <Field label="公开邮箱"><input className={inputCls} value={me.socialEmail} onChange={(e) => setMe({ ...me, socialEmail: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="accent-primary" checked={me.emailNotifications} onChange={(e) => setMe({ ...me, emailNotifications: e.target.checked })} />
              接收邮件通知
            </label>
            <Button onClick={saveMe}>保存个人设置</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
