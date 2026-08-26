import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages sirve el proyecto bajo /<nombre-del-repo>/, así que el base
// debe coincidir exactamente con el nombre del repo en GitHub.
// https://vite.dev/config/
export default defineConfig({
  base: '/inventario_licor/',
  plugins: [react()],
})
