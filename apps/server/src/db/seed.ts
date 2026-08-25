import { db } from './client.js'
const members = [
  ['m-zw','张伟','zhangwei@example.com','管理员','总经办','活跃','2024-04-02'],
  ['m-ln','李娜','lina@example.com','可编辑','人力资源','活跃','2024-04-02'],
  ['m-wq','王强','wangqiang@example.com','可问答','产品部','活跃','2024-04-05'],
  ['m-zm','赵敏','zhaomin@example.com','可问答','销售部','活跃','2024-04-08'],
  ['m-cc','陈可','chenke@example.com','可问答','IT 部','待激活','2024-04-10'],
  ['m-ly','刘洋','liuyang@example.com','可问答','客服部','待激活','2024-04-12'],
] as const
export function seedIfEmpty() {
  const n = (db.prepare('SELECT COUNT(*) c FROM org').get() as { c: number }).c
  if (n > 0) return
  db.prepare(`INSERT INTO org VALUES ('org-1','示例科技有限公司','软件服务','zhangwei@example.com')`).run()
  db.prepare(`INSERT INTO plan VALUES ('plan-1','试用版',0.68,1,20,12,'2025-06-03')`).run()
  const ins = db.prepare(`INSERT INTO members VALUES (?,?,?,?,?,?,?)`)
  for (const m of members) ins.run(...m)
  db.prepare(`INSERT INTO users VALUES ('u-1','m-zw','zhangwei@example.com','管理员')`).run()
  db.prepare(`INSERT INTO trial_journey (id,activated,step,installedApps,uninstalledApps,userInstalledApps,invitesSent,configProgress) VALUES (1,0,0,'["wecom-qa","custom-api","sso"]','[]','[]',0,0)`).run()
}
