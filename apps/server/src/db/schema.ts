import { db } from './client.js'
const T = (sql: string) => db.exec(sql)
export function createSchema() {
  T(`CREATE TABLE IF NOT EXISTS org (id TEXT PRIMARY KEY, name TEXT, industry TEXT, contact TEXT, demoData INTEGER)`)
  T(`CREATE TABLE IF NOT EXISTS plan (id TEXT PRIMARY KEY, tier TEXT, storageUsedGB REAL, storageTotalGB REAL, seats INTEGER, seatsUsed INTEGER, validUntil TEXT)`)
  T(`CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT, dept TEXT, status TEXT, joinedAt TEXT)`)
  T(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, memberId TEXT, email TEXT, passwordHash TEXT, role TEXT)`)
  T(`CREATE TABLE IF NOT EXISTS trial_journey (id INTEGER PRIMARY KEY CHECK (id = 1), activated INTEGER, step INTEGER, installedApps TEXT, uninstalledApps TEXT, userInstalledApps TEXT, invitesSent INTEGER, configProgress INTEGER)`)
  T(`CREATE TABLE IF NOT EXISTS trial_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, companyName TEXT NOT NULL, contact TEXT NOT NULL, agreeToTerms INTEGER NOT NULL, createdAt TEXT NOT NULL)`)
  T(`CREATE TABLE IF NOT EXISTS spaces (id TEXT PRIMARY KEY, name TEXT, count INTEGER, health TEXT, reviewCycle INTEGER, archived INTEGER, createdAt TEXT)`)
  T(`CREATE TABLE IF NOT EXISTS docs (id TEXT PRIMARY KEY, spaceId TEXT, title TEXT, type TEXT, category TEXT, status TEXT, owner TEXT, updatedAt TEXT, source TEXT)`)
}
