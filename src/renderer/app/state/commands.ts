import {
  addCursorAbove,
  addCursorBelow,
  copyLineDown,
  moveLineDown,
  moveLineUp,
  redo,
  undo
} from '@codemirror/commands'
import { findNext, findPrevious, openSearchPanel, selectNextOccurrence } from '@codemirror/search'
import type { StateCommand } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { toggleTasksAtSelection } from '../../editor/checkbox'
import { formatShortcut, matchesShortcut, type KeyEventLike } from './shortcuts'

// The command registry. Every user action is registered here once; the
// shortcut listener, the palette, context menus, the tab strip and the status
// bar all read from this list. Adding a command here is the only edit needed
// for it to appear in the palette. See ARCHITECTURE.md, D24 and D29.

export interface AppActions {
  openPalette(): void
  openSwitcher(): void
  openSearch(): void
  openFolderMenu(): void
  newNote(): void
  openWelcome(): void
  openFile(): void
  openFolder(): void
  openParentFolder(): void
  useScratchFolder(): void
  toggleTree(): void
  renameActive(): void
  deleteActive(): void
  revealActive(): void
  copyActivePath(): void
  closeActive(): void
  reopenClosed(): void
  nextTab(): void
  previousTab(): void
  toggleMode(): void
  openColours(): void
  openSettings(): void
  pinActive(pinned: boolean): void
  closeOthers(): void
  closeAll(): void
  archiveActive(): void
  unarchiveActive(): void
}

export interface CommandContext {
  view: EditorView | null // null when no tab is open
  activePath: string | null // null for a new note that has no file yet
  isScratchContext: boolean // the folder context is the scratch folder
  mode: 'light' | 'dark' // the current theme mode, for the toggle's label
  activePinned: boolean
  activeArchived: boolean // the active note sits in an archive folder
  tabCount: number
  actions: AppActions
}

