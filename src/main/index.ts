import { app, shell, BrowserWindow, ipcMain, safeStorage } from 'electron'
import fs from 'fs'
import path, { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { log } from './logger'
import { printDocument, printLegacyHtml } from './printing'

const PORTAL_URL = 'https://portal.yeapdelivery.com.br'

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
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    title: 'Yeap Delivery',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }

  mainWindow.on('ready-to-show', () => {
    log('info', 'window.ready_to_show')
    mainWindow.show()
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      log('error', 'window.load_failed', { url: validatedURL, errorCode, errorDescription })
      if (!mainWindow.isVisible()) mainWindow.show()
    }
  )

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('error', 'window.render_process_gone', {
      reason: details.reason,
      exitCode: details.exitCode
    })
  })

  mainWindow.webContents.on('unresponsive', () => {
    log('warn', 'window.unresponsive')
  })

  try {
    log('info', 'portal.loading')
    await mainWindow.loadURL(PORTAL_URL)
  } catch (error) {
    log('error', 'portal.load_failed', { error: (error as Error).message })
    if (!mainWindow.isVisible()) mainWindow.show()
  }
}

function registerPrintChannel(channel: string, statusChannel: string): void {
  ipcMain.on(channel, async (event, payload: unknown) => {
    let status: { success: boolean; error?: string }
    try {
      await printLegacyHtml(payload)
      status = { success: true }
    } catch (error) {
      status = { success: false, error: (error as Error).message }
    }
    if (!event.sender.isDestroyed()) event.sender.send(statusChannel, status)
  })
}

function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

app.disableHardwareAcceleration()

app.whenReady().then(() => {
  log('info', 'app.ready', {
    electron: process.versions.electron,
    chrome: process.versions.chrome
  })
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('save-token', (_, token: string) => saveToken(token))
  ipcMain.handle('get-token', () => getToken())
  ipcMain.handle('delete-token', () => deleteToken())

  registerPrintChannel('print-order', 'print-status')
  registerPrintChannel('print-kitchen-order', 'print-kitchen-status')

  ipcMain.handle('print-document', (event, payload: unknown) => {
    const origin = originOf(event.senderFrame?.url)
    if (origin !== originOf(PORTAL_URL)) {
      log('warn', 'print.forbidden_sender', { origin })
      return { success: false, error: 'Origem não autorizada' }
    }
    return printDocument(payload)
  })

  ipcMain.handle('get-printers', async (event) => {
    const printers = await event.sender.getPrintersAsync()
    return printers.map((p) => p.name)
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
