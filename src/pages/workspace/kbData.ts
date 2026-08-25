/**
 * kbData — 知识库与文档管理页扩展 mock（design/knowledge-base.md §4，数值以 §2.1/§2.3 为准）。
 * 页面级数据，不改全局 store。
 */
import { METRICS, TODAY } from '@/mocks'

export type DocStatus = '已发布' | '待复审' | '已过期' | '解析中' | '存在冲突' | '已归档'

export interface DocVersion {
  label: string
  authoritative: boolean
  note?: string
}

export interface DocRow {
  id: string
  title: string
  version: string
  category: string
  type: 'PDF' | 'Word' | '表格' | 'PPT' | '图片' | '网页'
  status: DocStatus
  /** 状态旁 ⓘ 悬浮解释 */
  statusNote?: string
  size: string
  pages?: number
  owner: string
  updatedAt: string
  space: string
  source: '企业网盘' | '飞书文档' | '本地上传'
  validFrom: string
  reviewDueAt: string
  expiresAt: string
  riskLevel: '低' | '中' | '高'
  sourceOfTruth: string
  permScope: string
  /** 解析中进度 */
  progress?: number
  /** 确认仍有效的记录 */
  confirmedNote?: string
  versions: DocVersion[]
}

export interface SpaceRow {
  name: string
  count: number
  health: '健康' | '待复审'
  reviewCount?: number
  /** 审核周期（树 ⋯ 菜单「审核周期」设置，单位：天） */
  reviewCycle?: number
  /** 已归档空间从树中隐藏 */
  archived?: boolean
}

/**
 * 空间单一事实源：与 spacesData（知识空间页）、permissionsData.ALL_SPACES 完全同名同计数。
 * 默认空间为伞空间（count=全库 128），命名空间 34+32+28+12=106，其余 22 份仅属默认空间。
 */
export const SPACES: SpaceRow[] = [
  { name: '默认空间（全部知识）', count: METRICS.kbDocs, health: '健康', reviewCycle: 180 },
  { name: '制度与流程', count: 34, health: '待复审', reviewCount: 3, reviewCycle: 180 },
  { name: '产品资料', count: 32, health: '健康', reviewCycle: 60 },
  { name: '销售弹药库', count: 28, health: '健康', reviewCycle: 60 },
  { name: 'IT·SOP', count: 12, health: '健康', reviewCycle: 90 },
]

export const DOC_TYPES = ['全部', 'PDF', 'Word', '表格', 'PPT', '图片', '网页'] as const
export const DOC_STATUSES = ['全部', '已发布', '解析中', '待复审', '已过期', '存在冲突', '已归档'] as const
export const DOC_CATEGORIES = ['全部', '产品资料', '销售政策', '客户案例', '制度流程', 'FAQ', 'IT-SOP'] as const

