/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, shell, BrowserWindow, ipcMain, safeStorage } from 'electron'
import fs from 'fs'
import path, { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'

const TOKEN_FILE = path.join(app.getPath('userData'), 'auth-token.bin')

function saveToken(token: string): void {
  const encrypted = safeStorage.encryptString(token)
  fs.writeFileSync(TOKEN_FILE, encrypted)
}

function getToken(): string | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null
    const data = fs.readFileSync(TOKEN_FILE)
    return safeStorage.decryptString(data)
  } catch {
    return null
  }
}

function deleteToken(): void {
  if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE)
}

async function createWindow(): Promise<Promise<void>> {
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
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  await mainWindow.loadURL('https://portal.yeapdelivery.com.br')
}

async function printHtml(html: string, printerName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    printWindow.webContents.once('did-finish-load', async () => {
      try {
        const printers = await printWindow.webContents.getPrintersAsync()
        const targetPrinter = printers.find((p) => p.name === printerName)

        if (!targetPrinter) {
          reject(new Error(`Impressora ${printerName} não encontrada`))
          printWindow.close()
          return
        }

        printWindow.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: targetPrinter.name,
            margins: { marginType: 'none' }
          },
          (success) => {
            printWindow.close()
            if (!success) return reject(new Error('Falha na impressão'))
            resolve()
          }
        )
      } catch (err) {
        reject(err)
        printWindow.close()
      }
    })
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('save-token', (_, token: string) => saveToken(token))
  ipcMain.handle('get-token', () => getToken())
  ipcMain.handle('delete-token', () => deleteToken())

  ipcMain.on(
    'print-order',
    async (
      event,
      {
        couponHtml,
        printerName,
        copiesCount
      }: { couponHtml: string; printerName: string; copiesCount: number }
    ) => {
      try {
        for (let i = 0; i < copiesCount; i++) {
          await printHtml(couponHtml, printerName)
          console.log(`Impressão ${i + 1}/${copiesCount} concluída`)
        }

        event.sender.send('print-status', { success: true })
      } catch (error) {
        console.error('Erro geral no processo de impressão:', error)
        event.sender.send('print-status', { success: false, error: (error as any).message })
      }
    }
  )

  ipcMain.on(
    'print-kitchen-order',
    async (
      event,
      {
        couponHtml,
        printerName,
        copiesCount
      }: { couponHtml: string; printerName: string; copiesCount: number }
    ) => {
      try {
        for (let i = 0; i < copiesCount; i++) {
          await printHtml(couponHtml, printerName)
          console.log(`Impressão comanda cozinha ${i + 1}/${copiesCount} concluída`)
        }

        event.sender.send('print-kitchen-status', { success: true })
      } catch (error) {
        console.error('Erro geral no processo de impressão da comanda:', error)
        event.sender.send('print-kitchen-status', {
          success: false,
          error: (error as any).message
        })
      }
    }
  )

  ipcMain.handle('get-printers', async () => {
    return new Promise<string[]>((resolve, reject) => {
      const printerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      printerWindow.webContents.once('did-finish-load', async () => {
        try {
          const printers = await printerWindow.webContents.getPrintersAsync()
          resolve(printers.map((p) => p.name))
        } catch (error) {
          reject(error)
        } finally {
          printerWindow.close()
        }
      })

      printerWindow.loadURL('about:blank')
    })
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
