import type { ScratchpostAPI } from '../preload/api'

declare global {
  interface Window {
    scratchpost: ScratchpostAPI
  }
}
