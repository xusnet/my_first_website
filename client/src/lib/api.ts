import type { ApiError } from '../types'

const ACCESS_KEY = 'clarkgong.access'
const REFRESH_KEY = 'clarkgong.refresh'

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

interface ApiOptions {
  method?: string
  body?: unknown
  auth?: boolean
}

let refreshPromise: Promise<boolean> | null = null

async function refreshAccess(): Promise<boolean> {
  const refreshToken = tokenStore.refresh
  if (!refreshToken) return false
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    tokenStore.clear()
    return false
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string }
  tokenStore.set(data.accessToken, data.refreshToken)
  return true
}

async function raw(path: string, options: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.auth && tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`
  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (res.status === 401 && options.auth && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    if (!refreshPromise) {
      refreshPromise = refreshAccess().finally(() => {
        refreshPromise = null
      })
    }
    const ok = await refreshPromise
    if (ok) {
      const headers2: Record<string, string> = {}
      if (options.body !== undefined) headers2['Content-Type'] = 'application/json'
      if (options.auth && tokenStore.access) headers2.Authorization = `Bearer ${tokenStore.access}`
      return fetch(path, {
        method: options.method ?? 'GET',
        headers: headers2,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })
    }
  }
  return res
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await raw(path, options)
  const contentType = res.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const code = body?.code ?? 'UNKNOWN'
    const message = body?.message ?? `请求失败（HTTP ${res.status}）`
    const err = new Error(message) as ApiError
    err.status = res.status
    err.code = code
    throw err
  }
  return body as T
}

export const get = <T>(path: string, auth = false) => api<T>(path, { auth })
export const post = <T>(path: string, body: unknown, auth = false) => api<T>(path, { method: 'POST', body, auth })
export const put = <T>(path: string, body: unknown, auth = false) => api<T>(path, { method: 'PUT', body, auth })
export const del = <T>(path: string, auth = false) => api<T>(path, { method: 'DELETE', auth })