export interface Command {
  id: string
  label: string
  shortcut?: string // shown beside the command, e.g. "Ctrl+Shift+P"; see shortcuts.ts
  extraShortcuts?: string[] // also matched, never shown
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

const hasFile = (ctx: CommandContext) => ctx.activePath !== null
const hasTab = (ctx: CommandContext) => ctx.view !== null

export const commands: readonly Command[] = [
  { id: 'palette.open', label: 'Command palette', shortcut: 'Ctrl+Shift+P', run: (ctx) => ctx.actions.openPalette() },
  { id: 'note.new', label: 'New note', shortcut: 'Ctrl+N', run: (ctx) => ctx.actions.newNote() },
  { id: 'note.welcome', label: 'Open welcome note', run: (ctx) => ctx.actions.openWelcome() },
  { id: 'file.open', label: 'Open file…', shortcut: 'Ctrl+O', run: (ctx) => ctx.actions.openFile() },
  { id: 'switcher.open', label: 'Quick switcher', shortcut: 'Ctrl+P', run: (ctx) => ctx.actions.openSwitcher() },
  { id: 'search.open', label: 'Search in folder', shortcut: 'Ctrl+Shift+F', run: (ctx) => ctx.actions.openSearch() },
  { id: 'tree.toggle', label: 'Toggle notes panel', shortcut: 'Ctrl+B', run: (ctx) => ctx.actions.toggleTree() },
  { id: 'folder.switch', label: 'Switch folder…', run: (ctx) => ctx.actions.openFolderMenu() },
  { id: 'folder.open', label: 'Open folder…', run: (ctx) => ctx.actions.openFolder() },
  { id: 'folder.parent', label: 'Open parent folder', run: (ctx) => ctx.actions.openParentFolder() },
  {
    id: 'folder.scratch',
    label: 'Back to scratch folder',
    run: (ctx) => ctx.actions.useScratchFolder(),
    when: (ctx) => !ctx.isScratchContext
  },

  {
    id: 'theme.light',
    label: 'Switch to light mode',
    run: (ctx) => ctx.actions.toggleMode(),
    when: (ctx) => ctx.mode === 'dark'
  },
  {
    id: 'theme.dark',
    label: 'Switch to dark mode',
    run: (ctx) => ctx.actions.toggleMode(),
    when: (ctx) => ctx.mode === 'light'
  },
  { id: 'theme.colour', label: 'Change theme colour…', run: (ctx) => ctx.actions.openColours() },
  { id: 'settings.open', label: 'Settings…', shortcut: 'Ctrl+,', run: (ctx) => ctx.actions.openSettings() },

  { id: 'file.rename', label: 'Rename file…', shortcut: 'F2', run: (ctx) => ctx.actions.renameActive(), when: hasFile },
  { id: 'file.reveal', label: 'Show in file manager', run: (ctx) => ctx.actions.revealActive(), when: hasFile },
  { id: 'file.copyPath', label: 'Copy path', run: (ctx) => ctx.actions.copyActivePath(), when: hasFile },
  {
    id: 'file.archive',
    label: 'Archive note',
    run: (ctx) => ctx.actions.archiveActive(),
    when: (ctx) => hasFile(ctx) && !ctx.activeArchived
  },
  {
    id: 'file.unarchive',
    label: 'Move out of archive',
    run: (ctx) => ctx.actions.unarchiveActive(),
    when: (ctx) => hasFile(ctx) && ctx.activeArchived
  },
  { id: 'file.delete', label: 'Delete note', run: (ctx) => ctx.actions.deleteActive(), when: hasFile },

  { id: 'tab.next', label: 'Next tab', shortcut: 'Ctrl+Tab', run: (ctx) => ctx.actions.nextTab(), when: hasTab },
  {
    id: 'tab.previous',
    label: 'Previous tab',
    shortcut: 'Ctrl+Shift+Tab',
    run: (ctx) => ctx.actions.previousTab(),
    when: hasTab
  },
  { id: 'tab.close', label: 'Close tab', shortcut: 'Ctrl+W', run: (ctx) => ctx.actions.closeActive(), when: hasTab },
  {
    id: 'tab.pin',
    label: 'Pin tab',
    run: (ctx) => ctx.actions.pinActive(true),
    when: (ctx) => hasTab(ctx) && !ctx.activePinned
  },
  {
    id: 'tab.unpin',
    label: 'Unpin tab',
    run: (ctx) => ctx.actions.pinActive(false),
    when: (ctx) => hasTab(ctx) && ctx.activePinned
  },
  {
    id: 'tab.closeOthers',
    label: 'Close other tabs',
    run: (ctx) => ctx.actions.closeOthers(),
    when: (ctx) => ctx.tabCount > 1
  },
  {
    id: 'tab.closeAll',
    label: 'Close all tabs',
    run: (ctx) => ctx.actions.closeAll(),
    when: (ctx) => ctx.tabCount > 0
  },
  { id: 'tab.reopen', label: 'Reopen closed tab', shortcut: 'Ctrl+Shift+T', run: (ctx) => ctx.actions.reopenClosed() },

  { id: 'find.open', label: 'Find in note', shortcut: 'Ctrl+F', ...editorCommand(openSearchPanel) },
  { id: 'find.next', label: 'Find next', shortcut: 'F3', ...editorCommand(findNext) },
  { id: 'find.previous', label: 'Find previous', shortcut: 'Shift+F3', ...editorCommand(findPrevious) },

  { id: 'edit.undo', label: 'Undo', shortcut: 'Ctrl+Z', ...editorCommand(undo) },
  { id: 'edit.redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z', extraShortcuts: ['Ctrl+Y'], ...editorCommand(redo) },
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

export function allShortcuts(command: Command): string[] {
  return [...(command.shortcut ? [command.shortcut] : []), ...(command.extraShortcuts ?? [])]
}

export function commandForEvent(list: readonly Command[], event: KeyEventLike, ctx: CommandContext): Command | null {
  return (
    list.find(
      (command) =>
        allShortcuts(command).some((shortcut) => matchesShortcut(shortcut, event)) &&
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
