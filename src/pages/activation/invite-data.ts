/**
 * 邀请同事页 mock：39 人完整名册（销售 14 / 售前 11 / 客服 8 / 产品 6）。
 * 前 7 行逐字还原 ui-mockups 图 3；状态枚举与 product-requirements §6 对齐。
 */

export type InviteeStatus = '已发送' | '待处理' | '待发送' | '发送失败'

export interface Invitee {
  id: string
  name: string
  team: string
  contact: string
  status: InviteeStatus
  invitedAt: string | null
}

function person(id: string, name: string, team: string, contact: string, status: InviteeStatus, invitedAt: string | null): Invitee {
  return { id, name, team, contact, status, invitedAt }
}

const SENT = '今天 10:28'

/** 销售团队 14 人（陈晨待处理；蒋欣/沈涛为发送失败演示位） */
const SALES: Invitee[] = [
  person('s01', '张伟', '销售团队', 'zhangwei@example.com', '已发送', SENT),
  person('s02', '李娜', '销售团队', 'lina@example.com', '已发送', SENT),
  person('s03', '王磊', '销售团队', '138 0000 0001', '已发送', SENT),
  person('s04', '陈晨', '销售团队', 'chenchen@example.com', '待处理', null),
  person('s05', '孙倩', '销售团队', 'sunqian@example.com', '已发送', SENT),
  person('s06', '吴昊', '销售团队', 'wuhao@example.com', '已发送', SENT),
  person('s07', '郑凯', '销售团队', 'zhengkai@example.com', '已发送', SENT),
  person('s08', '冯雪', '销售团队', 'fengxue@example.com', '已发送', SENT),
  person('s09', '褚亮', '销售团队', '138 0000 0002', '已发送', SENT),
  person('s10', '卫东', '销售团队', 'weidong@example.com', '已发送', SENT),
  person('s11', '蒋欣', '销售团队', 'jiangxin@example.com', '已发送', SENT),
  person('s12', '沈涛', '销售团队', 'shentao@example.com', '已发送', SENT),
  person('s13', '韩梅', '销售团队', 'hanmei@example.com', '已发送', SENT),
  person('s14', '杨帆', '销售团队', 'yangfan@example.com', '已发送', SENT),
]

/** 售前团队 11 人（刘洋待处理） */
const PRESALES: Invitee[] = [
  person('p01', '赵敏', '售前团队', 'zhaomin@example.com', '已发送', SENT),
  person('p02', '刘洋', '售前团队', 'liuyang@example.com', '待处理', null),
  person('p03', '周杰', '售前团队', 'zhoujie@example.com', '已发送', SENT),
  person('p04', '徐静', '售前团队', 'xujing@example.com', '已发送', SENT),
  person('p05', '高翔', '售前团队', 'gaoxiang@example.com', '已发送', SENT),
  person('p06', '林芳', '售前团队', 'linfang@example.com', '已发送', SENT),
  person('p07', '何勇', '售前团队', '138 0000 0003', '已发送', SENT),
  person('p08', '郭丽', '售前团队', 'guoli@example.com', '已发送', SENT),
  person('p09', '马俊', '售前团队', 'majun@example.com', '已发送', SENT),
  person('p10', '罗成', '售前团队', 'luocheng@example.com', '已发送', SENT),
  person('p11', '梁爽', '售前团队', 'liangshuang@example.com', '已发送', SENT),
]

/** 客服团队 8 人（团队未选，默认待发送） */
const SUPPORT: Invitee[] = [
  person('c01', '宋佳', '客服团队', 'songjia@example.com', '待发送', null),
  person('c02', '唐明', '客服团队', 'tangming@example.com', '待发送', null),
  person('c03', '许诺', '客服团队', 'xunuo@example.com', '待发送', null),
  person('c04', '邓辉', '客服团队', 'denghui@example.com', '待发送', null),
  person('c05', '曹颖', '客服团队', 'caoying@example.com', '待发送', null),
  person('c06', '彭浩', '客服团队', 'penghao@example.com', '待发送', null),
  person('c07', '肖露', '客服团队', 'xiaolu@example.com', '待发送', null),
  person('c08', '田甜', '客服团队', '138 0000 0004', '待发送', null),
]

/** 产品团队 6 人（团队未选，默认待发送） */
const PRODUCT: Invitee[] = [
  person('d01', '袁媛', '产品团队', 'yuanyuan@example.com', '待发送', null),
  person('d02', '董斌', '产品团队', 'dongbin@example.com', '待发送', null),
  person('d03', '范磊', '产品团队', 'fanlei@example.com', '待发送', null),
  person('d04', '方圆', '产品团队', 'fangyuan@example.com', '待发送', null),
  person('d05', '石磊', '产品团队', 'shilei@example.com', '待发送', null),
  person('d06', '姚远', '产品团队', 'yaoyuan@example.com', '待发送', null),
]

export const initialInvitees: Invitee[] = [...SALES, ...PRESALES, ...SUPPORT, ...PRODUCT]

/** 发送模拟：这 2 人会进入「发送失败」（默认仅选客服团队时，c03 唐明失败 → 部分成功/重试流程可达） */
export const FAIL_IDS = ['s11', 'c02']

export const INVITE_LINK = 'https://kb-abc123.example.com/t/invite-7d'

/** 重新生成试用链接：随机 4 位后缀（invite-XXXX） */
export function makeInviteLink(): string {
  const suffix = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  return `https://kb-abc123.example.com/t/invite-${suffix}`
}

/** 终端体验预览消息（图 3 右栏卡 2，逐字） */
export const TERMINAL_PREVIEW = {
  title: '企业知识助手',
  userMsg: '我们的差旅报销标准是什么？',
  aiMsg:
    '根据《差旅费用报销管理办法》，差旅报销标准如下：\n1. 交通费：按城市级别执行相应标准\n2. 住宿费：一线城市不超过 600 元/晚\n3. 餐饮费：每人每日不超过 150 元',
  citations: ['《差旅费用报销管理办法》 v1.2 · 第 3 页', '《员工差旅管理制度》 v2.0 · 第 6 页'],
  docs: ['差旅费用报销管理办法', '员工差旅管理制度', '财务报销 FAQ'],
}
