/**
 * 数据来源页面模拟数据（data-sources.md §5）
 * syncStatus 枚举沿用 DataSource.syncStatus（idle / syncing / failed），展示文案在页面内映射。
 * 文档数与 ACL 口径引用 base.mock METRICS（P1-1 口径字典）。
 */
import { METRICS } from '@/mocks'

export type ConnectorId = 'netdisk' | 'feishu' | 'dingtalk' | 'wecom'

export interface ConnectorItem {
  /** 内置连接器为 ConnectorId；向导新增的 OAuth 来源为 `custom-*` */
  id: string
  name: string
  connected: boolean
  syncStatus: 'idle' | 'syncing' | 'failed'
  desc: string
  docs?: number
  lastSyncAt?: string
  aclCoverage?: number
  incremental: boolean
  /** 已停用（暂停同步，保留授权与配置） */
  disabled?: boolean
  /** 授权有效期（仅飞书） */
  authValidUntil?: string
  authExpireNote?: string
}

export const CONNECTORS: ConnectorItem[] = [
  {
    id: 'netdisk',
    name: '企业网盘',
    connected: true,
    syncStatus: 'idle',
    desc: '同步企业网盘文件夹，自动继承目录权限',
    docs: METRICS.connectedDocs.netdisk,
    lastSyncAt: '今天 10:20',
    aclCoverage: 94,
    incremental: true,
  },
  {
    id: 'feishu',
    name: '飞书文档',
    connected: true,
    syncStatus: 'idle',
    desc: '同步飞书知识库与云文档，按组织架构授权',
    docs: METRICS.connectedDocs.feishu,
    lastSyncAt: '今天 09:45',
    aclCoverage: 92,
    incremental: true,
    authValidUntil: '2024-06-15',
    authExpireNote: '16 天后到期，建议提前重新授权',
  },
  {
    id: 'dingtalk',
    name: '钉钉文档',
    connected: false,
    syncStatus: 'idle',
    desc: '同步钉钉知识库与群文件，自动继承组织架构权限',
    incremental: false,
  },
  {
    id: 'wecom',
    name: '企业微信',
    connected: false,
    syncStatus: 'idle',
    desc: '同步企微微盘与文档，支持按部门授权',
    incremental: false,
  },
]

export type SyncTaskStatus = '已完成' | '失败' | '进行中'

export interface SyncTask {
  id: string
  source: string
  type: string
  status: SyncTaskStatus
  docs: string
  startedAt: string
  duration: string
  /** 失败任务：原因与下一步 */
  failReason?: string
  retryCount?: number
}

export const SYNC_TASKS: SyncTask[] = [
  { id: 't1', source: '企业网盘', type: '增量同步', status: '已完成', docs: '+12 份', startedAt: '今天 10:20', duration: '2 分 14 秒' },
  { id: 't2', source: '飞书文档', type: '增量同步', status: '已完成', docs: '+5 份', startedAt: '今天 09:45', duration: '1 分 48 秒' },
  { id: 't3', source: '企业网盘', type: 'ACL 权限同步', status: '已完成', docs: `覆盖 ${METRICS.aclCovered} 人`, startedAt: '昨天 18:20', duration: '4 分 02 秒' },
  {
    id: 't4', source: '飞书文档', type: '全量校验', status: '失败', docs: '3 份未能处理', startedAt: '昨天 16:30', duration: '—',
    failReason: '3 份文档需要密码，已在原系统加密，无法解析内容。',
    retryCount: 1,
  },
  { id: 't5', source: '本地上传', type: '批次导入', status: '已完成', docs: `${METRICS.connectedDocs.localUpload} 份`, startedAt: '05-15 18:32', duration: '12 分 40 秒' },
]

export interface SourceTypeOption {
  value: string
  label: string
  desc: string
  kind: 'crawl' | 'oauth' | 'api'
}

/** 新增来源向导：6 张类型选择卡（2×3） */
export const SOURCE_TYPES: SourceTypeOption[] = [
  { value: 'url', label: '网页 URL', desc: '抓取单个网页或站点栏目内容', kind: 'crawl' },
  { value: 'sitemap', label: 'Sitemap', desc: '按站点地图批量抓取整站内容', kind: 'crawl' },
  { value: 'rss', label: 'RSS 订阅', desc: '订阅更新源，30 天自动重抓比较', kind: 'crawl' },
  { value: 'oauth-db', label: '数据库同步', desc: 'OAuth 授权后同步指定数据库', kind: 'oauth' },
  { value: 'oauth-kb', label: '第三方知识库', desc: 'OAuth 授权后同步空间页面', kind: 'oauth' },
  { value: 'api', label: 'API 接入', desc: '通过开放 API 推送结构化知识', kind: 'api' },
]

