// Per-tab save outcome. 'slow' fires only once a write has taken SLOW_SAVE_MS,
// so healthy saves are silent. See DESIGN.md, "Saving".
export type SaveEvent = { kind: 'slow' } | { kind: 'ok' } | { kind: 'error'; message: string }

export const SAVE_DELAY_MS = 400
export const SLOW_SAVE_MS = 500

// Electron prefixes errors thrown in IPC handlers; the status bar wants the cause.
const ipcPrefix = /^Error invoking remote method '[^']+': (Error: )?/

export function errorMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).replace(ipcPrefix, '')
}

// Debounced per-tab saves. Saves for one tab never overlap: each flush chains
// onto the previous one, so writes land in order.
export class Autosave {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private chains = new Map<string, Promise<boolean>>()
  private failed = new Set<string>()
  private readonly save: (id: string) => Promise<void>
  private readonly onEvent: (id: string, event: SaveEvent) => void
  private readonly delay: number
  private readonly slowAfter: number

  constructor(
    save: (id: string) => Promise<void>,
    onEvent: (id: string, event: SaveEvent) => void,
    delay = SAVE_DELAY_MS,
    slowAfter = SLOW_SAVE_MS
  ) {
    this.save = save
    this.onEvent = onEvent
    this.delay = delay
    this.slowAfter = slowAfter
  }

  schedule(id: string, immediate = false): void {
    clearTimeout(this.timers.get(id))
    this.timers.set(
      id,
      setTimeout(() => void this.flush(id), immediate ? 0 : this.delay)
    )
  }

  // Saves now if a save is pending or the last one failed; otherwise waits for
  // any save in flight. Resolves true when the tab's content is on disk.
  flush(id: string): Promise<boolean> {
    const timer = this.timers.get(id)
    if (timer === undefined && !this.failed.has(id)) {
      return this.chains.get(id) ?? Promise.resolve(true)
    }
    clearTimeout(timer)
    this.timers.delete(id)

    const run = (this.chains.get(id) ?? Promise.resolve(true)).then(async () => {
      const slow = setTimeout(() => this.onEvent(id, { kind: 'slow' }), this.slowAfter)
      try {
        await this.save(id)
        this.failed.delete(id)
        this.onEvent(id, { kind: 'ok' })
        return true
      } catch (err) {
        this.failed.add(id)
        this.onEvent(id, { kind: 'error', message: errorMessage(err) })
        return false
      } finally {
        clearTimeout(slow)
      }
    })
    this.chains.set(id, run)
    void run.then(() => {
      if (this.chains.get(id) === run) this.chains.delete(id)
    })
    return run
  }

  flushAll(): Promise<boolean> {
    const ids = new Set([...this.timers.keys(), ...this.chains.keys(), ...this.failed])
    return Promise.all([...ids].map((id) => this.flush(id))).then((results) => results.every(Boolean))
  }

  // Forget a closed tab.
  forget(id: string): void {
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    this.failed.delete(id)
  }
}