export function makeDocuments(): DocRow[] {
  return [
    {
      id: 'd1', title: '《销售管理制度》', version: 'v2.1', category: '制度流程', type: 'PDF',
      status: '已发布', size: '2.4 MB', pages: 32, owner: '张伟', updatedAt: '今天 10:20',
      space: '制度与流程', source: '企业网盘',
      validFrom: '2026-01-01', reviewDueAt: '2026-07-01', expiresAt: '2027-01-01',
      riskLevel: '低', sourceOfTruth: '企业网盘 / 制度库 / 销售管理制度.pdf', permScope: '全体成员可见',
      versions: [
        { label: 'v2.1', authoritative: true, note: '当前版本' },
        { label: 'v2.0', authoritative: false, note: '2025-06 发布' },
        { label: 'v1.9', authoritative: false, note: '2024-11 发布' },
      ],
    },
    {
      id: 'd2', title: '《价格管理办法》', version: 'v1.3', category: '销售政策', type: 'PDF',
      status: '已发布', size: '1.1 MB', pages: 18, owner: '李娜', updatedAt: '昨天 16:45',
      space: '销售弹药库', source: '企业网盘',
      validFrom: '2025-09-01', reviewDueAt: '2026-03-01', expiresAt: '2026-09-01',
      riskLevel: '中', sourceOfTruth: '企业网盘 / 销售部 / 价格管理办法.pdf', permScope: '销售与售前团队',
      versions: [
        { label: 'v1.3', authoritative: true, note: '当前版本' },
        { label: 'v1.2', authoritative: false, note: '2025-03 发布' },
      ],
    },
    {
      id: 'd3', title: '《审批权限矩阵表》', version: 'v3.0', category: '制度流程', type: '表格',
      status: '已发布', size: '0.6 MB', pages: 8, owner: '张伟', updatedAt: '昨天 11:08',
      space: '制度与流程', source: '飞书文档',
      validFrom: '2025-10-01', reviewDueAt: '2026-04-01', expiresAt: '2026-10-01',
      riskLevel: '低', sourceOfTruth: '飞书文档 / 审批权限矩阵表', permScope: '全体成员可见',
      versions: [
        { label: 'v3.0', authoritative: true, note: '当前版本' },
        { label: 'v2.4', authoritative: false, note: '2025-01 发布' },
      ],
    },
    {
      id: 'd4', title: '《差旅费用报销管理办法》', version: 'v2.0', category: '制度流程', type: 'Word',
      status: '待复审', statusNote: '复审到期 06-15：该文档已过复审期，回答权重已降低',
      size: '1.8 MB', pages: 22, owner: '王磊', updatedAt: '06-01 09:30',
      space: '制度与流程', source: '企业网盘',
      validFrom: '2025-06-01', reviewDueAt: '2026-06-15', expiresAt: '2026-12-01',
      riskLevel: '低', sourceOfTruth: '企业网盘 / 财务部 / 差旅报销办法.docx', permScope: '全体成员可见',
      versions: [
        { label: 'v2.0', authoritative: true, note: '当前版本' },
        { label: 'v1.5', authoritative: false, note: '2024-05 发布' },
      ],
    },
    {
      id: 'd5', title: '《2024 报价政策》', version: 'v1.0', category: '销售政策', type: 'PDF',
      status: '已过期', statusNote: '已过期：已被 v2.0 替代，默认不参与回答，仅用于历史查询',
      size: '1.2 MB', pages: 15, owner: '李娜', updatedAt: '05-31 18:22',
      space: '销售弹药库', source: '本地上传',
      validFrom: '2024-03-01', reviewDueAt: '2024-09-01', expiresAt: '2025-03-01',
      riskLevel: '中', sourceOfTruth: '本地上传 / 2024报价政策.pdf', permScope: '销售团队',
      versions: [
        { label: 'v2.0', authoritative: true, note: '当前权威版本' },
        { label: 'v1.0', authoritative: false, note: '本文件，已被 v2.0 替代' },
      ],
    },
    {
      id: 'd6', title: '《产品 X 白皮书》', version: 'v1.5', category: '产品资料', type: 'PDF',
      status: '已发布', size: '5.6 MB', pages: 46, owner: '张伟', updatedAt: '05-30 14:12',
      space: '产品资料', source: '本地上传',
      validFrom: '2025-05-01', reviewDueAt: '2025-11-01', expiresAt: '2026-05-01',
      riskLevel: '低', sourceOfTruth: '本地上传 / 产品X白皮书.pdf', permScope: '全体成员可见',
      versions: [
        { label: 'v1.5', authoritative: true, note: '当前版本' },
        { label: 'v1.4', authoritative: false, note: '2025-02 发布' },
      ],
    },
    {
      id: 'd7', title: '《新品发布会执行 SOP》', version: 'v1.0', category: 'IT-SOP', type: 'PPT',
      status: '已发布', size: '0.9 MB', pages: 12, owner: '王磊', updatedAt: '05-29 10:05',
      space: 'IT·SOP', source: '飞书文档',
      validFrom: '2025-05-15', reviewDueAt: '2025-08-15', expiresAt: '2026-05-15',
      riskLevel: '低', sourceOfTruth: '飞书文档 / 新品发布会执行SOP', permScope: '市场与产品团队',
      versions: [{ label: 'v1.0', authoritative: true, note: '当前版本' }],
    },
    {
      id: 'd8', title: '《客服 FAQ 汇编》', version: 'v3.2', category: 'FAQ', type: 'Word',
      status: '解析中', progress: 72, size: '3.3 MB', owner: '李娜', updatedAt: '今天 09:58',
      space: '产品资料', source: '本地上传',
      validFrom: '2025-06-01', reviewDueAt: '2025-12-01', expiresAt: '2026-06-01',
      riskLevel: '低', sourceOfTruth: '本地上传 / 客服FAQ汇编.docx', permScope: '客服团队',
      versions: [
        { label: 'v3.2', authoritative: true, note: '解析完成后生效' },
        { label: 'v3.1', authoritative: false, note: '2025-01 发布' },
      ],
    },
    {
      id: 'd9', title: '《渠道价格政策（外部版）》', version: 'v1.1', category: '销售政策', type: 'PDF',
      status: '存在冲突', statusNote: '存在冲突：与《价格管理办法》v1.3 折扣口径不一致，已阻断回答合成，请确认权威来源',
      size: '0.8 MB', pages: 10, owner: '李娜', updatedAt: '05-28 10:11',
      space: '销售弹药库', source: '企业网盘',
      validFrom: '2025-04-01', reviewDueAt: '2025-10-01', expiresAt: '2026-04-01',
      riskLevel: '高', sourceOfTruth: '企业网盘 / 渠道部 / 渠道价格政策.pdf', permScope: '渠道与销售团队',
      versions: [
        { label: 'v1.1', authoritative: false, note: '冲突待确认' },
        { label: 'v1.0', authoritative: false, note: '2024-09 发布' },
      ],
    },
    {
      id: 'd10', title: '《重点客户案例集（2024）》', version: 'v1.2', category: '客户案例', type: 'PPT',
      status: '已发布', size: '4.2 MB', pages: 38, owner: '王磊', updatedAt: '05-27 15:44',
      space: '销售弹药库', source: '本地上传',
      validFrom: '2025-01-01', reviewDueAt: '2025-07-01', expiresAt: '2026-01-01',
      riskLevel: '低', sourceOfTruth: '本地上传 / 重点客户案例集.pptx', permScope: '销售与售前团队',
      versions: [
        { label: 'v1.2', authoritative: true, note: '当前版本' },
        { label: 'v1.0', authoritative: false, note: '2024-06 发布' },
      ],
    },
  ]
}

