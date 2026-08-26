import { db } from './client.js'

/**
 * 成员口径对齐前端 permissionsData.ts 的 CoreRole 分类与部门：
 * 管理员/知识管理员/空间管理员/文档审核员/助手运营员/普通成员。
 * email/status/joinedAt 保留 Phase A 口径（陈可/刘洋 待激活）。
 */
const members = [
  ['m-zw', '张伟', 'zhangwei@example.com', '管理员', '总经办', '活跃', '2024-04-02'],
  ['m-ln', '李娜', 'lina@example.com', '知识管理员', '知识运营', '活跃', '2024-04-02'],
  ['m-wq', '王强', 'wangqiang@example.com', '空间管理员', '产品部', '活跃', '2024-04-05'],
  ['m-zm', '赵敏', 'zhaomin@example.com', '文档审核员', '销售部', '活跃', '2024-04-08'],
  ['m-cc', '陈可', 'chenke@example.com', '助手运营员', 'IT 部', '待激活', '2024-04-10'],
  ['m-ly', '刘洋', 'liuyang@example.com', '普通成员', '售前团队', '待激活', '2024-04-12'],
] as const

/**
 * 知识空间 seed（口径对齐前端 kbData.SPACES：默认空间为伞空间 count=全库 128，
 * 命名空间 34+32+28+12=106，其余 22 份仅属默认空间。health/reviewCycle/archived 同源）。
 * createdAt 沿用 spacesData 页面元数据。
 */
const spaces = [
  { id: 's-all', name: '默认空间（全部知识）', count: 128, health: '健康', reviewCycle: 180, archived: 0, createdAt: '2024-04-02', titlePrefix: '知识文档' },
  { id: 's-policy', name: '制度与流程', count: 34, health: '待复审', reviewCycle: 180, archived: 0, createdAt: '2024-04-05', titlePrefix: '制度文件' },
  { id: 's-product', name: '产品资料', count: 32, health: '健康', reviewCycle: 60, archived: 0, createdAt: '2024-04-08', titlePrefix: '产品手册' },
  { id: 's-sales', name: '销售弹药库', count: 28, health: '健康', reviewCycle: 60, archived: 0, createdAt: '2024-04-10', titlePrefix: '销售资料' },
  { id: 's-it', name: 'IT·SOP', count: 12, health: '健康', reviewCycle: 90, archived: 0, createdAt: '2024-05-20', titlePrefix: 'IT-SOP' },
] as const

/** 文档字段取值池（任务口径）：owner/type/category/status/source 按序号取模，确定性生成。 */
const OWNERS = ['张伟', '王强', '赵敏', '陈可', '刘洋', '李娜'] as const
const TYPES = ['PDF', 'Word', 'PPT', 'Markdown'] as const
const CATEGORIES = ['产品介绍', '使用指南', '常见问题', 'API文档', '售后服务'] as const
const STATUSES = ['已就绪', '待复审', '待确认'] as const
const SOURCES = ['本地上传', '网盘', '飞书'] as const

/** 确定性生成 128 行 docs：命名空间按自身 count 生成（34+32+28+12=106）；
 * 默认伞空间的 count 列 = 全库总数 128（伞口径），但其直属文档仅 128-106=22 份。 */
function seedSpacesAndDocs() {
  const insSpace = db.prepare(`INSERT INTO spaces (id, name, count, health, reviewCycle, archived, createdAt) VALUES (?,?,?,?,?,?,?)`)
  for (const s of spaces) insSpace.run(s.id, s.name, s.count, s.health, s.reviewCycle, s.archived, s.createdAt)

  const namedTotal = spaces.slice(1).reduce((sum, s) => sum + s.count, 0)

  const insDoc = db.prepare(
    `INSERT INTO docs (id, spaceId, title, type, category, status, owner, updatedAt, source) VALUES (?,?,?,?,?,?,?,?,?)`,
  )
  let n = 0
  for (const s of spaces) {
    const docCount = s.id === spaces[0].id ? s.count - namedTotal : s.count
    for (let i = 1; i <= docCount; i += 1) {
      n += 1
      insDoc.run(
        `d-${n}`,
        s.id,
        `《${s.titlePrefix} ${i}》`,
        TYPES[(n * 3) % TYPES.length],
        CATEGORIES[(n * 5) % CATEGORIES.length],
        STATUSES[(n * 7) % STATUSES.length],
        OWNERS[(n * 11) % OWNERS.length],
        `2024-${String(4 + (n % 5)).padStart(2, '0')}-${String((n % 28) + 1).padStart(2, '0')}`,
        SOURCES[(n * 13) % SOURCES.length],
      )
    }
  }
}

