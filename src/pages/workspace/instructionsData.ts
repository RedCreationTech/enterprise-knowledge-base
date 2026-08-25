/**
 * 指令管理页数据（design/instructions.md §5 + design.md V1.1-§10）
 * 数字口径与 base.mock.ts / design.md §10 保持一致。
 */
import { TODAY } from '@/mocks'

export interface InstructionTemplate {
  id: string
  icon: string
  name: string
  positioning: string
  inUse: boolean
  usedBy?: string
}

export const instructionTemplates: InstructionTemplate[] = [
  { id: 'tpl-sales', icon: '💼', name: '销售助手', positioning: '强调报价与案例依据，风格专业果断', inUse: true, usedBy: '销售知识助手' },
  { id: 'tpl-service', icon: '🎧', name: '客服助手', positioning: '语气温和，优先给步骤化回答', inUse: true, usedBy: '企业微信知识助手' },
  { id: 'tpl-staff', icon: '👥', name: '员工助手', positioning: '制度类问题严格引用原文条款', inUse: false },
  { id: 'tpl-it', icon: '🛠', name: 'IT·SOP', positioning: '故障处理分步引导，无依据即拒答', inUse: false },
]

export type InstructionStatus = '生效中' | '草稿' | '已停用'
export type InstructionType = '系统' | '自定义'

/** 生效范围可选项：助手 × 渠道（「修改范围」选择器） */
export const SCOPE_ASSISTANTS = ['企业知识助手', '销售知识助手'] as const
export const SCOPE_CHANNELS = ['工作台', '知识网站', 'API', 'IM'] as const

/** 草稿首次发布时的默认生效范围 */
export const DEFAULT_PUBLISH_SCOPE = ['企业知识助手', '工作台']

export interface Instruction {
  id: string
  name: string
  type: InstructionType
  /** 类型补充说明，如「源自销售助手模板」 */
  typeNote?: string
  version: string
  scope: string[]
  scopeLabel: string
  updatedAt: string
  updatedBy: string
  status: InstructionStatus
  /** 四组业务语言参数 */
  style: '专业严谨' | '简洁直接' | '亲切易懂'
  strictness: number // 1–5
  rejectStrategy: '明确告知并给出建议' | '转人工' | '仅回答公开内容'
  showCitations: boolean
  text: string
  readonly?: boolean
}

export const DEFAULT_INSTRUCTION_TEXT =
  '你是{企业名称}的销售知识助手。回答报价与折扣问题时，必须引用{知识范围}内的最新制度版本；不确定时直接说明，不要推测具体数字。'

export const initialInstructions: Instruction[] = [
  {
    id: 'ins-sales',
    name: '销售标准回答指令',
    type: '自定义',
    typeNote: '源自销售助手模板',
    version: 'v2.3',
    scope: ['销售知识助手', '飞书渠道'],
    scopeLabel: '销售知识助手 · 飞书渠道',
    updatedAt: '05-28',
    updatedBy: '李娜',
    status: '生效中',
    style: '专业严谨',
    strictness: 4,
    rejectStrategy: '明确告知并给出建议',
    showCitations: true,
    text: DEFAULT_INSTRUCTION_TEXT,
  },
  {
    id: 'ins-service',
    name: '客服温和回答指令',
    type: '自定义',
    version: 'v1.8',
    scope: ['企业微信知识助手'],
    scopeLabel: '企业微信知识助手',
    updatedAt: '05-26',
    updatedBy: '张伟',
    status: '生效中',
    style: '亲切易懂',
    strictness: 3,
    rejectStrategy: '转人工',
    showCitations: true,
    text: '你是{企业名称}的客服知识助手。语气温和，优先给出步骤化回答；涉及售后的政策必须引用{知识范围}内的最新版本。',
  },
  {
    id: 'ins-global',
    name: '全局默认指令',
    type: '系统',
    version: 'v1.0',
    scope: ['全部助手（兜底）'],
    scopeLabel: '全部助手（兜底）',
    updatedAt: '04-02',
    updatedBy: '系统',
    status: '生效中',
    style: '简洁直接',
    strictness: 3,
    rejectStrategy: '明确告知并给出建议',
    showCitations: true,
    text: '你是{企业名称}的知识助手。仅基于{知识范围}内的资料回答，每个结论都标明来源；没有依据时不要编造。',
    readonly: true,
  },
  {
    id: 'ins-quote-draft',
    name: '报价严格模式（草稿）',
    type: '自定义',
    version: 'v0.2-draft',
    scope: ['未发布'],
    scopeLabel: '未发布',
    updatedAt: '今天 09:15',
    updatedBy: '张伟',
    status: '草稿',
    style: '专业严谨',
    strictness: 5,
    rejectStrategy: '仅回答公开内容',
    showCitations: true,
    text: '报价相关问题的回答必须逐条引用制度原文；没有制度依据时仅回答公开价格政策，不推测内部底价。',
  },
]

