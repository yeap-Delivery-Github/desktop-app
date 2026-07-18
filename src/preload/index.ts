import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  ping: () => ipcRenderer.send('ping'),
  printOrder: (printerEvent: { couponHtml: string; printerName: string; copiesCount: number }) =>
    ipcRenderer.send('print-order', printerEvent),
  printKitchenOrder: (printerEvent: {
    couponHtml: string
    printerName: string
    copiesCount: number
  }) => ipcRenderer.send('print-kitchen-order', printerEvent),
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
