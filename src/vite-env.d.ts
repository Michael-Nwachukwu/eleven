/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_ENABLE_AEON_PAYMENTS?: string
  readonly VITE_AEON_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