/**
 * 连接器 seed（口径对齐前端 sourcesData.ts CONNECTORS + METRICS.connectedDocs）：
 * 4 张内置卡（企业网盘/飞书文档/钉钉文档/企业微信）；connected 依 sourcesData：
 * 网盘、飞书已连接，钉钉、企微未连接（副标题「已连接来源 X/4」→ 2/4）。
 * docs：网盘 862、飞书 318（METRICS 口径，合计 1,180，加本地上传 106 = 1,286）。
 * kind：网盘 api、其余 oauth（OAuth 型内置连接器，connect 端点适用）。
 * lastSyncAt 用演示基准日（TODAY=2026-05-29）派生，未连接连接器为 NULL。
 */
const connectors = [
  { id: 'netdisk', name: '企业网盘', kind: 'api', connected: 1, disabled: 0, docs: 862, lastSyncAt: '2026-05-29T10:20:00', config: '{}' },
  { id: 'feishu', name: '飞书文档', kind: 'oauth', connected: 1, disabled: 0, docs: 318, lastSyncAt: '2026-05-29T09:45:00', config: '{}' },
  { id: 'dingtalk', name: '钉钉文档', kind: 'oauth', connected: 0, disabled: 0, docs: 0, lastSyncAt: null, config: '{}' },
  { id: 'wecom', name: '企业微信', kind: 'oauth', connected: 0, disabled: 0, docs: 0, lastSyncAt: null, config: '{}' },
] as const

/**
 * 同步任务 seed（口径对齐前端 sourcesData.ts SYNC_TASKS 5 条，at 用演示基准日派生）：
 * t1 网盘增量/今天10:20、t2 飞书增量/今天09:45、t3 网盘ACL/昨天18:20、
 * t4 飞书全量校验失败/昨天16:30（3 份未能处理 → failedCount 3）、t5 本地上传批次/05-15。
 * connectorId：t5 本地上传非连接器卡 → NULL；status/progress/failedCount 走任务口径。
 */
const syncTasks = [
  { id: 't1', connectorId: 'netdisk', status: '已完成', progress: 100, failedCount: 0, at: '2026-05-29T10:20:00' },
  { id: 't2', connectorId: 'feishu', status: '已完成', progress: 100, failedCount: 0, at: '2026-05-29T09:45:00' },
  { id: 't3', connectorId: 'netdisk', status: '已完成', progress: 100, failedCount: 0, at: '2026-05-28T18:20:00' },
  { id: 't4', connectorId: 'feishu', status: '失败', progress: 0, failedCount: 3, at: '2026-05-28T16:30:00' },
  { id: 't5', connectorId: null, status: '已完成', progress: 100, failedCount: 0, at: '2026-05-15T18:32:00' },
] as const

function seedConnectorsAndTasks() {
  const insConn = db.prepare(
    'INSERT INTO connectors (id, name, kind, connected, disabled, docs, lastSyncAt, config) VALUES (?,?,?,?,?,?,?,?)',
  )
  for (const c of connectors) {
    insConn.run(c.id, c.name, c.kind, c.connected, c.disabled, c.docs, c.lastSyncAt, c.config)
  }

  const insTask = db.prepare(
    'INSERT INTO sync_tasks (id, connectorId, status, progress, failedCount, at) VALUES (?,?,?,?,?,?)',
  )
  for (const t of syncTasks) {
    insTask.run(t.id, t.connectorId, t.status, t.progress, t.failedCount, t.at)
  }
}

export function seedIfEmpty() {
  const n = (db.prepare('SELECT COUNT(*) c FROM org').get() as { c: number }).c
  if (n > 0) return
  db.prepare(`INSERT INTO org (id, name, industry, contact, demoData) VALUES ('org-1', '示例科技有限公司', '软件与信息技术服务', 'zhangwei@example.com', 0)`).run()
  db.prepare(`INSERT INTO plan VALUES ('plan-1', '试用版', 0.68, 1, 20, 12, '2025-06-03')`).run()
  const ins = db.prepare(`INSERT INTO members VALUES (?,?,?,?,?,?,?)`)
  for (const m of members) ins.run(...m)
  db.prepare(`INSERT INTO users (id, memberId, email, passwordHash, role) VALUES ('u-1', 'm-zw', 'zhangwei@example.com', NULL, '管理员')`).run()
  db.prepare(`INSERT INTO trial_journey (id,activated,step,installedApps,uninstalledApps,userInstalledApps,invitesSent,configProgress) VALUES (1,0,0,'["wecom-qa","custom-api","sso"]','[]','[]',0,0)`).run()
  seedSpacesAndDocs()
  seedConnectorsAndTasks()
}
