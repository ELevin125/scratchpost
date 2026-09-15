import {
  addCursorAbove,
  addCursorBelow,
  copyLineDown,
  moveLineDown,
  moveLineUp,
  redo,
  undo
} from '@codemirror/commands'
import { selectNextOccurrence } from '@codemirror/search'
import type { StateCommand } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { toggleTasksAtSelection } from '../../editor/checkbox'
import { formatShortcut, matchesShortcut, type KeyEventLike } from './shortcuts'

// The command registry. Every user action is registered here once; the
// shortcut listener, the palette, the tab strip and the status bar all read
// from this list. Adding a command here is the only edit needed for it to
// appear in the palette. See ARCHITECTURE.md and D24.

export interface AppActions {
  openPalette(): void
  newNote(): void
  openFile(): void
  renameActive(): void
  closeActive(): void
}

export interface CommandContext {
  view: EditorView | null // null when no tab is open
  activePath: string | null // null for a new note that has no file yet
  actions: AppActions
}

export interface Command {
  id: string
  label: string
  shortcut?: string // e.g. "Ctrl+Shift+P"; see shortcuts.ts
  run: (ctx: CommandContext) => void
  when?: (ctx: CommandContext) => boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

// YYYY-MM-DD, matching note filenames.
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const insertDate: StateCommand = ({ state, dispatch }) => {
  dispatch(state.update(state.replaceSelection(formatDate(new Date())), { scrollIntoView: true, userEvent: 'input' }))
  return true
}

// Editor commands need an open tab, and hand focus back to the editor so they
// behave the same from the palette as from the keyboard.
function editorCommand(command: (view: EditorView) => boolean): Pick<Command, 'run' | 'when'> {
  return {
    when: (ctx) => ctx.view !== null,
    run: (ctx) => {
      if (!ctx.view) return
      command(ctx.view)
      ctx.view.focus()
    }
  }
}

export const commands: readonly Command[] = [
  { id: 'palette.open', label: 'Command palette', shortcut: 'Ctrl+Shift+P', run: (ctx) => ctx.actions.openPalette() },
  { id: 'note.new', label: 'New note', shortcut: 'Ctrl+N', run: (ctx) => ctx.actions.newNote() },
  { id: 'file.open', label: 'Open file…', shortcut: 'Ctrl+O', run: (ctx) => ctx.actions.openFile() },
  {
    id: 'file.rename',
    label: 'Rename file…',
    shortcut: 'F2',
    run: (ctx) => ctx.actions.renameActive(),
    when: (ctx) => ctx.activePath !== null
  },
  { id: 'tab.close', label: 'Close tab', run: (ctx) => ctx.actions.closeActive(), when: (ctx) => ctx.view !== null },

  { id: 'edit.undo', label: 'Undo', shortcut: 'Ctrl+Z', ...editorCommand(undo) },
  { id: 'edit.redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z', ...editorCommand(redo) },
  { id: 'line.moveUp', label: 'Move line up', shortcut: 'Alt+ArrowUp', ...editorCommand(moveLineUp) },
  { id: 'line.moveDown', label: 'Move line down', shortcut: 'Alt+ArrowDown', ...editorCommand(moveLineDown) },
  { id: 'line.duplicate', label: 'Duplicate line', shortcut: 'Ctrl+Shift+D', ...editorCommand(copyLineDown) },
  { id: 'cursor.addAbove', label: 'Add cursor above', shortcut: 'Ctrl+Alt+ArrowUp', ...editorCommand(addCursorAbove) },
  { id: 'cursor.addBelow', label: 'Add cursor below', shortcut: 'Ctrl+Alt+ArrowDown', ...editorCommand(addCursorBelow) },
  {
    id: 'selection.addNext',
    label: 'Add next occurrence to selection',
    shortcut: 'Ctrl+D',
    ...editorCommand(selectNextOccurrence)
  },
  { id: 'checkbox.toggle', label: 'Toggle checkbox', shortcut: 'Ctrl+Enter', ...editorCommand(toggleTasksAtSelection) },
  { id: 'date.insert', label: 'Insert date', ...editorCommand(insertDate) }
]

export function availableCommands(list: readonly Command[], ctx: CommandContext): Command[] {
  return list.filter((command) => !command.when || command.when(ctx))
}

export function commandForEvent(list: readonly Command[], event: KeyEventLike, ctx: CommandContext): Command | null {
  return (
    list.find(
      (command) =>
        command.shortcut !== undefined &&
        matchesShortcut(command.shortcut, event) &&
        (!command.when || command.when(ctx))
    ) ?? null
  )
}

// Tooltip text for buttons that run a command: "New note (Ctrl+N)".
export function commandHint(id: string): string {
  const command = commands.find((c) => c.id === id)
  if (!command) return ''
  return command.shortcut ? `${command.label} (${formatShortcut(command.shortcut)})` : command.label
}
