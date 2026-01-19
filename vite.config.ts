/** @type {import('vite').UserConfig} */
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { marked } from 'marked'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

function readmePlugin(): Plugin {
  const readmePath = path.resolve(__dirname, 'README.md')

  function generateReadmeHtml(isDev = false): string {
    const readme = fs.readFileSync(readmePath, 'utf-8')

    // Transform image paths for the HTML output
    let content = readme
      .replace(/client\/public\/favicon\.svg/g, 'favicon.svg')
      .replace(/client\/public\/screenshot\.png/g, 'screenshot.png')

    // Parse markdown to HTML
    let html = marked.parse(content) as string

    // Center title (h1 with icon)
    html = html.replace(/<h1([^>]*)>/, '<h1$1 style="text-align: center;">')

    // Center the shields.io badge paragraph
    html = html.replace(
      /(<p>)(<a href="https:\/\/lg\.github\.io\/use-your-benefits")/,
      '$1<span style="display: block; text-align: center;">$2'
    )
    html = html.replace(
      /(<img src="https:\/\/img\.shields\.io[^"]*"[^>]*><\/a>)(<\/p>)/,
      '$1</span>$2'
    )

    // GitHub-styled HTML template
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Use Your Benefits - README</title>${isDev ? '\n  <script type="module" src="/@vite/client"></script>' : ''}
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-light.min.css">
  <style>
    body {
      background-color: #f6f8fa;
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
    }
    .container {
      max-width: 1012px;
      margin: 0 auto;
    }
    .readme-box {
      background: #fff;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      overflow: hidden;
    }
    .readme-header {
      padding: 16px;
      background: #f6f8fa;
      border-bottom: 1px solid #d0d7de;
      font-weight: 600;
      font-size: 14px;
      color: #1f2328;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .readme-header svg {
      color: #656d76;
    }
    .markdown-body {
      padding: 32px;
      box-sizing: border-box;
    }
    .markdown-body h1 img {
      vertical-align: middle;
      margin-right: 8px;
    }
    .markdown-body img[alt="Screenshot"] {
      max-width: 100%;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    @media (max-width: 767px) {
      body {
        padding: 16px;
      }
      .markdown-body {
        padding: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="readme-box">
      <div class="readme-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"/>
        </svg>
        README.md
      </div>
      <article class="markdown-body">
        ${html}
      </article>
    </div>
  </div>
</body>
</html>`
  }

  return {
    name: 'readme-html',

    configureServer(server: ViteDevServer) {
      // Watch README.md for changes
      server.watcher.add(readmePath)
      server.watcher.on('change', (file: string) => {
        if (file === readmePath) {
          server.ws.send({ type: 'full-reload' })
        }
      })

      // Serve /readme.html via middleware
      server.middlewares.use((req, res, next) => {
        if (req.url === '/readme.html') {
          const html = generateReadmeHtml(true)
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
          return
        }
        next()
      })
    },

    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'readme.html',
        source: generateReadmeHtml(),
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  root: './client',
  base: command === 'build' ? '/use-your-benefits/' : '/',
  plugins: [react(), readmePlugin()],
  clearScreen: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared')
    }
  }
}))
