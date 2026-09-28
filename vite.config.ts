/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { createServer, defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'

const API_ROUTES: Record<string, string> = {
  '/api/state': '/netlify/functions/state.mts',
  '/api/login': '/netlify/functions/login.mts',
  '/api/media': '/netlify/functions/media.mts',
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => ok(Buffer.concat(chunks)))
    req.on('error', fail)
  })
}

/**
 * Menjalankan handler Netlify Functions yang sama saat `npm run dev` / `npm run preview`,
 * dengan penyimpanan file di `.data/`. Di Netlify, file ini tidak dipakai sama sekali.
 */
function devApi(env: Record<string, string>): Plugin {
  let loader: Pick<ViteDevServer, 'ssrLoadModule'> | null = null

  const setupEnv = () => {
    process.env.JARKOMAN_DEV_STORE ??= resolve('.data')
    if (env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD ??= env.ADMIN_PASSWORD
    if (!process.env.ADMIN_PASSWORD) {
      process.env.ADMIN_PASSWORD = 'admin'
      console.info('\n  [jarkoman] ADMIN_PASSWORD tidak diset, password admin lokal: "admin"\n')
    }
  }

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const file = API_ROUTES[url.pathname]
    if (!file || !loader) return next()
    try {
      const mod = (await loader.ssrLoadModule(file)) as { default: (r: Request) => Promise<Response> }
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
      const method = req.method ?? 'GET'
      const body = method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(await readBody(req))
      const response = await mod.default(new Request(url.href, { method, headers, body }))
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (err) {
      console.error('[jarkoman dev api]', err)
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'Dev API error' }))
    }
  }

  return {
    name: 'jarkoman-dev-api',
    configureServer(server) {
      setupEnv()
      loader = server
      server.middlewares.use(middleware)
    },
    async configurePreviewServer(server) {
      setupEnv()
      const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
      loader = vite
      server.middlewares.use(middleware)
    },
  }
}

/** Mengisi URL situs (dari env Netlify `URL`) ke meta Open Graph statis di HTML. */
function siteUrl(): Plugin {
  const url = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
  return {
    name: 'jarkoman-site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', url),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), ...(process.env.VITEST ? [] : [devApi(env)]), siteUrl()],
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
        },
      },
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  }
})
