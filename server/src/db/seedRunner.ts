import pool from './pool.js'
import { config } from '../config.js'
import { hashPassword } from '../utils/password.js'

const PERMISSIONS: Array<[string, string, string]> = [
  ['dashboard:read', '查看仪表盘', 'dashboard'],
  ['user:read', '查看用户', 'user'],
  ['user:create', '创建用户', 'user'],
  ['user:update', '更新用户', 'user'],
  ['user:delete', '删除用户', 'user'],
  ['user:reset-password', '重置用户口令', 'user'],
  ['user:assign-role', '分配角色', 'user'],
  ['role:read', '查看角色', 'role'],
  ['role:create', '创建角色', 'role'],
  ['role:update', '更新角色', 'role'],
  ['role:delete', '删除角色', 'role'],
  ['role:assign-permission', '分配权限', 'role'],
  ['permission:read', '查看权限', 'permission'],
  ['post:read', '查看文章', 'post'],
  ['post:create', '创建文章', 'post'],
  ['post:update', '更新文章', 'post'],
  ['post:delete', '删除文章', 'post'],
  ['post:publish', '发布文章', 'post'],
  ['category:read', '查看分类', 'category'],
  ['category:create', '创建分类', 'category'],
  ['category:update', '更新分类', 'category'],
  ['category:delete', '删除分类', 'category'],
  ['tag:read', '查看标签', 'tag'],
  ['tag:create', '创建标签', 'tag'],
  ['tag:update', '更新标签', 'tag'],
  ['tag:delete', '删除标签', 'tag'],
  ['audit:read', '查看审计日志', 'audit'],
  ['settings:read', '查看系统设置', 'settings'],
  ['settings:update', '更新系统设置', 'settings'],
]

const ALL_CODES = PERMISSIONS.map(([code]) => code)

const ROLE_DEFS: Array<{ code: string; name: string; description: string; perms: string[] }> = [
  { code: 'superadmin', name: '超级管理员', description: '系统内置，拥有全部权限', perms: ALL_CODES },
  {
    code: 'admin',
    name: '管理员',
    description: '系统管理，除用户删除与口令重置外拥有全部权限',
    perms: ALL_CODES.filter(
      (c) => !['user:delete', 'user:reset-password', 'role:delete', 'role:assign-permission'].includes(c),
    ),
  },
  {
    code: 'editor',
    name: '内容编辑',
    description: '管理内容（文章/分类/标签）并可发布',
    perms: [
      'dashboard:read',
      'post:read',
      'post:create',
      'post:update',
      'post:delete',
      'post:publish',
      'category:read',
      'category:create',
      'category:update',
      'category:delete',
      'tag:read',
      'tag:create',
      'tag:update',
      'tag:delete',
    ],
  },
  {
    code: 'author',
    name: '作者',
    description: '撰写与维护自己的文章',
    perms: [
      'dashboard:read',
      'post:read',
      'post:create',
      'post:update',
      'post:delete',
      'category:read',
      'tag:read',
      'tag:create',
      'tag:update',
    ],
  },
  { code: 'viewer', name: '访客', description: '只读访问后台', perms: ['dashboard:read', 'post:read', 'category:read', 'tag:read'] },
]

const CATEGORIES = [
  { name: '技术架构', slug: 'architecture', description: '系统架构与设计' },
  { name: '后端开发', slug: 'backend', description: '服务端工程实践' },
  { name: '前端开发', slug: 'frontend', description: '前端与交互' },
  { name: '数据库', slug: 'database', description: '数据库与存储' },
  { name: '安全合规', slug: 'security', description: '安全与等保合规' },
  { name: '随笔', slug: 'essays', description: '日常记录与思考' },
]

const TAGS = ['TypeScript', 'Node.js', 'MariaDB', 'Redis', 'React', 'Docker', '等保三级', '架构设计', 'DevOps']

const SITE_SETTINGS: Array<[string, string]> = [
  ['site.title', "Clark.Gong's Website"],
  ['site.subtitle', '个人技术博客 · 软件工程 · 系统架构 · 安全合规'],
  ['site.description', '这里记录我在软件工程、系统架构与安全合规领域的实践与思考。'],
  ['site.author', 'Clark Gong'],
  ['site.avatar_url', ''],
  ['site.social.github', ''],
  ['site.social.twitter', ''],
  ['site.social.email', 'clark@clarkgong.dev'],
  ['site.footer', '© 2026 Clark.Gong · 让每一次提问都值得认真思考'],
  ['site.admin_notice', ''],
]

