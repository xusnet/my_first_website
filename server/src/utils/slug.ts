import crypto from 'node:crypto'

/**
 * 生成 slug。中文标题无法直接 slugify 时回退为短哈希。
 */
export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!base) {
    return `post-${crypto.randomBytes(4).toString('hex')}`
  }
  if (/[\u4e00-\u9fa5]/.test(base)) {
    return `${base.replace(/[\u4e00-\u9fa5]/g, '') || 'post'}-${crypto
      .randomBytes(3)
      .toString('hex')}`
  }
  return base
}
