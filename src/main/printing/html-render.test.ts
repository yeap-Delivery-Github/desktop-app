import { describe, expect, it } from 'vitest'
import { renderHtml } from './html-render'

describe('renderHtml', () => {
  it('escapes text coming from the portal', () => {
    const html = renderHtml(
      {
        version: 1,
        blocks: [
          {
            type: 'text',
            value: '<img src=x onerror=alert(1)>',
            align: 'left',
            bold: false,
            size: 1
          },
          { type: 'row', left: 'A & B', right: '"1"', bold: false }
        ]
      },
      80
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('A &amp; B')
    expect(html).toContain('&quot;1&quot;')
  })

  it('sets the body width to the paper width', () => {
    expect(renderHtml({ version: 1, blocks: [{ type: 'separator' }] }, 58)).toContain('width: 58mm')
  })
})
