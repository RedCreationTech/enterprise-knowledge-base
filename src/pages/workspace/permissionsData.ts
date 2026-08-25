/**
 * 权限管理页数据（design/permissions.md §5 + design.md V1.1-§10）
 * 成员 6 核心 + 6 折叠；身份映射 400/402 与 integrations 页同源。
 */

export interface PermissionLayer {
  icon: string
  name: string
  strategy: string
  stat: string
}

export const permissionLayers: PermissionLayer[] = [
  { icon: '🏢', name: '组织', strategy: '仅企业成员可访问，SSO 已启用', stat: '12 名成员' },
  { icon: '👥', name: '用户组', strategy: '4 个部门组 + 2 个自定义组', stat: '销售 14 · 售前 11 等' },
  { icon: '🗂', name: '空间', strategy: '5 个空间独立授权', stat: '128 份资料归属' },
  { icon: '📄', name: '文档', strategy: '默认继承空间，12 份单独加锁', stat: '如《渠道底价表》仅 3 人' },
  { icon: '🤖', name: '助手', strategy: '按目标用户组裁剪答案', stat: '2 个助手' },
]

export type MappingState = 'ok' | 'warning'
export type CoreRole = '管理员' | '知识管理员' | '空间管理员' | '文档审核员' | '助手运营员' | '普通成员'

export interface Member {
  id: string
  name: string
  dept: string
  role: CoreRole
  spaces: string
  spaceList: string[]
  mapping: MappingState
  mappingLabel: string
  lastActive: string
  core: boolean
}

export const coreMembers: Member[] = [
  { id: 'm-zw', name: '张伟', dept: '总经办', role: '管理员', spaces: '全部 5 个空间', spaceList: ['全部知识', '制度与流程', '产品资料', '销售弹药库', 'IT·SOP'], mapping: 'ok', mappingLabel: '✅ 飞书·企微', lastActive: '今天 10:26', core: true },
  { id: 'm-ln', name: '李娜', dept: '知识运营', role: '知识管理员', spaces: '全部空间（可编辑）', spaceList: ['全部知识', '制度与流程', '产品资料', '销售弹药库', 'IT·SOP'], mapping: 'ok', mappingLabel: '✅ 飞书', lastActive: '今天 09:52', core: true },
  { id: 'm-wq', name: '王强', dept: '产品部', role: '空间管理员', spaces: '产品资料 · IT·SOP', spaceList: ['产品资料', 'IT·SOP'], mapping: 'ok', mappingLabel: '✅ 企微', lastActive: '昨天 17:36', core: true },
  { id: 'm-zm', name: '赵敏', dept: '销售部', role: '文档审核员', spaces: '销售弹药库 · 制度与流程', spaceList: ['销售弹药库', '制度与流程'], mapping: 'ok', mappingLabel: '✅ 飞书', lastActive: '今天 08:44', core: true },
  { id: 'm-cc', name: '陈可', dept: 'IT 部', role: '助手运营员', spaces: 'IT·SOP · 产品资料', spaceList: ['IT·SOP', '产品资料'], mapping: 'warning', mappingLabel: '⚠ 飞书未映射', lastActive: '昨天 16:02', core: true },
  { id: 'm-ly', name: '刘洋', dept: '售前团队', role: '普通成员', spaces: '销售弹药库（可问答）', spaceList: ['销售弹药库'], mapping: 'warning', mappingLabel: '⚠ 企微未映射', lastActive: '今天 10:12', core: true },
]

export const foldedMembers: Member[] = [
  { id: 'm-s1', name: '孙倩', dept: '销售部', role: '普通成员', spaces: '销售弹药库（可问答）', spaceList: ['销售弹药库'], mapping: 'ok', mappingLabel: '✅ 飞书', lastActive: '今天 09:10', core: false },
  { id: 'm-s2', name: '周杰', dept: '售前部', role: '普通成员', spaces: '产品资料 · 销售弹药库', spaceList: ['产品资料', '销售弹药库'], mapping: 'ok', mappingLabel: '✅ 企微', lastActive: '昨天 15:44', core: false },
  { id: 'm-s3', name: '吴芳', dept: '客服部', role: '普通成员', spaces: '制度与流程', spaceList: ['制度与流程'], mapping: 'ok', mappingLabel: '✅ 飞书', lastActive: '今天 08:02', core: false },
  { id: 'm-s4', name: '郑浩', dept: '产品部', role: '普通成员', spaces: '产品资料', spaceList: ['产品资料'], mapping: 'ok', mappingLabel: '✅ 企微', lastActive: '05-27 18:20', core: false },
  { id: 'm-s5', name: '冯雪', dept: '市场部', role: '普通成员', spaces: '全部知识（可问答）', spaceList: ['全部知识'], mapping: 'ok', mappingLabel: '✅ 飞书', lastActive: '昨天 11:36', core: false },
  { id: 'm-s6', name: '何斌', dept: 'IT 部', role: '普通成员', spaces: 'IT·SOP', spaceList: ['IT·SOP'], mapping: 'ok', mappingLabel: '✅ 企微', lastActive: '05-26 14:05', core: false },
]