export const CRAWL_DEPTH_OPTIONS = ['仅当前页', '下钻 1 层', '下钻 2 层', '下钻 3 层']

export interface SyncLogEntry {
  time: string
  level: '信息' | '警告' | '错误'
  message: string
}

/** 连接器同步日志（mock，查看日志 Drawer） */
const CONNECTOR_LOGS: Record<string, SyncLogEntry[]> = {
  netdisk: [
    { time: '今天 10:20', level: '信息', message: '增量同步完成：新增 12 份，更新 3 份，跳过 0 份' },
    { time: '今天 10:18', level: '信息', message: '开始增量同步（自上次 checkpoint）' },
    { time: '昨天 18:20', level: '信息', message: 'ACL 权限同步完成：覆盖 3,842 人' },
    { time: '昨天 02:00', level: '信息', message: '全量校验完成：1,208 份文档一致' },
    { time: '06-01 14:32', level: '警告', message: '2 份文档版本冲突，已保留最新版本' },
  ],
  feishu: [
    { time: '今天 09:45', level: '信息', message: '增量同步完成：新增 5 份，更新 1 份' },
    { time: '昨天 16:30', level: '错误', message: '全量校验失败：3 份加密文档无法解析（需要密码）' },
    { time: '昨天 16:28', level: '信息', message: '开始全量校验（手动触发）' },
    { time: '昨天 02:00', level: '警告', message: '授权将于 2024-06-15 到期，建议提前重新授权' },
    { time: '05-30 09:12', level: '信息', message: 'OAuth 令牌刷新成功' },
  ],
}

/** 连接器日志：无定制记录时按名称生成通用日志 */
export function connectorLogs(c: Pick<ConnectorItem, 'id' | 'name'>): SyncLogEntry[] {
  return (
    CONNECTOR_LOGS[c.id] ?? [
      { time: '今天 10:00', level: '信息', message: `${c.name} 心跳检测正常，授权有效` },
      { time: '昨天 02:00', level: '信息', message: `${c.name} 全量校验完成，无差异` },
      { time: '06-01 15:40', level: '信息', message: `${c.name} 增量同步完成：新增 2 份` },
    ]
  )
}

/** 任务关联日志（mock，任务详情 Drawer） */
export function taskLogsFor(task: SyncTask): SyncLogEntry[] {
  if (task.status === '失败') {
    return [
      { time: task.startedAt, level: '信息', message: `任务启动：${task.source} · ${task.type}` },
      { time: task.startedAt, level: '错误', message: task.failReason ?? '未知错误' },
      { time: task.startedAt, level: '警告', message: `已自动重试 ${task.retryCount ?? 0} 次，仍未成功` },
    ]
  }
  return [
    { time: task.startedAt, level: '信息', message: `任务启动：${task.source} · ${task.type}` },
    { time: task.startedAt, level: '信息', message: `处理完成：${task.docs}，耗时 ${task.duration}` },
  ]
}

/** 全部同步日志（近 30 天摘要，查看全部 Drawer） */
export const ALL_SYNC_LOGS: SyncLogEntry[] = [
  { time: '今天 10:20', level: '信息', message: '企业网盘 增量同步完成：+12 份' },
  { time: '今天 09:45', level: '信息', message: '飞书文档 增量同步完成：+5 份' },
  { time: '昨天 18:20', level: '信息', message: '企业网盘 ACL 权限同步完成：覆盖 3,842 人' },
  { time: '昨天 16:30', level: '错误', message: '飞书文档 全量校验失败：3 份加密文档无法解析' },
  { time: '昨天 02:00', level: '信息', message: '每周全量校验完成：全部来源一致' },
  { time: '06-01 14:32', level: '警告', message: '企业网盘 2 份文档版本冲突，已保留最新版本' },
  { time: '05-30 09:12', level: '信息', message: '飞书文档 OAuth 令牌刷新成功' },
  { time: '05-28 02:00', level: '信息', message: '每周全量校验完成：全部来源一致' },
]

export const SYNC_HEALTH = {
  aclPolicy: '按组织架构 + 空间权限同步',
  aclLastSyncAt: '昨天 18:20',
  aclCoveredUsers: METRICS.aclCovered,
  fullCheckNote: '开启后仅同步变更文档，全量校验每周日 02:00 自动执行',
}
