import net from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import { sendRaw } from './raw-transport'

describe('sendRaw over the network', () => {
  let server: net.Server | undefined

  afterEach(
    () => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
  )

  it('delivers the bytes to the printer socket', async () => {
    const received = new Promise<Buffer>((resolve) => {
      server = net.createServer((socket) => {
        const chunks: Buffer[] = []
        socket.on('data', (chunk) => chunks.push(chunk))
        socket.on('end', () => resolve(Buffer.concat(chunks)))
      })
    })
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
    const { port } = server!.address() as net.AddressInfo

    const data = Buffer.from([0x1b, 0x40, 0x41, 0x0a, 0x1d, 0x56, 0x42, 0x00])
    await sendRaw({ type: 'network', host: '127.0.0.1', port }, data, 'test')

    expect(await received).toEqual(data)
  })

  it('reports an unreachable printer', async () => {
    server = net.createServer()
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
    const { port } = server!.address() as net.AddressInfo
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = undefined

    await expect(
      sendRaw({ type: 'network', host: '127.0.0.1', port }, Buffer.from('x'), 'test')
    ).rejects.toThrow(`Impressora 127.0.0.1:${port} inacessível (ECONNREFUSED)`)
  })

  it('refuses USB printing outside Windows', async () => {
    if (process.platform === 'win32') return
    await expect(
      sendRaw({ type: 'windows', name: 'EPSON' }, Buffer.from('x'), 'test')
    ).rejects.toThrow('só é suportada no Windows')
  })
})
