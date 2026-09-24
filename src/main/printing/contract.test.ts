import { describe, expect, it } from 'vitest'
import { parseLegacyPrintJob, parsePrintDocumentRequest } from './contract'

const validRequest = {
  printer: {
    mode: 'escpos',
    connection: { type: 'network', host: '192.168.0.50' },
    paperWidthMm: 80
  },
  document: { version: 1, blocks: [{ type: 'text', value: 'Pedido' }, { type: 'cut' }] },
  copies: 1
}

function withPrinter(printer: Record<string, unknown>): unknown {
  return { ...validRequest, printer: { ...validRequest.printer, ...printer } }
}

describe('parsePrintDocumentRequest', () => {
  it('applies defaults', () => {
    const request = parsePrintDocumentRequest(validRequest)
    expect(request.printer).toEqual({
      mode: 'escpos',
      connection: { type: 'network', host: '192.168.0.50', port: 9100 },
      paperWidthMm: 80,
      codePage: 'cp850'
    })
    expect(request.document.blocks[0]).toEqual({
      type: 'text',
      value: 'Pedido',
      align: 'left',
      bold: false,
      size: 1
    })
  })

  it.each(['10.0.0.5', '172.16.1.1', '172.31.255.255', '192.168.1.100'])(
    'accepts private IPv4 %s',
    (host) => {
      expect(() =>
        parsePrintDocumentRequest(withPrinter({ connection: { type: 'network', host } }))
      ).not.toThrow()
    }
  )

  it.each(['8.8.8.8', '127.0.0.1', '172.32.0.1', '169.254.1.1', 'printer.local', '::1'])(
    'rejects non-private host %s',
    (host) => {
      expect(() =>
        parsePrintDocumentRequest(withPrinter({ connection: { type: 'network', host } }))
      ).toThrow('IP da impressora inválido')
    }
  )

  it('rejects ports outside the RAW range', () => {
    expect(() =>
      parsePrintDocumentRequest(
        withPrinter({ connection: { type: 'network', host: '192.168.0.50', port: 22 } })
      )
    ).toThrow('Porta da impressora inválida')
  })

  it('requires a Windows printer for html mode', () => {
    expect(() => parsePrintDocumentRequest(withPrinter({ mode: 'html' }))).toThrow(
      'Impressão HTML exige'
    )
  })

  it('rejects unsupported paper width and code page', () => {
    expect(() => parsePrintDocumentRequest(withPrinter({ paperWidthMm: 110 }))).toThrow(
      'Largura do papel'
    )
    expect(() => parsePrintDocumentRequest(withPrinter({ codePage: 'utf8' }))).toThrow('Code page')
  })

  it('rejects unknown blocks, bad documents and copies out of range', () => {
    const request = (patch: Record<string, unknown>): unknown => ({ ...validRequest, ...patch })
    expect(() =>
      parsePrintDocumentRequest(request({ document: { version: 1, blocks: [{ type: 'image' }] } }))
    ).toThrow('Bloco 0: tipo desconhecido')
    expect(() =>
      parsePrintDocumentRequest(request({ document: { version: 2, blocks: [] } }))
    ).toThrow('Versão do documento')
    expect(() => parsePrintDocumentRequest(request({ copies: 21 }))).toThrow('cópias')
  })

  it('normalizes text to NFC', () => {
    const request = parsePrintDocumentRequest({
      ...validRequest,
      document: { version: 1, blocks: [{ type: 'text', value: 'ã' }] }
    })
    expect(request.document.blocks[0]).toMatchObject({ value: 'ã' })
  })
})

describe('parseLegacyPrintJob', () => {
  it('keeps the legacy payload contract', () => {
    expect(
      parseLegacyPrintJob({ couponHtml: '<p>x</p>', printerName: 'EPSON', copiesCount: 2 })
    ).toEqual({ html: '<p>x</p>', printerName: 'EPSON', copies: 2, paperWidthMm: undefined })
  })

  it('rejects an empty coupon', () => {
    expect(() =>
      parseLegacyPrintJob({ couponHtml: '', printerName: 'EPSON', copiesCount: 1 })
    ).toThrow('Cupom inválido')
  })
})
