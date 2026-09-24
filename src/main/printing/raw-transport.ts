import net from 'net'
import type { load } from 'koffi'
import type { PrinterConnection } from './contract'
import { withTimeout } from './queue'

const SPOOLER_TIMEOUT_MS = 30_000
const NETWORK_TIMEOUT_MS = 10_000

export function sendRaw(
  connection: PrinterConnection,
  data: Buffer,
  docName: string
): Promise<void> {
  if (connection.type === 'network') {
    return sendToNetworkPrinter(connection.host, connection.port, data)
  }
  return withTimeout(
    writeToSpooler(connection.name, data, docName),
    SPOOLER_TIMEOUT_MS,
    'Tempo esgotado aguardando a impressora'
  )
}

function sendToNetworkPrinter(host: string, port: number, data: Buffer): Promise<void> {
  const address = `${host}:${port}`

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(NETWORK_TIMEOUT_MS)
    socket.once('timeout', () => socket.destroy(new Error(`Impressora ${address} não respondeu`)))
    socket.once('error', (error: NodeJS.ErrnoException) => {
      reject(error.code ? new Error(`Impressora ${address} inacessível (${error.code})`) : error)
    })
    socket.once('connect', () => {
      socket.end(data, () => {
        socket.destroy()
        resolve()
      })
    })
  })
}

type KoffiFunction = ReturnType<ReturnType<typeof load>['func']>

interface Spooler {
  open: KoffiFunction
  startDoc: KoffiFunction
  startPage: KoffiFunction
  write: KoffiFunction
  endPage: KoffiFunction
  endDoc: KoffiFunction
  close: KoffiFunction
}

let spooler: Promise<Spooler> | undefined

function loadSpooler(): Promise<Spooler> {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Impressão RAW por USB só é suportada no Windows'))
  }

  spooler ??= import('koffi').then(({ load, opaque, pointer, struct }) => {
    const winspool = load('winspool.drv')
    pointer('PRINTER_HANDLE', opaque())
    struct('DOC_INFO_1W', {
      pDocName: 'const char16_t *',
      pOutputFile: 'const char16_t *',
      pDatatype: 'const char16_t *'
    })

    return {
      open: winspool.func(
        'bool __stdcall OpenPrinterW(const char16_t *name, _Out_ PRINTER_HANDLE *handle, void *defaults)'
      ),
      startDoc: winspool.func(
        'uint32_t __stdcall StartDocPrinterW(PRINTER_HANDLE handle, uint32_t level, DOC_INFO_1W *info)'
      ),
      startPage: winspool.func('bool __stdcall StartPagePrinter(PRINTER_HANDLE handle)'),
      write: winspool.func(
        'bool __stdcall WritePrinter(PRINTER_HANDLE handle, const void *buf, uint32_t size, _Out_ uint32_t *written)'
      ),
      endPage: winspool.func('bool __stdcall EndPagePrinter(PRINTER_HANDLE handle)'),
      endDoc: winspool.func('bool __stdcall EndDocPrinter(PRINTER_HANDLE handle)'),
      close: winspool.func('bool __stdcall ClosePrinter(PRINTER_HANDLE handle)')
    }
  })

  return spooler
}

async function writeToSpooler(printerName: string, data: Buffer, docName: string): Promise<void> {
  const { open, startDoc, startPage, write, endPage, endDoc, close } = await loadSpooler()
  const handleOut: unknown[] = [null]

  if (!open(printerName, handleOut, null)) {
    throw new Error(`Impressora ${printerName} não encontrada`)
  }
  const handle = handleOut[0]

  try {
    if (!startDoc(handle, 1, { pDocName: docName, pOutputFile: null, pDatatype: 'RAW' })) {
      throw new Error(`A impressora ${printerName} recusou o modo RAW (verifique o driver)`)
    }
    try {
      if (!startPage(handle)) throw new Error('Falha ao iniciar a impressão')
      const written = [0]
      const ok = await callAsync<boolean>(write, handle, data, data.length, written)
      if (!ok || written[0] !== data.length) {
        throw new Error(`Falha ao enviar dados para a impressora ${printerName}`)
      }
      endPage(handle)
    } finally {
      endDoc(handle)
    }
  } finally {
    close(handle)
  }
}

function callAsync<T>(fn: KoffiFunction, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    fn.async(...args, (error: unknown, result: T) => (error ? reject(error) : resolve(result)))
  })
}
