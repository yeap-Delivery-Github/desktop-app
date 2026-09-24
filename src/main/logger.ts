import { app } from 'electron'
import fs from 'fs'
import path from 'path'

type LogLevel = 'info' | 'warn' | 'error'

const LOG_FILE = path.join(app.getPath('userData'), 'app.log')

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields })
  console.log(line)
  fs.appendFileSync(LOG_FILE, `${line}\n`)
}
