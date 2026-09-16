import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bundled locally by Vite; no network fetch.
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/400-italic.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import './global.css'
import { App } from './app/App'
import { applyTheme, DEFAULT_MODE, DEFAULT_SEED, tintTheme } from './themes'

// The saved theme is applied once settings load; this avoids an unstyled flash.
applyTheme(tintTheme(DEFAULT_SEED, DEFAULT_MODE))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
