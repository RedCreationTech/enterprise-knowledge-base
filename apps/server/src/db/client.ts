import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_DB_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data/kb.sqlite')

/**
 * 打开（或创建）一个 SQLite 库。
 * - 文件路径：自动创建父目录并启用 WAL。
 * - `:memory:`：内存库（每连接独立，仅适用于单连接场景，如测试）。
 */
export function createDb(dbPath: string) {
  if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true })
  const database = new Database(dbPath)
  if (dbPath !== ':memory:') database.pragma('journal_mode = WAL')
  return database
}

/**
 * 进程级单例：默认 `data/kb.sqlite`，可用 `KB_DB_PATH` 覆盖（测试隔离用）。
 */
export const db = createDb(process.env.KB_DB_PATH ?? DEFAULT_DB_PATH)
