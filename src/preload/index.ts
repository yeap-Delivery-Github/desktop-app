import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Order } from '../types'

const api = {
  ping: () => ipcRenderer.send('ping'),
  printOrder: (printerEvent: { order: Order; printerName: string; copiesCount: number }) =>
    ipcRenderer.send('print-order', printerEvent),
  getPrinters: () => ipcRenderer.invoke('get-printers')
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
