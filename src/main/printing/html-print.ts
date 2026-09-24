import { app, BrowserWindow, WebContents, WebContentsPrintOptions } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { withTimeout } from './queue'

export interface HtmlPrintJob {
  html: string
  printerName: string
  copies: number
  paperWidthMm?: number
}

const LOAD_TIMEOUT_MS = 15_000
const PRINT_TIMEOUT_MS = 30_000
const MIN_PAGE_MICRONS = 353
const CSS_PX_PER_MM = 96 / 25.4

export async function printHtml(job: HtmlPrintJob, jobId: string): Promise<void> {
  const filePath = path.join(app.getPath('temp'), `yeap-print-${jobId}.html`)
  const printWindow = new BrowserWindow({
    show: false,
    width: job.paperWidthMm ? Math.round(job.paperWidthMm * CSS_PX_PER_MM) : 800,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })

  try {
    await fs.writeFile(filePath, job.html, 'utf-8')
    await withTimeout(
      printWindow.loadFile(filePath),
      LOAD_TIMEOUT_MS,
      'Tempo esgotado ao carregar o cupom'
    )

    const printers = await printWindow.webContents.getPrintersAsync()
    if (!printers.some((p) => p.name === job.printerName)) {
      throw new Error(`Impressora ${job.printerName} não encontrada`)
    }

    const contentHeightPx: number = await printWindow.webContents.executeJavaScript(
      'document.fonts.ready.then(() => document.documentElement.scrollHeight)'
    )
    const options = buildPrintOptions(job, contentHeightPx)

    for (let copy = 1; copy <= job.copies; copy++) {
      await withTimeout(
        print(printWindow.webContents, options),
        PRINT_TIMEOUT_MS,
        'Tempo esgotado aguardando a impressora'
      )
    }
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
    await fs.rm(filePath, { force: true })
  }
}

function buildPrintOptions(job: HtmlPrintJob, contentHeightPx: number): WebContentsPrintOptions {
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
