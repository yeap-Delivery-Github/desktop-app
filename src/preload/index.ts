import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { PrintResult } from '../main/printing'

interface PrintEvent {
  couponHtml: string
  printerName: string
  copiesCount: number
  paperWidthMm?: number
}

const api = {
  ping: () => ipcRenderer.send('ping'),
  printOrder: (printerEvent: PrintEvent) => ipcRenderer.send('print-order', printerEvent),
  printKitchenOrder: (printerEvent: PrintEvent) =>
    ipcRenderer.send('print-kitchen-order', printerEvent),
  printDocument: (request: unknown): Promise<PrintResult> =>
    ipcRenderer.invoke('print-document', request),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  saveToken: (token: string) => ipcRenderer.invoke('save-token', token),
  getToken: (): Promise<string | null> => ipcRenderer.invoke('get-token'),
  deleteToken: () => ipcRenderer.invoke('delete-token')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
