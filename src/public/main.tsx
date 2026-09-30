import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
// Satu bobot display tiap game, dipakai nama game di daftar "jadwal lain" lintas tema.
import '@fontsource/anton/400.css'
import '@fontsource/saira-stencil-one/400.css'
import '@fontsource/oswald/700.css'
import '@fontsource/teko/600.css'
import './base.css'
import './common/common.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
