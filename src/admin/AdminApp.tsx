import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../shared/api'
import { KEYS, readJSON, removeKey, writeJSON } from '../shared/storage'
import { Dashboard } from './Dashboard'
import { Login } from './Login'

type Gate =
  | { kind: 'checking' }
  | { kind: 'login'; notice?: string; configured: boolean | null; apiMissing?: boolean }
  | { kind: 'in'; token: string }

export function AdminApp() {
  const [gate, setGate] = useState<Gate>({ kind: 'checking' })

  const check = useCallback(async () => {
    const token = readJSON<string>(KEYS.token)
    try {
      const res = await api.session(token)
      if (token && res.valid) setGate({ kind: 'in', token })
      else {
        if (token) removeKey(KEYS.token)
        setGate({ kind: 'login', configured: res.configured, notice: token ? 'Sesi login sudah habis. Masuk lagi ya.' : undefined })
      }
    } catch (err) {
      const apiMissing = err instanceof ApiError && err.code === 'no-api'
      setGate({ kind: 'login', configured: null, apiMissing, notice: apiMissing ? undefined : 'Server belum bisa dihubungi. Coba lagi sebentar.' })
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  if (gate.kind === 'checking') {
    return (
      <main className="adm-boot" aria-busy="true">
        <p className="adm-boot__mark">JARKOMAN</p>
        <p role="status">Memeriksa sesi admin…</p>
      </main>
    )
  }

  if (gate.kind === 'login') {
    return (
      <Login
        configured={gate.configured}
        apiMissing={gate.apiMissing}
        notice={gate.notice}
        onRetry={check}
        onSuccess={(token) => {
          writeJSON(KEYS.token, token)
          setGate({ kind: 'in', token })
        }}
      />
    )
  }

  return (
    <Dashboard
      token={gate.token}
      onLogout={(notice) => {
        removeKey(KEYS.token)
        setGate({ kind: 'login', configured: true, notice })
      }}
    />
  )
}
