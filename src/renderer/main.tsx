import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bundled locally by Vite; no network fetch.
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/400-italic.css'
import './global.css'
import { App } from './app/App'
import { applyTheme, defaultTheme } from './themes'

applyTheme(defaultTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
