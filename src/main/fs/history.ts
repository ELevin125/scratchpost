import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import type { HistoryEntry, HistoryUsage } from '../../preload/api'

// Local version history (3.6, D38). Snapshots live on this machine only, in
// <userData>/history/<note id>/<time>-<words>-<lines>.md, with meta.json
// naming the note's path. The id is a hash of the path; renaming or archiving
// a note moves its history along.

const MAX_NOTE_BYTES = 1024 * 1024
const MAX_TOTAL_BYTES = 200 * 1024 * 1024
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const VERSION = /^(\d+)-(\d+)-(\d+)\.md$/

export const isVersionId = (id: string): boolean => VERSION.test(`${id}.md`)

const noteId = (path: string) => createHash('sha1').update(path).digest('hex').slice(0, 20)

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}

function parse(file: string): HistoryEntry | null {
  const match = VERSION.exec(file)
  if (!match) return null
  return { id: file.slice(0, -3), time: Number(match[1]), words: Number(match[2]), lines: Number(match[3]) }
}

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length

// Which snapshots to keep: everything from the last day, the newest per hour
// for a week, the newest per day for 90 days.
export function keptVersions(times: number[], now: number): Set<number> {
  const kept = new Set<number>()
  const buckets = new Set<string>()
  for (const time of [...times].sort((a, b) => b - a)) {
    const age = now - time
    if (age < DAY) {
      kept.add(time)
      continue
    }
    if (age >= 90 * DAY) continue
    const bucket = age < 7 * DAY ? `h${Math.floor(time / HOUR)}` : `d${Math.floor(time / DAY)}`
    if (buckets.has(bucket)) continue
    buckets.add(bucket)
    kept.add(time)
  }
  return kept
}

// Changes run one at a time, so the "same as last" check never races.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => {})
  return run
}

export class HistoryStore {
  constructor(private readonly root: string) {}

  private dir(path: string): string {
    return join(this.root, noteId(path))
  }

  private async entries(dir: string): Promise<HistoryEntry[]> {
    const files = await readdir(dir).catch(() => [] as string[])
    return files
      .map(parse)
      .filter((entry): entry is HistoryEntry => entry !== null)
      .sort((a, b) => b.time - a.time)
  }

  list(path: string): Promise<HistoryEntry[]> {
    return this.entries(this.dir(path))
  }

  read(path: string, id: string): Promise<string> {
    if (!isVersionId(id)) throw new Error('not a version id')
    return readFile(join(this.dir(path), `${id}.md`), 'utf8')
  }

  snapshot(path: string, text: string): Promise<boolean> {
    if (!isAbsolute(path)) throw new Error('path must be absolute')
    if (Buffer.byteLength(text) > MAX_NOTE_BYTES) return Promise.resolve(false)
    return serial(async () => {
      const dir = this.dir(path)
      const [latest] = await this.entries(dir)
      if (latest && (await readFile(join(dir, `${latest.id}.md`), 'utf8').catch(() => null)) === text) return false
      if (!latest && text.trim() === '') return false // nothing worth keeping yet
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'meta.json'), JSON.stringify({ path }))
      const time = Math.max(Date.now(), (latest?.time ?? 0) + 1)
      await writeFile(join(dir, `${time}-${countWords(text)}-${text.split('\n').length}.md`), text)
      await this.prune(dir, Date.now())
      return true
    })
  }

  private async prune(dir: string, now: number): Promise<void> {
    const entries = await this.entries(dir)
    const kept = keptVersions(
      entries.map((e) => e.time),
      now
    )
    for (const entry of entries) {
      if (!kept.has(entry.time)) await rm(join(dir, `${entry.id}.md`), { force: true })
    }
  }

  // After a rename or archive. Versions already at the new path are kept.
  move(from: string, to: string): Promise<void> {
    return serial(async () => {
      const source = this.dir(from)
      const target = this.dir(to)
      if (source === target || !(await exists(source))) return
      if (!(await exists(target))) {
        await rename(source, target)
      } else {
        for (const entry of await this.entries(source)) {
          await rename(join(source, `${entry.id}.md`), join(target, `${entry.id}.md`)).catch(() => {})
        }
        await rm(source, { recursive: true, force: true })
      }
      await writeFile(join(target, 'meta.json'), JSON.stringify({ path: to }))
    })
  }

  // What the store holds, for the line in Settings (5.10).
  usage(): Promise<HistoryUsage> {
    return serial(async () => {
      const ids = await readdir(this.root).catch(() => [] as string[])
      let bytes = 0
      let versions = 0
      let notes = 0
      for (const id of ids) {
        const dir = join(this.root, id)
        const entries = await this.entries(dir)
        if (entries.length === 0) continue
        notes++
        versions += entries.length
        for (const entry of entries) {
          bytes += (await stat(join(dir, `${entry.id}.md`)).catch(() => null))?.size ?? 0
        }
      }
      return { bytes, versions, notes }
    })
  }

  // Throws the lot away; the notes themselves are untouched.
  clear(): Promise<void> {
    return serial(async () => {
      await rm(this.root, { recursive: true, force: true })
    })
  }

  // Once per launch: apply the schedule everywhere, drop empty notes, then
  // delete the oldest versions until the whole store is under 200 MB.
  pruneAll(now = Date.now()): Promise<void> {
    return serial(async () => {
      const ids = await readdir(this.root).catch(() => [] as string[])
      const all: { file: string; time: number; size: number }[] = []
      for (const id of ids) {
        const dir = join(this.root, id)
        await this.prune(dir, now)
        const entries = await this.entries(dir)
        if (entries.length === 0) {
          await rm(dir, { recursive: true, force: true })
          continue
        }
        for (const entry of entries) {
          const file = join(dir, `${entry.id}.md`)
          const size = (await stat(file).catch(() => null))?.size ?? 0
          all.push({ file, time: entry.time, size })
        }
      }
      let total = all.reduce((sum, f) => sum + f.size, 0)
      for (const f of all.sort((a, b) => a.time - b.time)) {
        if (total <= MAX_TOTAL_BYTES) break
        await rm(f.file, { force: true })
        total -= f.size
      }
    })
  }
}
