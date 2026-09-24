const queues = new Map<string, Promise<void>>()

export function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const tail = queues.get(key) ?? Promise.resolve()
  const run = tail.then(task)
  const nextTail = run.then(
    () => undefined,
    () => undefined
  )

  queues.set(key, nextTail)
  nextTail.then(() => {
    if (queues.get(key) === nextTail) queues.delete(key)
  })

  return run
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
