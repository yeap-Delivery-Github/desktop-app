# 0001 — Documento de impressão estruturado com conversão para ESC/POS ou HTML no desktop

- Status: aceito
- Data: 2026-09-24

## Contexto

O desktop recebe do portal um HTML pronto e imprime com `webContents.print()`, passando pelo driver do Windows. Em impressora térmica esse é o caminho mais frágil: papel em branco, fonte escalada, corte errado, lentidão e travamentos. A maior parte das falhas relatadas pelos parceiros vem daí.

Restrições:

- O desktop não tem atualização automática. Qualquer mudança nele só chega a quem reinstala.
- Os parceiros usam impressoras térmicas USB e de rede, e também impressoras comuns.
- O Windows 7 deixou de ser suportado (Windows 10 ou mais novo, 64 bits), o que permitiu atualizar o Electron e usar FFI nativo.

## Decisão

O portal monta um **documento estruturado** (layout) e o desktop o converte para o formato da impressora e o envia.

```json
{
  "version": 1,
  "blocks": [
    { "type": "text", "value": "PEDIDO #123", "align": "center", "bold": true, "size": 2 },
    { "type": "separator" },
    { "type": "row", "left": "1x X-Burger", "right": "25,00" },
    { "type": "feed", "lines": 1 },
    { "type": "cut" }
  ]
}
```

Responsabilidades:

| Portal | Desktop |
|---|---|
| Conteúdo e layout da comanda | Quebra de linha e colunas conforme a largura (58mm = 32, 80mm = 48) |
| Qual impressora e em que modo imprimir (vem da configuração da loja) | Acentos (code page), negrito, tamanho, corte |
| | Envio: spooler do Windows em RAW (USB) ou TCP (rede) |
| | Fila por impressora, timeouts, logs |

Modos, escolhidos por impressora:

- **`escpos`** (térmica): o documento vira bytes ESC/POS.
  - USB: enviado em RAW ao spooler do Windows (`OpenPrinterW` / `StartDocPrinterW` com datatype `RAW` / `WritePrinter`) via [Koffi](https://koffi.dev), sem passar pela renderização do driver.
  - Rede: TCP direto na porta 9100 (padrão RAW/JetDirect).
- **`html`** (impressora comum): o documento vira HTML e segue o caminho atual de `webContents.print()`.

Contrato IPC novo, `print-document` (`ipcRenderer.invoke`), que devolve o resultado de cada pedido:

```ts
request: {
  printer: {
    mode: 'escpos' | 'html'
    connection: { type: 'windows'; name: string } | { type: 'network'; host: string; port?: number }
    paperWidthMm: 58 | 80
    codePage?: 'cp850' | 'cp860' | 'ascii'
  }
  document: { version: 1; blocks: Block[] }
  copies: number // 0 a 20
}
response: { jobId: string; success: true } | { jobId: string; success: false; error: string }
```

Compatibilidade: os canais `print-order` e `print-kitchen-order` (HTML) continuam funcionando. O portal detecta o desktop novo pela presença de `window.api.printDocument` e, sem ela, continua mandando HTML.

## Alternativas descartadas

- **Portal gerar os bytes ESC/POS:** leva para o navegador a lógica que depende da impressora (code page, colunas, corte) e mistura as duas camadas.
- **Desktop montar a comanda a partir do pedido:** cada mudança de layout exigiria reinstalar o app em todos os parceiros, e não existe atualização automática.
- **Continuar só com HTML e ajustar o CSS/driver:** não resolve as causas (escala do driver, tamanho de página, lentidão da renderização).
- **Envio RAW por PowerShell ou por um `.exe` auxiliar:** o PowerShell abre um processo a cada impressão (1 a 3s). O `.exe` exige uma etapa de build em C# e um binário a mais para manter. Com o Windows 7 fora, o Koffi atende Windows 10/11 x64 sem compilação.

## Consequências

- Mudar o layout da comanda passa a ser só deploy do portal.
- O desktop ganha a dependência nativa `koffi` (N-API, binário pré-compilado por plataforma). O instalador do Windows precisa ser gerado no Windows (o CI já roda em `windows-latest`).
- Code page não é universal. CP850 (padrão) e CP860 cobrem o português na maioria das impressoras compatíveis com Epson (`ESC t 2` / `ESC t 3`). Para impressoras que imprimem lixo, `ascii` remove os acentos. Precisa de teste de campo nas marcas usadas pelos parceiros (Elgin, Bematech, Epson, Daruma).
- `success: true` no modo `escpos` significa que os bytes foram entregues ao spooler ou à impressora, não que o papel saiu. ESC/POS permite consultar status, mas isso fica fora desta versão.
- Segurança: o renderer é um site remoto. O canal novo só aceita chamadas do frame do portal. No modo rede, só aceita IPv4 privado (RFC 1918) nas portas 9100 a 9102, para uma falha no portal não virar envio de bytes para qualquer host.
- Driver v4 do Windows pode recusar o datatype `RAW`. Nesses casos, configurar a impressora com o driver "Generic / Text Only" ou o driver v3 do fabricante.
