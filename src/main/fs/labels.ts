import { renameLabelInText } from '../../shared/tags'
import { listFolder, NOTE_FILE } from './list'
import { readTextFile } from './read'
import { writeTextFile } from './write'

// Renaming a label across a folder (5.6, D44). Every note is read, and only
// the ones that mention the label are written back, through the same atomic
// write as any other save, keeping their line endings and BOM.

export interface LabelRename {
  files: number // notes rewritten
  failed: string[] // notes that couldn't be read or written
}

export async function renameLabelInFolder(root: string, from: string, to: string): Promise<LabelRename> {
  const entries = await listFolder(root)
  const result: LabelRename = { files: 0, failed: [] }
  for (const entry of entries) {
    if (entry.isDir || !NOTE_FILE.test(entry.path)) continue
    try {
      const { content, meta } = await readTextFile(entry.path)
      const next = renameLabelInText(content, from, to)
      if (next === null) continue
      await writeTextFile(entry.path, next, meta)
      result.files++
    } catch {
      result.failed.push(entry.path)
    }
  }
  return result
}