/** 身份映射（400/402，待映射 2 人，与 integrations 页同源） */
export const identityMapping = {
  feishu: '200/201',
  wecom: '200/201',
  pendingTotal: 2,
  pct: 99,
  unmapped: [
    { memberId: 'm-cc', name: '陈可', detail: '飞书账号 chenke@feishu 未绑定企业邮箱' },
    { memberId: 'm-ly', name: '刘洋', detail: '企微账号未匹配' },
  ],
}

/** 角色权限矩阵：9 权限项 × 6 角色 */
export const PERMISSION_ITEMS = [
  { key: 'view', name: '查看', tip: '浏览空间与文档内容' },
  { key: 'ask', name: '问答', tip: '向 AI 助手提问并获得裁剪后的答案' },
  { key: 'upload', name: '上传文档', tip: '上传资料到被授权的空间' },
  { key: 'edit', name: '编辑文档', tip: '编辑文档内容、版本与有效期' },
  { key: 'review', name: '审核发布', tip: '可将通过审核的文档发布到知识网站' },
  { key: 'space', name: '管理空间', tip: '创建/归档空间并配置空间权限' },
  { key: 'member', name: '管理成员', tip: '邀请成员、调整角色与用户组' },
  { key: 'integration', name: '管理集成', tip: '安装/配置/卸载渠道集成' },
  { key: 'api', name: 'API 开发', tip: '创建 API Key、配置 Webhook 与 Widget' },
] as const

export const ROLE_COLUMNS: { role: CoreRole; locked?: boolean }[] = [
  { role: '管理员', locked: true },
  { role: '知识管理员' },
  { role: '空间管理员' },
  { role: '文档审核员' },
  { role: '助手运营员' },
  { role: '普通成员' },
]

/** 初始矩阵：行=权限项 key，列=角色 */
export const initialMatrix: Record<string, Record<CoreRole, boolean>> = {
  view: { 管理员: true, 知识管理员: true, 空间管理员: true, 文档审核员: true, 助手运营员: true, 普通成员: true },
  ask: { 管理员: true, 知识管理员: true, 空间管理员: true, 文档审核员: true, 助手运营员: true, 普通成员: true },
  upload: { 管理员: true, 知识管理员: true, 空间管理员: true, 文档审核员: true, 助手运营员: false, 普通成员: false },
  edit: { 管理员: true, 知识管理员: true, 空间管理员: true, 文档审核员: false, 助手运营员: false, 普通成员: false },
  review: { 管理员: true, 知识管理员: true, 空间管理员: false, 文档审核员: true, 助手运营员: false, 普通成员: false },
  space: { 管理员: true, 知识管理员: true, 空间管理员: true, 文档审核员: false, 助手运营员: false, 普通成员: false },
  member: { 管理员: true, 知识管理员: false, 空间管理员: false, 文档审核员: false, 助手运营员: false, 普通成员: false },
  integration: { 管理员: true, 知识管理员: false, 空间管理员: false, 文档审核员: false, 助手运营员: true, 普通成员: false },
  api: { 管理员: true, 知识管理员: false, 空间管理员: false, 文档审核员: false, 助手运营员: true, 普通成员: false },
}

/** 权限预览工具（按成员视角） */
export interface MemberPreview {
  visibleSpaces: string[]
  trimmedSpaces: string[]
  demoQuestion: string
  refusal: string
  trimmedItems: { name: string; scope: string }[]
}

export const memberPreviews: Record<string, MemberPreview> = {
  'm-ly': {
    visibleSpaces: ['销售弹药库', '全部知识（裁剪后）'],
    trimmedSpaces: ['制度与流程', '产品资料', 'IT·SOP'],
    demoQuestion: '报价折扣的底价是多少？',
    refusal: '没有找到足够可靠的企业资料（部分内容需要更高权限）',
    trimmedItems: [{ name: '《渠道底价表》', scope: '仅 3 人可见' }],
  },
  'm-zm': {
    visibleSpaces: ['销售弹药库', '制度与流程', '全部知识（裁剪后）'],
    trimmedSpaces: ['产品资料', 'IT·SOP'],
    demoQuestion: '报价折扣的底价是多少？',
    refusal: '可以找到审批流程，但底价明细需要更高权限',
    trimmedItems: [{ name: '《渠道底价表》', scope: '仅 3 人可见' }],
  },
  'm-cc': {
    visibleSpaces: ['IT·SOP', '产品资料', '全部知识（裁剪后）'],
    trimmedSpaces: ['制度与流程', '销售弹药库'],
    demoQuestion: '报价折扣的底价是多少？',
    refusal: '没有找到足够可靠的企业资料（该主题不在你的可见空间内）',
    trimmedItems: [
      { name: '《渠道底价表》', scope: '仅 3 人可见' },
      { name: '《销售管理制度》', scope: '销售弹药库 · 未授权' },
    ],
  },
}

