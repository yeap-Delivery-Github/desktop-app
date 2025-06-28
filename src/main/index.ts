import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { OrderTemplate } from '../print'
import { Order } from '../types'

function createWindow(): void {
  const linuxIcon = join(__dirname, '../../build/icon.png')
  const windowsIcon = join(__dirname, 'resources', 'icon.png')

  let icon = ''

  if (process.platform === 'linux') {
    icon = linuxIcon
  }

  if (process.platform === 'win32') {
    icon = windowsIcon
  }

  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    title: 'Yeap Delivery',
    icon: icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.platform === 'darwin') {
    const iconPath = path.resolve(__dirname, 'resources', 'icon.png')
    app.dock?.setIcon(iconPath)
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.loadURL('http://localhost:3000')
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('print-order', async (event, order: Order) => {
    try {
      const templateOrder = new OrderTemplate(order)

      const couponHtml = templateOrder.execute()
      console.log(couponHtml)

      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(couponHtml)}`)

      printWindow.webContents.on('did-finish-load', async () => {
        try {
          const printers = await printWindow.webContents.getPrintersAsync()

          const targetPrinter = printers.find((p) => p.name === 'MP-4200 TH (Copiar 1)')

          if (!targetPrinter) {
            console.error('Erro: Impressora "MP-4200 TH (Copiar 1)" não encontrada.')

            event.sender.send('print-status', {
              success: false,
              error: 'Impressora não encontrada ou nome incorreto.'
            })
            printWindow.close()
            return
          }

          await printWindow.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: targetPrinter.name
          })

          console.log('Cupom impresso com sucesso usando webContents.print()!')
        } catch (printError) {
          console.error('Erro ao imprimir com webContents.print():', printError)
        } finally {
          setTimeout(() => {
            printWindow.close()
          }, 1000)
        }
      })
    } catch (error) {
      console.error('Erro geral no processo de impressão (construção HTML/janela):', error)
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
