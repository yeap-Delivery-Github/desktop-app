import { removeAccents } from '../utils'

export class TemplatePrint {
  private content: string = ''

  static getTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body {
              font-family: monospace;
              font-size: 14px;
              width: 80mm;
              margin: 0;
              padding: 5mm;
              box-sizing: border-box;
            }
            .header,
            .footer {
              font-weight: bold;
              margin-bottom: 5px;
            }
            .item-list {
              margin-top: 10px;
              margin-bottom: 10px;
            }
            .item {
              display: flex;
              justify-content: space-between;
            }
            .item-name {
              flex-grow: 1;
              margin-right: 5px;
            }
            .total {
              font-weight: bold;
              font-size: 12px;
            }
            .separator {
              border-top: 1px dashed #000;
              margin: 5px 0;
            }
            .line {
              margin-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            th, td {
              text-align: left;
              padding: 2px 0;
            }
            th {
              font-weight: bold;
              border-bottom: 1px solid #000;
            }
            tr {
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          {{body}}
        </body>
      </html>
    `
  }

  title(text: string): string {
    this.content += `<div class="header">${removeAccents(text)}</div>\n`
    return this.content
  }

  line(text: string, bold: boolean = false): this {
    const style = bold ? 'font-weight: bold;' : ''
    this.content += `<div class="line" style="${style}">${removeAccents(text)}</div>\n`
    return this
  }

  separator(): this {
    this.content += `<div class="separator"></div>\n`
    return this
  }

  table(headers: string[], rows: string[][], columnWidths: string[] = []): this {
    const widths =
      columnWidths.length === headers.length
        ? columnWidths
        : new Array(headers.length).fill(`${100 / headers.length}%`)

    const colgroup = widths.map((width) => `<col style="width: ${width};" />`).join('')

    const thead = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`
    const tbody = rows
      .map((row) => `<tr>${row.map((col) => `<td>${col}</td>`).join('')}</tr>`)
      .join('')

    this.content += `<table>${colgroup}${thead}${tbody}</table>\n`
    return this
  }

  footer(text: string): this {
    this.content += `<div class="footer">${text}</div>\n`
    return this
  }

  getContent(): string {
    return this.content
  }

  build(): string {
    return TemplatePrint.getTemplate().replace('{{body}}', this.content)
  }
}
