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

export function seedIfEmpty() {
  const n = (db.prepare('SELECT COUNT(*) c FROM org').get() as { c: number }).c
  if (n > 0) return
  db.prepare(`INSERT INTO org (id, name, industry, contact, demoData) VALUES ('org-1', '示例科技有限公司', '软件与信息技术服务', 'zhangwei@example.com', 0)`).run()
  db.prepare(`INSERT INTO plan VALUES ('plan-1', '试用版', 0.68, 1, 20, 12, '2025-06-03')`).run()
  const ins = db.prepare(`INSERT INTO members VALUES (?,?,?,?,?,?,?)`)
  for (const m of members) ins.run(...m)
  db.prepare(`INSERT INTO users (id, memberId, email, passwordHash, role) VALUES ('u-1', 'm-zw', 'zhangwei@example.com', NULL, '管理员')`).run()
  db.prepare(`INSERT INTO trial_journey (id,activated,step,installedApps,uninstalledApps,userInstalledApps,invitesSent,configProgress) VALUES (1,0,0,'["wecom-qa","custom-api","sso"]','[]','[]',0,0)`).run()
}
