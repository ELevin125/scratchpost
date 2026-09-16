// The one icon set (D33): 20-unit line drawings, stroked in the current text
// colour. Every icon button also carries a tooltip with its label and shortcut.

const paths = {
  notes: 'M5 2.5h7l3 3v12H5z M8 9h5 M8 12h5 M8 15h3',
  search: 'M13.5 8.5a5 5 0 1 1-10 0a5 5 0 1 1 10 0 M12.5 12.5l4.5 4.5',
  find: 'M3 5h14 M3 10h6 M3 15h5 M17.5 14.5a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M16.6 16.6l1.9 1.9',
  tag: 'M3 3h7l7 7-7 7-7-7z M7.5 7a0.5 0.5 0 1 1-1 0a0.5 0.5 0 1 1 1 0',
  folder: 'M2.5 4.5h5l2 2h8v9h-15z',
  open: 'M2.5 4.5h5l2 2h8v2 M2.5 4.5v11h12l3-7h-12l-3 7',
  plus: 'M10 4v12 M4 10h12',
  minus: 'M4 10h12',
  settings: 'M3 6h9 M15 6h2 M3 14h2 M8 14h9 M12 4v4 M5 12v4',
  command: 'M3 5l5 5-5 5 M10 15h7',
  x: 'M6 6l8 8 M14 6l-8 8',
  home: 'M3 9.5l7-6 7 6 M5 8v8.5h10V8',
  pin: 'M7.5 3h5l-.8 5 2.8 3H5.5l2.8-3z M10 11v6',
  archive: 'M3 4h14v3H3z M4.5 7v9h11V7 M8 10.5h4',
  chevronRight: 'M8 5l5 5-5 5',
  chevronDown: 'M5 8l5 5 5-5',
  sun: 'M13 10a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M10 2v2 M10 16v2 M2 10h2 M16 10h2 M4.3 4.3l1.4 1.4 M14.3 14.3l1.4 1.4 M4.3 15.7l1.4-1.4 M14.3 5.7l1.4-1.4',
  moon: 'M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z',
  palette:
    'M10 2.5a7.5 7.5 0 1 0 0 15c1.2 0 1.8-.8 1.4-1.9-.4-1.1.3-2.1 1.5-2.1h1.6a3 3 0 0 0 3-3A7.5 7.5 0 0 0 10 2.5z M7 7.5h.01 M10 5.5h.01 M13 7.5h.01'
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
