import { describe, expect, it } from 'vitest'
import type { PrintDocument } from './contract'
import { layoutRow, renderEscPos, wrapText } from './escpos'

describe('wrapText', () => {
  it('wraps on word boundaries', () => {
    expect(wrapText('1x X-Burger com bacon e cheddar', 12)).toEqual([
      '1x X-Burger',
      'com bacon e',
      'cheddar'
    ])
  })

  it('breaks words longer than the width', () => {
    expect(wrapText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('keeps explicit line breaks and blank lines', () => {
    expect(wrapText('a\n\nb', 10)).toEqual(['a', '', 'b'])
  })

  it('counts accented characters as one column', () => {
    expect(wrapText('ação ação', 9)).toEqual(['ação ação'])
  })
})

describe('layoutRow', () => {
  it('pushes the right text to the last column', () => {
    expect(layoutRow('1x Coca', '5,00', 16)).toEqual(['1x Coca     5,00'])
  })

  it('puts the right text on the last wrapped line', () => {
    expect(layoutRow('2x X-Burger duplo', '50,00', 16)).toEqual(['2x X-Burger', 'duplo      50,00'])
  })

  it('moves a long right text to its own line', () => {
    expect(layoutRow('Total', 'R$ 1.234.567,89', 20)).toEqual(['Total', '     R$ 1.234.567,89'])
  })

  it('fits every line within the columns', () => {
    for (const line of layoutRow('Pizza grande meia calabresa meia frango', '89,90', 32)) {
      expect([...line].length).toBeLessThanOrEqual(32)
    }
  })
})

describe('renderEscPos', () => {
  const document: PrintDocument = {
    version: 1,
    blocks: [
      { type: 'text', value: 'PEDIDO', align: 'center', bold: true, size: 2 },
      { type: 'separator' },
      { type: 'row', left: 'Item', right: '1,00', bold: false },
      { type: 'feed', lines: 2 },
      { type: 'cut' }
    ]
  }

  it('initializes the printer and selects the code page', () => {
    const bytes = renderEscPos(document, { paperWidthMm: 80, codePage: 'cp860' })
    expect([...bytes.subarray(0, 5)]).toEqual([0x1b, 0x40, 0x1b, 0x74, 3])
  })

  it('uses 32 columns on 58mm and 48 on 80mm', () => {
    const separator = (width: 58 | 80): string =>
      renderEscPos(
        { version: 1, blocks: [{ type: 'separator' }] },
        { paperWidthMm: width, codePage: 'cp850' }
      )
        .subarray(5)
        .toString('latin1')
    expect(separator(58)).toBe('-'.repeat(32) + '\n')
    expect(separator(80)).toBe('-'.repeat(48) + '\n')
  })

  it('emits alignment, bold, double size and resets them', () => {
    const hex = renderEscPos(document, { paperWidthMm: 58, codePage: 'cp850' }).toString('hex')
    expect(hex).toContain('1b61011b45011d2111' + Buffer.from('PEDIDO\n').toString('hex'))
    expect(hex).toContain('1d21001b45001b6100')
  })

  it('feeds lines and ends with a partial cut', () => {
    const hex = renderEscPos(document, { paperWidthMm: 58, codePage: 'cp850' }).toString('hex')
    expect(hex.endsWith('0a0a' + '1d564200')).toBe(true)
  })
})
