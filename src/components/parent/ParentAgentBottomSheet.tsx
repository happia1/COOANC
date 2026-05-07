'use client'

/**
 * Framer Motion 바텀시트 — `AnimatePresence` 의 직접 자식을 `motion.div` 로 두어 exit 애니메이션이 끝까지 재생됩니다.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function ParentAgentBottomSheet({ open, title, onClose, children, footer }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="parent-agent-sheet-layer"
          className="fixed inset-0 z-[92] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="닫기"
            className="absolute inset-0 bg-black/45"
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="parent-agent-sheet-title"
            className="relative z-[1] flex max-h-[min(88dvh,34rem)] w-full max-w-none flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-sky-100 sm:mx-4 sm:max-h-[min(80dvh,32rem)] sm:max-w-md sm:rounded-3xl"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-sky-200/80" aria-hidden />
            <header className="shrink-0 border-b border-sky-100/80 px-4 pb-2 pt-3">
              <h2 id="parent-agent-sheet-title" className="text-center text-sm font-black text-sky-950">
                {title}
              </h2>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
            {footer ? (
              <div className="shrink-0 border-t border-sky-100/80 bg-gradient-to-t from-sky-50/90 to-white px-4 py-3">
                {footer}
              </div>
            ) : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
