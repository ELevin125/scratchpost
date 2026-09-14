import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme, defaultTheme } from './themes'

applyTheme(defaultTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <p style={{ background: 'var(--paper)', color: 'var(--body)' }}>Scratchpost</p>
  </StrictMode>
)
