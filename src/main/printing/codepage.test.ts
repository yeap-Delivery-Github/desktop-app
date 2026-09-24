import { describe, expect, it } from 'vitest'
import { encodeText } from './codepage'

describe('encodeText', () => {
  it('maps Portuguese characters to CP850', () => {
    expect([...encodeText('çãõéÁÇÃÕÉÍÓÚÂÊÔ', 'cp850')]).toEqual([
      0x87, 0xc6, 0xe4, 0x82, 0xb5, 0x80, 0xc7, 0xe5, 0x90, 0xd6, 0xe0, 0xe9, 0xb6, 0xd2, 0xe2
    ])
  })

  it('maps Portuguese characters to CP860', () => {
    expect([...encodeText('çãõéÁÃÕÊÍÔÂÀÚÓ', 'cp860')]).toEqual([
      0x87, 0x84, 0x94, 0x82, 0x86, 0x8e, 0x99, 0x89, 0x8b, 0x8c, 0x8f, 0x91, 0x96, 0x9f
    ])
  })

  it('strips accents in ascii mode', () => {
    expect(encodeText('Observação: pão', 'ascii').toString('latin1')).toBe('Observacao: pao')
  })

  it('falls back to ascii for characters outside the code page', () => {
    expect(encodeText('ẽ € 🍔', 'cp850').toString('latin1')).toBe('e ? ?')
  })

  it('turns control characters into spaces', () => {
    expect(encodeText('a\tb', 'cp850').toString('latin1')).toBe('a b')
  })
})
