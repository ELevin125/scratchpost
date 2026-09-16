const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

// Links in notes are untrusted text. Only web and mail links reach the OS;
// file:, javascript: and custom schemes never do.
export function isExternalUrl(url: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}
