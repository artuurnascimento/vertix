import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Raiz from './Raiz'
import { initVtx } from './lib/vtx'

initVtx()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
)
