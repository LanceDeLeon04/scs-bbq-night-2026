import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path matters for GitHub Pages project sites (https://<user>.github.io/<repo>/).
// Set VITE_BASE_PATH in your GitHub Actions workflow or .env if deploying to a
// project page; defaults to '/' which is correct for Vercel/Netlify/custom domains.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
})
