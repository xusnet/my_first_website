export interface SiteInfo {
  'site.title': string
  'site.subtitle': string
  'site.description': string
  'site.author': string
  'site.avatar_url': string
  'site.social.github': string
  'site.social.twitter': string
  'site.social.email': string
  'site.footer': string
  'site.admin_notice': string
  [key: string]: string
}

export interface PostSummary {
  id: number
  title: string
  slug: string
  status: string
  excerpt: string | null
  cover_image: string | null
  published_at: string | null
  updated_at: string
  author_name: string | null
  author_username: string
  categories: Array<{ id?: number; name: string; slug: string }>
  tags: Array<{ id?: number; name: string; slug: string }>
}

export interface PostDetail extends PostSummary {
  content: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  post_count: number
}

export interface Tag {
  id: number
  name: string
  slug: string
  post_count: number
}

export interface AuthUser {
  id: number
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  status: string
  isSuperadmin: boolean
  mustChangePassword: boolean
  permissions: string[]
  roles: string[]
}

export interface AdminUser {
  id: number
  username: string
  email: string
  display_name: string | null
  avatar_url: string | null
  status: 'active' | 'disabled' | 'locked'
  is_superadmin: number
  failed_attempts: number
  locked_until: string | null
  must_change_password: number
  last_login_at: string | null
  last_login_ip: string | null
  created_at: string
  updated_at: string
  roles: Array<{ code: string; name: string }>
}

export interface Role {
  id: number
  code: string
  name: string
  description: string | null
  is_system: number
  userCount: number
  permissions: string[]
}

export interface Permission {
  id: number
  code: string
  name: string
  module: string
  description: string | null
}

export interface AuditLog {
  id: number
  user_id: number | null
  username: string | null
  action: string
  resource: string
  resource_id: string | null
  ip: string | null
  user_agent: string | null
  result: 'success' | 'failure'
  detail: string | null
  prev_hash: string
  log_hash: string
  created_at: string
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
