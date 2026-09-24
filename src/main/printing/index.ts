import { randomUUID } from 'crypto'
import { log } from '../logger'
import {
  parseLegacyPrintJob,
  parsePrintDocumentRequest,
  PrintDocumentRequest,
  PrinterConnection
} from './contract'
import { renderEscPos } from './escpos'
import { printHtml } from './html-print'
import { renderHtml } from './html-render'
import { enqueue } from './queue'
import { sendRaw } from './raw-transport'

export type PrintResult =
  | { jobId: string; success: true }
  | { jobId: string; success: false; error: string }

export async function printLegacyHtml(payload: unknown): Promise<void> {
  const job = parseLegacyPrintJob(payload)
  if (job.copies === 0) return

  const jobId = randomUUID()
  const connection: PrinterConnection = { type: 'windows', name: job.printerName }
  await enqueue(queueKey(connection), () =>
    tracked(jobId, { mode: 'legacy-html', printer: job.printerName, copies: job.copies }, () =>
      printHtml(job, jobId)
    )
  )
}

export async function printDocument(payload: unknown): Promise<PrintResult> {
  const jobId = randomUUID()
  let request: PrintDocumentRequest

  try {
    request = parsePrintDocumentRequest(payload)
  } catch (error) {
    log('warn', 'print.rejected', { jobId, error: (error as Error).message })
    return { jobId, success: false, error: (error as Error).message }
  }

  if (request.copies === 0) return { jobId, success: true }

  const { connection, mode } = request.printer
  const fields = {
    mode,
    connection: connection.type,
    printer: printerLabel(connection),
    copies: request.copies,
    blocks: request.document.blocks.length
  }

  try {
    await enqueue(queueKey(connection), () =>
      tracked(jobId, fields, () => executeDocument(request, jobId))
    )
    return { jobId, success: true }
  } catch (error) {
    return { jobId, success: false, error: (error as Error).message }
  }
}

function executeDocument(request: PrintDocumentRequest, jobId: string): Promise<void> {
  const { document, copies, printer } = request

  if (printer.mode === 'html' && printer.connection.type === 'windows') {
    const html = renderHtml(document, printer.paperWidthMm)
    return printHtml(
      { html, printerName: printer.connection.name, copies, paperWidthMm: printer.paperWidthMm },
      jobId
    )
  }

  const bytes = renderEscPos(document, printer)
  const data = Buffer.concat(Array.from({ length: copies }, () => bytes))
  return sendRaw(printer.connection, data, `Yeap Delivery ${jobId}`)
}

async function tracked(
  jobId: string,
  fields: Record<string, unknown>,
  task: () => Promise<void>
): Promise<void> {
  const startedAt = Date.now()
  log('info', 'print.started', { jobId, ...fields })

  try {
    await task()
    log('info', 'print.completed', { jobId, ...fields, durationMs: Date.now() - startedAt })
  } catch (error) {
    log('error', 'print.failed', {
      jobId,
      ...fields,
      error: (error as Error).message,
      durationMs: Date.now() - startedAt
    })
    throw error
  }
}

function queueKey(connection: PrinterConnection): string {
  return `${connection.type}:${printerLabel(connection)}`
}

function printerLabel(connection: PrinterConnection): string {
  return connection.type === 'windows' ? connection.name : `${connection.host}:${connection.port}`
}
