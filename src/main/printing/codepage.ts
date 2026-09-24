import type { CodePage } from './contract'

// Characters for bytes 0x80–0xFF of each code page.
const HIGH_HALF: Record<CodePage, string> = {
  cp850:
    'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
    '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ',
  cp860:
    'ÇüéâãàÁçêÊèÍÔìÃÂÉÀÈôõòÚùÌÕÜ¢£Ù₧ÓáíóúñÑªº¿Ò¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
    '└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ',
  ascii: ''
}

// ESC t n values used by Epson-compatible printers.
export const ESC_T_SELECTOR: Record<CodePage, number> = { cp850: 2, cp860: 3, ascii: 0 }

const ENCODERS = Object.fromEntries(
  Object.entries(HIGH_HALF).map(([codePage, chars]) => [
    codePage,
    new Map([...chars].map((char, index) => [char, 0x80 + index]))
  ])
) as Record<CodePage, Map<string, number>>

export function encodeText(text: string, codePage: CodePage): Buffer {
  const table = ENCODERS[codePage]
  const bytes: number[] = []

  for (const char of text) {
    const code = char.codePointAt(0)!
    if (code >= 0x20 && code < 0x7f) {
      bytes.push(code)
      continue
    }
    const mapped = table.get(char)
    if (mapped !== undefined) {
      bytes.push(mapped)
      continue
    }
    bytes.push(...asciiFallback(char))
  }

  return Buffer.from(bytes)
}

function asciiFallback(char: string): number[] {
  if (/\s/.test(char)) return [0x20]
  const stripped = char.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return [...stripped].map((c) => {
    const code = c.codePointAt(0)!
    return code >= 0x20 && code < 0x7f ? code : 0x3f
  })
}
