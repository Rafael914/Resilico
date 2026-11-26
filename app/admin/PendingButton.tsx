'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

export default function PendingButton({
  children,
  pendingText,
  className,
  ariaLabel,
}: {
  children: ReactNode
  pendingText: string
  className: string
  ariaLabel?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={`${className} admin-pending-button`} disabled={pending} aria-busy={pending} aria-label={ariaLabel}>
      {pending && <span className="admin-button-spinner" aria-hidden="true" />}
      <span>{pending ? pendingText : children}</span>
    </button>
  )
}