const WELCOME_POST_MD = [
  '# 欢迎来到 Clark.Gong 的个人技术博客',
  '',
  '这里是 **Clark.Gong 的个人技术博客**，记录我在软件工程、系统架构与安全合规领域的实践与思考。',
  '',
  '## 本站技术栈',
  '',
  '- **后端**：Node.js + Express + TypeScript',
  '- **数据库**：MariaDB 11（最新稳定版）',
  '- **缓存**：Redis 7',
  '- **前端**：React + Vite + Tailwind CSS',
  '- **安全**：基于等保三级要求设计（复杂口令、登录锁定、RBAC、审计日志）',
  '',
  '## 关于 CMS',
  '',
  '内置 CMS 内容管理后台，支持：',
  '',
  '- 用户 / 角色 / 权限管理',
  '- 文章管理（Markdown 编写、草稿 / 发布 / 归档）',
  '- 分类与标签',
  '- 审计日志（哈希链防篡改，可追溯）',
  '',
  '更多内容即将发布，敬请期待。',
  '',
].join('\n')

export async function seed(): Promise<void> {
  const permIdByCode = new Map<string, number>()
  for (const [code, name, module] of PERMISSIONS) {
    const res = await pool.query(
      `INSERT INTO permissions (code, name, module) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module)`,
      [code, name, module],
    )
    const id = Number(res.insertId)
    if (id) {
      permIdByCode.set(code, id)
    } else {
      const [row] = await pool.query<Array<{ id: number }>>('SELECT id FROM permissions WHERE code = ?', [code])
      permIdByCode.set(code, row.id)
    }
  }

  const roleIdByCode = new Map<string, number>()
  for (const def of ROLE_DEFS) {
    const res = await pool.query(
      `INSERT INTO roles (code, name, description, is_system) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
      [def.code, def.name, def.description],
    )
    const id = Number(res.insertId)
    if (id) {
      roleIdByCode.set(def.code, id)
    } else {
      const [row] = await pool.query<Array<{ id: number }>>('SELECT id FROM roles WHERE code = ?', [def.code])
      roleIdByCode.set(def.code, row.id)
    }
  }

  for (const def of ROLE_DEFS) {
    const roleId = roleIdByCode.get(def.code)!
    for (const code of def.perms) {
      const permId = permIdByCode.get(code)
      if (!permId) continue
      await pool.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permId])
    }
  }

  const [userCount] = await pool.query<Array<{ n: number }>>('SELECT COUNT(*) AS n FROM users')
  if ((userCount?.n ?? 0) === 0) {
    const passwordHash = await hashPassword(config.admin.initialPassword)
    const res = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name, is_superadmin, must_change_password)
       VALUES (?, ?, ?, ?, 1, 1)`,
      [config.admin.username, 'admin@clarkgong.dev', passwordHash, 'Clark Gong'],
    )
    const adminId = Number(res.insertId)
    const superRole = roleIdByCode.get('superadmin')!
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [adminId, superRole])
    await pool.query('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)', [adminId, passwordHash])
    await pool.query('INSERT INTO user_settings (user_id) VALUES (?)', [adminId])
    console.log(`[seed] 创建初始管理员「${config.admin.username}」，首次登录需强制改密`)
  }

  for (const c of CATEGORIES) {
    await pool.query(
      `INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [c.name, c.slug, c.description],
    )
  }
  for (const t of TAGS) {
    await pool.query(
      `INSERT INTO tags (name, slug) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [t, t.toLowerCase().replace(/\s+/g, '-')],
    )
  }
  for (const [skey, svalue] of SITE_SETTINGS) {
    await pool.query(
      `INSERT INTO site_settings (skey, svalue) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)`,
      [skey, svalue],
    )
  }

  const [postCount] = await pool.query<Array<{ n: number }>>('SELECT COUNT(*) AS n FROM posts')
  if ((postCount?.n ?? 0) === 0) {
    const [adminUser] = await pool.query<Array<{ id: number }>>('SELECT id FROM users WHERE username = ?', [
      config.admin.username,
    ])
    if (adminUser) {
      const res = await pool.query(
        `INSERT INTO posts (title, slug, excerpt, content, status, published_at, author_id)
         VALUES (?, ?, ?, ?, 'published', NOW(), ?)`,
        [
          '欢迎来到 Clark.Gong 的个人技术博客',
          'welcome',
          '这里记录我在软件工程、系统架构与安全合规领域的实践与思考。',
          WELCOME_POST_MD,
          adminUser.id,
        ],
      )
      const postId = Number(res.insertId)
      const [cat] = await pool.query<Array<{ id: number }>>('SELECT id FROM categories WHERE slug = ?', ['essays'])
      if (cat) await pool.query('INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)', [postId, cat.id])
      const [tag] = await pool.query<Array<{ id: number }>>('SELECT id FROM tags WHERE slug = ?', ['node-js'])
      if (tag) await pool.query('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)', [postId, tag.id])
    }
  }
}
