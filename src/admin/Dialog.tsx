import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  actions: ReactNode
  tone?: 'default' | 'danger'
}

/** Dialog native: fokus terkunci di dalam, Escape menutup, fokus kembali ke pemicu setelah ditutup. */
export function Dialog({ open, title, onClose, children, actions, tone = 'default' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className={`adm-dialog adm-dialog--${tone}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="adm-dialog__body">
        <h2 className="adm-dialog__title" id={titleId}>
          {title}
        </h2>
        {children}
        <div className="adm-dialog__actions">{actions}</div>
      </div>
    </dialog>
  )
}
