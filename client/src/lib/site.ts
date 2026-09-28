import { useEffect, useState } from 'react'
import type { SiteInfo } from '../types'
import { get } from '../lib/api'

export const DEFAULT_SITE: SiteInfo = {
  'site.title': "Clark.Gong's Website",
  'site.subtitle': '个人技术博客 · 软件工程 · 系统架构 · 安全合规',
  'site.description': '这里记录我在软件工程、系统架构与安全合规领域的实践与思考。',
  'site.author': 'Clark Gong',
  'site.avatar_url': '',
  'site.social.github': '',
  'site.social.twitter': '',
  'site.social.email': '',
  'site.footer': '© 2026 Clark.Gong · 让每一次提问都值得认真思考',
  'site.admin_notice': '',
  'about.content': '',
}

export function useSiteInfo(): SiteInfo {
  const [info, setInfo] = useState<SiteInfo>(DEFAULT_SITE)
  useEffect(() => {
    get<SiteInfo>('/api/public/site')
      .then(setInfo)
      .catch(() => setInfo(DEFAULT_SITE))
  }, [])
  return info
}
