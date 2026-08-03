import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const REQUIRED_PUBLIC_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const

function validateProductionEnv(env: Record<string, string>) {
  const missing = REQUIRED_PUBLIC_ENV.filter((name) => {
    const value = env[name]?.trim()
    return !value || /^your[-_]/i.test(value)
  })

  if (missing.length > 0) {
    throw new Error(
      `[FrameFlow] Missing production environment variables: ${missing.join(', ')}. ` +
      'Add them in Vercel Project Settings > Environment Variables, then redeploy.',
    )
  }

  let supabaseUrl: URL
  try {
    supabaseUrl = new URL(env.VITE_SUPABASE_URL.trim())
  } catch {
    throw new Error('[FrameFlow] VITE_SUPABASE_URL must be a valid absolute URL.')
  }

  if (supabaseUrl.protocol !== 'https:') {
    throw new Error('[FrameFlow] VITE_SUPABASE_URL must use HTTPS in production.')
  }
}

export default defineConfig(({ mode }) => {
  // The empty prefix loads both VITE_* and server-side process variables.
  // Only VITE_* variables referenced by source code are exposed to the client.
  const env = loadEnv(mode, process.cwd(), '')

  if (mode === 'production') {
    validateProductionEnv(env)
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
