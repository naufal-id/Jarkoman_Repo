import { useId, useState, type ReactNode } from 'react'

export function Field({ label, hint, children, htmlFor, wide }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string; wide?: boolean }) {
  return (
    <div className={`adm-field ${wide ? 'adm-field--wide' : ''}`}>
      <label className="adm-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="adm-hint">{hint}</p>}
    </div>
  )
}

interface ChoiceProps {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  hint?: ReactNode
  allowEmpty?: string
}

const CUSTOM = '__custom__'

/** Pilihan dari daftar resmi, dengan opsi "tulis sendiri" untuk nilai di luar daftar. */
export function ChoiceField({ label, value, options, onChange, hint, allowEmpty }: ChoiceProps) {
  const id = useId()
  const inList = value === '' || options.includes(value)
  const [custom, setCustom] = useState(!inList)
  const showInput = custom || !inList
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="adm-choice">
        <select
          id={id}
          className="adm-input"
          value={showInput ? CUSTOM : value}
          onChange={(e) => {
            if (e.target.value === CUSTOM) {
              setCustom(true)
              return
            }
            setCustom(false)
            onChange(e.target.value)
          }}
        >
          {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={CUSTOM}>Lainnya, tulis sendiri…</option>
        </select>
        {showInput && (
          <input
            className="adm-input"
            aria-label={`${label} (tulis sendiri)`}
            value={value}
            maxLength={48}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Tulis ${label.toLowerCase()}`}
            autoFocus={custom && inList}
          />
        )}
      </div>
    </Field>
  )
}

export function Counter({ value, max }: { value: string; max: number }) {
  const left = max - value.length
  return (
    <span className={`adm-counter ${left < 8 ? 'is-low' : ''}`} aria-live="polite">
      {value.length}/{max}
    </span>
  )
}
