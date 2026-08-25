/**
 * 唯一 id 生成器。
 * 本任务仅建立该工具；页面内 `Date.now()` 直接当 id 的消费点由后续任务替换。
 */

let counter = 0

/** 生成唯一 id：时间戳（36 进制）+ 递增计数 + 随机片段，避免同毫秒冲突 */
export function uid(): string {
  counter += 1
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${time}-${counter.toString(36)}-${rand}`
}
