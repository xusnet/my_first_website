import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-on-primary active:bg-primary-active',
    secondary: 'border border-hairline bg-canvas text-ink hover:border-primary/50',
    danger: 'bg-error text-white active:opacity-80',
  }[variant]
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-40 ${styles} ${className}`}
    />
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'coral' | 'teal' | 'dark'; children: ReactNode }) {
  const styles = {
    neutral: 'bg-surface-card text-ink',
    coral: 'bg-primary text-on-primary',
    teal: 'bg-accent-teal/15 text-accent-teal',
    dark: 'bg-surface-dark text-on-dark',
  }[tone]
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium ${styles}`}>{children}</span>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-hairline bg-canvas p-6 ${className}`}>{children}</div>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted-soft">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  )
}

export function Alert({ tone, children }: { tone: 'error' | 'success' | 'warning'; children: ReactNode }) {
  const styles = {
    error: 'border-error/30 bg-error/5 text-error',
    success: 'border-success/30 bg-success/5 text-success',
    warning: 'border-warning/30 bg-warning/5 text-warning',
  }[tone]
  return <div className={`rounded-md border px-4 py-3 text-sm ${styles}`}>{children}</div>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-hairline bg-canvas p-10 text-center text-muted">{children}</p>
}
