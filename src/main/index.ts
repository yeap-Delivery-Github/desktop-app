import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { PosPrinter } from 'electron-pos-printer'

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

  // mainWindow.loadURL('https://portal.yeapdelivery.com.br')
  mainWindow.loadURL('http://localhost:3000')
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('print-order', async (event, order) => {
    const data = [
      {
        type: 'text',
        value: 'YEAP DELIVERY',
        style: 'text-align:center;font-weight:bold;font-size:18px;'
      },
      {
        type: 'text',
        value: '------------------------------------------',
        style: 'text-align:center;'
      },
      {
        type: 'text',
        value: `Cliente: ${order.userName}`,
        style: 'font-size:14px;'
      },
      {
        type: 'text',
        value: `Pedido: ${order.orderNumber}`,
        style: 'font-size:14px;'
      },
      {
        type: 'text',
        value: `Total: R$ ${order.totalPrice.toFixed(2)}`,
        style: 'font-size:14px;'
      },
      {
        type: 'text',
        value: `Endereço: ${order.userAddress?.street ?? ''}`,
        style: 'font-size:14px;'
      },
      {
        type: 'text',
        value: '------------------------------------------',
        style: 'text-align:center;'
      },
      {
        type: 'text',
        value: 'Obrigado pela preferência!',
        style: 'text-align:center;font-size:14px;'
      }
    ]

    try {
      await PosPrinter.print(data, {
        printerName: 'MP-4200HS', // use '' para padrão, ou o nome da impressora
        width: '80mm',
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
        preview: false,
        silent: true,
        timeOutPerLine: 400,
        pageSize: '80mm'
      })
    } catch (error) {
      console.error('Erro ao imprimir:', error)
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
