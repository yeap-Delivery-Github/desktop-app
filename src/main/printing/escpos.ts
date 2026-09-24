import { encodeText, ESC_T_SELECTOR } from './codepage'
import type { Align, Block, CodePage, PaperWidthMm, PrintDocument } from './contract'

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const COLUMNS: Record<PaperWidthMm, number> = { 58: 32, 80: 48 }
const ALIGN: Record<Align, number> = { left: 0, center: 1, right: 2 }
const DOUBLE_SIZE = 0x11

interface EscPosOptions {
  paperWidthMm: PaperWidthMm
  codePage: CodePage
}

export function renderEscPos(document: PrintDocument, options: EscPosOptions): Buffer {
  const columns = COLUMNS[options.paperWidthMm]
  const chunks: Buffer[] = [Buffer.from([ESC, 0x40, ESC, 0x74, ESC_T_SELECTOR[options.codePage]])]
  const line = (text: string): Buffer =>
    Buffer.concat([encodeText(text, options.codePage), Buffer.from([LF])])

  for (const block of document.blocks) {
    chunks.push(...renderBlock(block, columns, line))
  }

  return Buffer.concat(chunks)
}

function renderBlock(block: Block, columns: number, line: (text: string) => Buffer): Buffer[] {
  switch (block.type) {
    case 'text': {
      const width = Math.floor(columns / block.size)
      return [
        Buffer.from([ESC, 0x61, ALIGN[block.align], ESC, 0x45, block.bold ? 1 : 0]),
        Buffer.from([GS, 0x21, block.size === 2 ? DOUBLE_SIZE : 0]),
        ...wrapText(block.value, width).map(line),
        Buffer.from([GS, 0x21, 0, ESC, 0x45, 0, ESC, 0x61, 0])
      ]
    }
    case 'row':
      return [
        Buffer.from([ESC, 0x45, block.bold ? 1 : 0]),
        ...layoutRow(block.left, block.right, columns).map(line),
        Buffer.from([ESC, 0x45, 0])
      ]
    case 'separator':
      return [line('-'.repeat(columns))]
    case 'feed':
      return [Buffer.alloc(block.lines, LF)]
    case 'cut':
      return [Buffer.from([GS, 0x56, 0x42, 0x00])]
  }
}

export function wrapText(text: string, width: number): string[] {
  return text.split('\n').flatMap((paragraph) => wrapParagraph(paragraph, width))
}

function wrapParagraph(paragraph: string, width: number): string[] {
  const lines: string[] = []
  let current = ''

  for (const word of paragraph.split(/\s+/).filter(Boolean)) {
    const chars = [...word]
    for (let start = 0; start < chars.length; start += width) {
      const piece = chars.slice(start, start + width).join('')
      const candidate = current ? `${current} ${piece}` : piece
      if ([...candidate].length <= width) {
        current = candidate
      } else {
        lines.push(current)
        current = piece
      }
    }
  }

  lines.push(current)
  return lines
}

export function layoutRow(left: string, right: string, columns: number): string[] {
  const lines = wrapText(left, columns)
  const last = lines[lines.length - 1]
  const gap = columns - [...last].length - [...right].length

  if (gap >= 1) {
    lines[lines.length - 1] = last + ' '.repeat(gap) + right
    return lines
  }

  return [...lines, ...wrapText(right, columns).map((line) => line.padStart(columns))]
}