/* ── 分页演示：确定性派生填充文档，使各空间文档总数与空间计数口径一致（共 128 份） ── */

const FILLER_TITLES = [
  '管理办法', '操作指引', '实施细则', '白皮书', 'FAQ 汇编', '培训讲义', '检查清单', '复盘报告',
]
const FILLER_OWNERS = ['张伟', '李娜', '王磊', '赵敏', '陈晨']
const FILLER_TYPES: DocRow['type'][] = ['PDF', 'Word', '表格', 'PPT', 'PDF', 'Word']
const FILLER_SOURCES: DocRow['source'][] = ['企业网盘', '飞书文档', '本地上传']
const FILLER_CATEGORY: Record<string, DocRow['category']> = {
  制度与流程: '制度流程',
  产品资料: '产品资料',
  销售弹药库: '销售政策',
  'IT·SOP': 'IT-SOP',
}

/** 填充文档标题前缀（默认伞空间用「综合」，其余取空间名去「资料」后缀） */
function fillerPrefix(space: string): string {
  if (space === SPACES[0].name) return '综合'
  return space.replace(/资料$/, '')
}

function makeFillerDoc(space: string, seq: number): DocRow {
  const kind = FILLER_TITLES[seq % FILLER_TITLES.length]
  const no = String(seq + 1).padStart(2, '0')
  const owner = FILLER_OWNERS[seq % FILLER_OWNERS.length]
  const type = FILLER_TYPES[seq % FILLER_TYPES.length]
  // 制度与流程前 2 份填充文档置为「待复审」（对齐空间待复审口径 3 = 1 真实 + 2 派生）
  const needReview = space === '制度与流程' && seq < 2
  const month = 3 + (seq % 3) // 03–05
  const day = String(1 + (seq % 27)).padStart(2, '0')
  return {
    id: `f-${space}-${seq}`,
    title: `《${fillerPrefix(space)}${kind} ${no}》`,
    version: `v1.${seq % 4}`,
    category: FILLER_CATEGORY[space] ?? 'FAQ',
    type,
    status: needReview ? '待复审' : '已发布',
    statusNote: needReview ? '复审到期：该文档已过复审期，回答权重已降低' : undefined,
    size: `${(0.4 + ((seq * 7) % 46) / 10).toFixed(1)} MB`,
    pages: 6 + ((seq * 5) % 40),
    owner,
    updatedAt: `${TODAY.slice(0, 4)}-0${month}-${day}`,
    space,
    source: FILLER_SOURCES[seq % FILLER_SOURCES.length],
    validFrom: '2026-01-01',
    reviewDueAt: '2026-07-01',
    expiresAt: '2027-01-01',
    riskLevel: '低',
    sourceOfTruth: `企业网盘 / ${space} / ${kind}${no}`,
    permScope: '全体成员可见',
    versions: [{ label: `v1.${seq % 4}`, authoritative: true, note: '当前版本' }],
  }
}

/**
 * 完整文档列表（128 份）：10 份手工示例 + 按空间计数确定性派生填充，
 * 供表格分页（每页 10 条）真实翻页与批量操作使用。
 */
export function makeFullDocuments(): DocRow[] {
  const base = makeDocuments()
  const result = [...base]
  for (const s of SPACES.slice(1)) {
    const real = base.filter((d) => d.space === s.name).length
    for (let i = 0; i < s.count - real; i += 1) {
      result.push(makeFillerDoc(s.name, i))
    }
  }
  // 默认伞空间补齐：命名空间合计 106 份，其余仅属默认空间，总数对齐伞空间 count（128）
  const umbrella = SPACES[0]
  const gap = umbrella.count - result.length
  for (let i = 0; i < gap; i += 1) {
    result.push(makeFillerDoc(umbrella.name, i))
  }
  return result
}
