import { isIPv4 } from 'net'
import type { HtmlPrintJob } from './html-print'

export type Align = 'left' | 'center' | 'right'
export type CodePage = 'cp850' | 'cp860' | 'ascii'
export type PaperWidthMm = 58 | 80

export type Block =
  | { type: 'text'; value: string; align: Align; bold: boolean; size: 1 | 2 }
  | { type: 'row'; left: string; right: string; bold: boolean }
  | { type: 'separator' }
  | { type: 'feed'; lines: number }
  | { type: 'cut' }

export interface PrintDocument {
  version: 1
  blocks: Block[]
}

export type PrinterConnection =
  | { type: 'windows'; name: string }
  | { type: 'network'; host: string; port: number }

export interface PrinterTarget {
  mode: 'escpos' | 'html'
  connection: PrinterConnection
  paperWidthMm: PaperWidthMm
  codePage: CodePage
}

export interface PrintDocumentRequest {
  printer: PrinterTarget
  document: PrintDocument
  copies: number
}

const MAX_COPIES = 20
const MAX_BLOCKS = 1000
const MAX_TEXT_LENGTH = 2000
const MAX_FEED_LINES = 10
const DEFAULT_NETWORK_PORT = 9100
const ALLOWED_NETWORK_PORTS = [9100, 9101, 9102]

type Json = Record<string, unknown>

export function parsePrintDocumentRequest(payload: unknown): PrintDocumentRequest {
  const { printer, document, copies } = asObject(payload, 'Requisição de impressão inválida')
  return {
    printer: parsePrinterTarget(printer),
    document: parseDocument(document),
    copies: parseCopies(copies)
  }
}

export function parseLegacyPrintJob(payload: unknown): HtmlPrintJob {
  const { couponHtml, printerName, copiesCount, paperWidthMm } = asObject(payload, 'Cupom inválido')

  if (typeof couponHtml !== 'string' || couponHtml.length === 0) {
    throw new Error('Cupom inválido')
  }
  if (paperWidthMm !== undefined && (typeof paperWidthMm !== 'number' || paperWidthMm <= 0)) {
    throw new Error('Largura do papel inválida')
  }

  return {
    html: couponHtml,
    printerName: parsePrinterName(printerName),
    copies: parseCopies(copiesCount),
    paperWidthMm
  }
}

function parsePrinterTarget(value: unknown): PrinterTarget {
  const {
    mode,
    connection,
    paperWidthMm,
    codePage = 'cp850'
  } = asObject(value, 'Impressora não informada')

  if (mode !== 'escpos' && mode !== 'html') throw new Error('Modo de impressão inválido')
  if (paperWidthMm !== 58 && paperWidthMm !== 80) throw new Error('Largura do papel inválida')
  if (codePage !== 'cp850' && codePage !== 'cp860' && codePage !== 'ascii') {
    throw new Error('Code page inválida')
  }

  const parsedConnection = parseConnection(connection)
  if (mode === 'html' && parsedConnection.type !== 'windows') {
    throw new Error('Impressão HTML exige uma impressora instalada no Windows')
  }

  return { mode, connection: parsedConnection, paperWidthMm, codePage }
}

function parseConnection(value: unknown): PrinterConnection {
  const connection = asObject(value, 'Conexão da impressora inválida')

  if (connection.type === 'windows') {
    return { type: 'windows', name: parsePrinterName(connection.name) }
  }

  if (connection.type === 'network') {
    const { host, port = DEFAULT_NETWORK_PORT } = connection
    if (typeof host !== 'string' || !isPrivateIPv4(host)) {
      throw new Error('IP da impressora inválido (use um IP da rede local)')
    }
    if (typeof port !== 'number' || !ALLOWED_NETWORK_PORTS.includes(port)) {
      throw new Error(`Porta da impressora inválida (${ALLOWED_NETWORK_PORTS.join(', ')})`)
    }
    return { type: 'network', host, port }
  }

  throw new Error('Conexão da impressora inválida')
}

function parseDocument(value: unknown): PrintDocument {
  const { version, blocks } = asObject(value, 'Documento de impressão inválido')

  if (version !== 1) throw new Error('Versão do documento não suportada')
  if (!Array.isArray(blocks) || blocks.length === 0 || blocks.length > MAX_BLOCKS) {
    throw new Error('Documento de impressão inválido')
  }

  return { version, blocks: blocks.map(parseBlock) }
}

function parseBlock(value: unknown, index: number): Block {
  const block = asObject(value, `Bloco ${index} inválido`)

  switch (block.type) {
    case 'text':
      return {
        type: 'text',
        value: parseText(block.value, index),
        align: parseAlign(block.align, index),
        bold: block.bold === true,
        size: block.size === 2 ? 2 : 1
      }
    case 'row':
      return {
        type: 'row',
        left: parseText(block.left, index),
        right: parseText(block.right, index),
        bold: block.bold === true
      }
    case 'separator':
      return { type: 'separator' }
    case 'feed': {
      const lines = block.lines ?? 1
      if (!Number.isInteger(lines) || (lines as number) < 1 || (lines as number) > MAX_FEED_LINES) {
        throw new Error(`Bloco ${index}: linhas inválidas (1 a ${MAX_FEED_LINES})`)
      }
      return { type: 'feed', lines: lines as number }
    }
    case 'cut':
      return { type: 'cut' }
    default:
      throw new Error(`Bloco ${index}: tipo desconhecido`)
  }
}

function parseText(value: unknown, index: number): string {
  if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
    throw new Error(`Bloco ${index}: texto inválido`)
  }
  return value.normalize('NFC')
}

function parseAlign(value: unknown, index: number): Align {
  if (value === undefined) return 'left'
  if (value === 'left' || value === 'center' || value === 'right') return value
  throw new Error(`Bloco ${index}: alinhamento inválido`)
}

function parsePrinterName(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Impressora não informada')
  }
  return value
}

function parseCopies(value: unknown): number {
  const copies = Number(value)
  if (!Number.isInteger(copies) || copies < 0 || copies > MAX_COPIES) {
    throw new Error(`Quantidade de cópias inválida (0 a ${MAX_COPIES})`)
  }
  return copies
}

function isPrivateIPv4(host: string): boolean {
  if (!isIPv4(host)) return false
  const [a, b] = host.split('.').map(Number)
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function asObject(value: unknown, message: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(message)
  }
  return value as Json
}