/** localStorage 元素级校验（loadLSArray 用）：剔除损坏/非指令条目 */
export function isInstruction(x: unknown): x is Instruction {
  if (typeof x !== 'object' || x === null) return false
  const s = x as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    (s.type === '系统' || s.type === '自定义') &&
    typeof s.version === 'string' &&
    Array.isArray(s.scope) &&
    s.scope.every((v) => typeof v === 'string') &&
    typeof s.scopeLabel === 'string' &&
    typeof s.updatedAt === 'string' &&
    typeof s.updatedBy === 'string' &&
    (s.status === '生效中' || s.status === '草稿' || s.status === '已停用') &&
    (s.style === '专业严谨' || s.style === '简洁直接' || s.style === '亲切易懂') &&
    typeof s.strictness === 'number' &&
    (s.rejectStrategy === '明确告知并给出建议' || s.rejectStrategy === '转人工' || s.rejectStrategy === '仅回答公开内容') &&
    typeof s.showCitations === 'boolean' &&
    typeof s.text === 'string'
  )
}

/** 变量插入 Chips（点击插入光标处，预览渲染为真实值） */
export const INSTRUCTION_VARIABLES = ['{企业名称}', '{知识范围}', '{助手名称}', '{当前日期}'] as const

export const VARIABLE_VALUES: Record<string, string> = {
  '{企业名称}': '示例科技有限公司',
  '{知识范围}': '全部知识空间',
  '{助手名称}': '销售知识助手',
  '{当前日期}': TODAY,
}

/** 版本历史（v2.2 vs v2.3 对比 Modal） */
export interface InstructionVersion {
  version: string
  updatedAt: string
  updatedBy: string
  text: string
  note: string
}

export const instructionVersions: InstructionVersion[] = [
  {
    version: 'v2.3',
    updatedAt: '05-28 14:20',
    updatedBy: '李娜',
    text: DEFAULT_INSTRUCTION_TEXT,
    note: '当前生效版本：新增「不确定时直接说明，不要推测具体数字」拒答表述。',
  },
  {
    version: 'v2.2',
    updatedAt: '05-12 10:05',
    updatedBy: '李娜',
    text: '你是{企业名称}的销售知识助手。回答报价与折扣问题时，应引用{知识范围}内的制度文件。',
    note: '上一版本：引用要求为「应引用」，约束力较弱。',
  },
]

/** 严格程度档位说明（滑杆 5 档，默认 4「偏严格」） */
export const STRICTNESS_LABELS = ['尽量回答', '偏宽松', '适中', '偏严格', '没有依据就不回答'] as const

export function strictnessHint(level: number): string {
  if (level >= 5) return '任何没有明确依据的问题都将拒答并给出下一步'
  if (level === 4) return '可信度低于 85 分时将拒答并给出下一步'
  if (level === 3) return '可信度低于 70 分时将提示不确定并给出参考'
  if (level === 2) return '可信度低于 55 分时才提示不确定'
  return '尽量给出回答，仅在完全没有资料时拒答'
}

/** 测试预览：示例问题与答案（复用 answer 口径 92% 可信度、3 引用） */
export const PREVIEW_QUESTIONS = [
  '客户报价折扣超过 10% 需要谁审批？',
  '差旅报销标准是什么？',
  '请假审批需要几天？',
]

export interface PreviewAnswer {
  conclusion: string
  explanation: string
  trust: number
  citations: { name: string; version: string; page: string }[]
}

export const previewAnswer: PreviewAnswer = {
  conclusion: '需要销售总监审批。',
  explanation: '根据《销售管理制度》v2.1 规定：折扣 ≤10% 由销售经理审批；超过 10% 需销售总监审批，超过 20% 需总经理审批。',
  trust: 92,
  citations: [
    { name: '《销售管理制度》', version: 'v2.1', page: '第 8 页' },
    { name: '《审批权限矩阵表》', version: 'v3.0', page: '第 2 页' },
  ],
}

/** 拒答演示卡（严格程度最高档 / 底部演示链接共用） */
export const previewRefusal = {
  reason: '没有找到足够可靠的企业资料来回答这个问题',
  next: '可以上传相关制度文档，或指定该主题的负责人补充知识',
  closest: '《销售管理制度》· 折扣审批流程',
}