export const defaultPreview: MemberPreview = {
  visibleSpaces: ['全部 5 个空间'],
  trimmedSpaces: [],
  demoQuestion: '报价折扣的底价是多少？',
  refusal: '可查看全部空间的完整答案（含引用）',
  trimmedItems: [],
}

/** 审计日志（daysAgo 用于「近 7 天 / 近 30 天」真实过滤） */
export interface AuditLog {
  id: string
  time: string
  /** 距今天数：0=今天，1=昨天 */
  daysAgo: number
  operator: string
  action: string
  target: string
  result: string
  resultTone: 'success' | 'warning'
  type: '成员' | '空间' | '文档' | '系统'
}

export const initialAuditLogs: AuditLog[] = [
  { id: 'a1', time: '今天 09:30', daysAgo: 0, operator: '张伟', action: '修改空间可见范围', target: '销售弹药库 → 销售部+售前部', result: '已生效', resultTone: 'success', type: '空间' },
  { id: 'a2', time: '昨天 18:20', daysAgo: 1, operator: '系统', action: 'ACL 权限同步', target: '组织架构（428 人）', result: '完成', resultTone: 'success', type: '系统' },
  { id: 'a3', time: '昨天 15:12', daysAgo: 1, operator: '李娜', action: '文档单独加锁', target: '《渠道底价表》', result: '已生效', resultTone: 'success', type: '文档' },
  { id: 'a4', time: '05-27 11:05', daysAgo: 5, operator: '张伟', action: '角色变更', target: '陈可：普通成员 → 助手运营员', result: '已生效', resultTone: 'success', type: '成员' },
  { id: 'a5', time: '05-26 09:40', daysAgo: 6, operator: '系统', action: '权限校验失败告警', target: '外部访客访问受限文档', result: '已拦截', resultTone: 'warning', type: '系统' },
  { id: 'a6', time: '05-22 16:48', daysAgo: 10, operator: '李娜', action: '调整空间授权', target: '产品资料 → 产品部+售前部', result: '已生效', resultTone: 'success', type: '空间' },
  { id: 'a7', time: '05-18 10:15', daysAgo: 14, operator: '张伟', action: '邀请成员', target: '何斌（IT 部）', result: '已生效', resultTone: 'success', type: '成员' },
]

export const ALL_SPACES = ['全部知识', '制度与流程', '产品资料', '销售弹药库', 'IT·SOP'] as const
export const ALL_ROLES: CoreRole[] = ['管理员', '知识管理员', '空间管理员', '文档审核员', '助手运营员', '普通成员']

/** 五层权限配置 Drawer：按 permissionLayers 下标 0..4 对应 L1..L5 */
export const LAYER_DRAWER_META = [
  { title: 'L1 空间层配置', desc: '控制各空间对企业成员的可见性' },
  { title: 'L2 成员层配置', desc: '新加入成员的默认角色' },
  { title: 'L3 文档层配置', desc: '文档密级标签体系，未启用的密级不可打标' },
  { title: 'L4 字段层配置', desc: '敏感字段在检索与回答中的脱敏规则' },
  { title: 'L5 行级层配置', desc: '行级数据访问规则（按条件裁剪记录）' },
] as const

export interface RowRule {
  id: string
  name: string
  condition: string
}

/** 五层权限配置（页面 state 初始值，保存在 Permissions 页生效） */
export interface LayerConfig {
  /** L1 空间可见性开关组 */
  spaceVisibility: Record<string, boolean>
  /** L2 新成员默认角色 */
  defaultRole: CoreRole
  /** L3 文档密级标签开关 */
  docSecLabels: Record<string, boolean>
  /** L4 敏感字段脱敏开关组 */
  fieldMasking: Record<string, boolean>
  /** L5 行级规则列表 */
  rowRules: RowRule[]
}

export const initialLayerConfig: LayerConfig = {
  spaceVisibility: { 全部知识: true, 制度与流程: true, 产品资料: true, 销售弹药库: false, 'IT·SOP': true },
  defaultRole: '普通成员',
  docSecLabels: { 公开: true, 内部: true, 机密: true, 绝密: false },
  fieldMasking: { 手机号: true, 身份证号: true, 银行卡号: false, 薪资字段: true },
  rowRules: [
    { id: 'r1', name: '销售仅见本部线索', condition: 'dept = 当前用户部门' },
    { id: 'r2', name: '薪资表仅 HR 可见', condition: 'table = 薪资表 AND role = HR' },
  ],
}

/** 手动映射可选的企业账号池（绑定后从池中移除） */
export const enterpriseAccounts = [
  'chenke@corp.example.com（陈可·企业邮箱）',
  'liuyang@corp.example.com（刘洋·企业邮箱）',
  'hr-sync@corp.example.com（HR 同步账号）',
]
