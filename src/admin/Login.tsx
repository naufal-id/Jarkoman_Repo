import { useRef, useState, type FormEvent } from 'react'
import { api, ApiError } from '../shared/api'
import { GAME_IDS } from '../shared/types'
import { GAMES } from '../shared/games'

interface LoginProps {
  configured: boolean | null
  apiMissing?: boolean
  notice?: string
  onRetry: () => void
  onSuccess: (token: string) => void
}

export function Login({ configured, apiMissing, notice, onRetry, onSuccess }: LoginProps) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError('Password belum diisi.')
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      const { token } = await api.login(password)
      onSuccess(token)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk. Coba lagi.')
      inputRef.current?.select()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="adm-login">
      <section className="adm-login__brand" aria-hidden="true">
        <p className="adm-login__mark">JARKOMAN</p>
        <p className="adm-login__role">Ruang host</p>
        <ul className="adm-login__games">
          {GAME_IDS.map((g) => (
            <li key={g} data-game={g} style={{ '--acc': GAMES[g].accent } as React.CSSProperties}>
              {GAMES[g].name}
            </li>
          ))}
        </ul>
      </section>

      <section className="adm-login__panel" aria-labelledby="login-title">
        <h1 id="login-title" className="adm-login__title">
          Masuk untuk mengubah jarkoman
        </h1>
        <p className="adm-login__text">Perubahan yang kamu simpan langsung tampil di halaman publik dan di preview link grup WhatsApp.</p>

        {notice && (
          <p className="adm-note" role="status">
            {notice}
          </p>
        )}

        {apiMissing ? (
          <div className="adm-note adm-note--warn" role="alert">
            <p>
              <strong>API tidak ditemukan.</strong> Dashboard butuh Netlify Functions. Jalankan lewat deploy Netlify atau <code>npm run dev</code> di komputer.
            </p>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={onRetry}>
              Cek lagi
            </button>
          </div>
        ) : configured === false ? (
          <div className="adm-note adm-note--warn" role="alert">
            <p>
              <strong>Password admin belum diset.</strong> Di Netlify buka <em>Site configuration → Environment variables</em>, tambahkan <code>ADMIN_PASSWORD</code>, lalu
              deploy ulang.
            </p>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={onRetry}>
              Sudah, cek lagi
            </button>
          </div>
        ) : (
          <form className="adm-login__form" onSubmit={submit} noValidate>
            <label className="adm-label" htmlFor="adm-pass">
              Password admin
            </label>
            <div className="adm-pass">
              <input
                ref={inputRef}
                id="adm-pass"
                className="adm-input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'adm-pass-err' : undefined}
                autoFocus
              />
              <button className="adm-pass__toggle" type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}>
                {show ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>
            {error && (
              <p className="adm-error" id="adm-pass-err" role="alert">
                {error}
              </p>
            )}
            <button className="adm-btn adm-btn--primary adm-login__submit" type="submit" disabled={busy}>
              {busy ? 'Memeriksa…' : 'Masuk dashboard'}
            </button>
          </form>
        )}

        <a className="adm-link" href="/">
          Kembali ke halaman jarkoman
        </a>
      </section>
    </main>
  )
}
