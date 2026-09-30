import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
// Font display tiap game hanya dipakai di kartu pemilih game.
import '@fontsource/anton/400.css'
import '@fontsource/saira-condensed/800.css'
import '@fontsource/rubik/900.css'
import '@fontsource/teko/600.css'
import './admin.css'
import { AdminApp } from './AdminApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
