import type { Block, PaperWidthMm, PrintDocument } from './contract'

const BASE_FONT_PX = 12

export function renderHtml(document: PrintDocument, paperWidthMm: PaperWidthMm): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2mm;
    width: ${paperWidthMm}mm;
    font-family: 'Courier New', monospace;
    font-size: ${BASE_FONT_PX}px;
    line-height: 1.3;
    color: #000;
    overflow-wrap: anywhere;
  }
  p { margin: 0; white-space: pre-wrap; }
  .row { display: flex; justify-content: space-between; gap: 1ch; }
  .row span:last-child { white-space: nowrap; text-align: right; }
  .bold { font-weight: bold; }
  .size-2 { font-size: ${BASE_FONT_PX * 2}px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 1mm 0; }
</style>
</head>
<body>
${document.blocks.map(renderBlock).join('\n')}
</body>
</html>`
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case 'text': {
      const classes = [block.bold && 'bold', block.size === 2 && 'size-2'].filter(Boolean)
      return `<p class="${classes.join(' ')}" style="text-align:${block.align}">${escapeHtml(block.value) || '&nbsp;'}</p>`
    }
    case 'row':
      return `<div class="row${block.bold ? ' bold' : ''}"><span>${escapeHtml(block.left)}</span><span>${escapeHtml(block.right)}</span></div>`
    case 'separator':
      return '<hr>'
    case 'feed':
      return '<p>&nbsp;</p>'.repeat(block.lines)
    case 'cut':
      return ''
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
