import { app, BrowserWindow, WebContents, WebContentsPrintOptions } from 'electron'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { log } from './logger'

export interface PrintJob {
  couponHtml: string
  printerName: string
  copiesCount: number
  paperWidthMm?: number
}

const LOAD_TIMEOUT_MS = 15_000
const PRINT_TIMEOUT_MS = 30_000
const MAX_COPIES = 20
const MIN_PAGE_MICRONS = 353
const CSS_PX_PER_MM = 96 / 25.4

const queues = new Map<string, Promise<void>>()

export function parsePrintJob(payload: unknown): PrintJob {
  const { couponHtml, printerName, copiesCount, paperWidthMm } = (payload ?? {}) as Record<
    string,
    unknown
  >
  const copies = Number(copiesCount)

  if (typeof couponHtml !== 'string' || couponHtml.length === 0) {
    throw new Error('Cupom inválido')
  }
  if (typeof printerName !== 'string' || printerName.length === 0) {
    throw new Error('Impressora não informada')
  }
  if (!Number.isInteger(copies) || copies < 0 || copies > MAX_COPIES) {
    throw new Error(`Quantidade de cópias inválida (0 a ${MAX_COPIES})`)
  }
  if (paperWidthMm !== undefined && (typeof paperWidthMm !== 'number' || paperWidthMm <= 0)) {
    throw new Error('Largura do papel inválida')
  }

  return { couponHtml, printerName, copiesCount: copies, paperWidthMm }
}

export function enqueuePrint(job: PrintJob): Promise<void> {
  const tail = queues.get(job.printerName) ?? Promise.resolve()
  const run = tail.then(() => runJob(job, randomUUID()))
  const nextTail = run.catch(() => undefined)

  queues.set(job.printerName, nextTail)
  nextTail.then(() => {
    if (queues.get(job.printerName) === nextTail) queues.delete(job.printerName)
  })

  return run
}

async function runJob(job: PrintJob, jobId: string): Promise<void> {
  if (job.copiesCount === 0) return

  const startedAt = Date.now()
  const filePath = path.join(app.getPath('temp'), `yeap-print-${jobId}.html`)
  const printWindow = new BrowserWindow({
    show: false,
    width: job.paperWidthMm ? Math.round(job.paperWidthMm * CSS_PX_PER_MM) : 800,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })

  log('info', 'print.started', {
    jobId,
    printer: job.printerName,
    copies: job.copiesCount,
    paperWidthMm: job.paperWidthMm
  })

  try {
    await fs.writeFile(filePath, job.couponHtml, 'utf-8')
    await withTimeout(
      printWindow.loadFile(filePath),
      LOAD_TIMEOUT_MS,
      'Tempo esgotado ao carregar o cupom'
    )

    const printers = await printWindow.webContents.getPrintersAsync()
    const printer = printers.find((p) => p.name === job.printerName)
    if (!printer) throw new Error(`Impressora ${job.printerName} não encontrada`)

    const contentHeightPx: number = await printWindow.webContents.executeJavaScript(
      'document.fonts.ready.then(() => document.documentElement.scrollHeight)'
    )
    const options = buildPrintOptions(job, contentHeightPx)

    for (let copy = 1; copy <= job.copiesCount; copy++) {
      await withTimeout(
        print(printWindow.webContents, options),
        PRINT_TIMEOUT_MS,
        'Tempo esgotado aguardando a impressora'
      )
    }

    log('info', 'print.completed', {
      jobId,
      printer: job.printerName,
      durationMs: Date.now() - startedAt
    })
  } catch (error) {
    log('error', 'print.failed', {
      jobId,
      printer: job.printerName,
      error: (error as Error).message,
      durationMs: Date.now() - startedAt
    })
    throw error
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
    await fs.rm(filePath, { force: true })
  }
}

function buildPrintOptions(job: PrintJob, contentHeightPx: number): WebContentsPrintOptions {
  const options: WebContentsPrintOptions = {
    silent: true,
    printBackground: true,
    deviceName: job.printerName,
    margins: { marginType: 'none' }
  }

  if (job.paperWidthMm) {
    options.pageSize = {
      width: Math.max(Math.round(job.paperWidthMm * 1000), MIN_PAGE_MICRONS),
      height: Math.max(Math.ceil((contentHeightPx / CSS_PX_PER_MM) * 1000), MIN_PAGE_MICRONS)
    }
  }

  return options
}

function print(contents: WebContents, options: WebContentsPrintOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    contents.print(options, (success, failureReason) => {
      if (success) return resolve()
      reject(new Error(`Falha na impressão: ${failureReason}`))
    })
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
