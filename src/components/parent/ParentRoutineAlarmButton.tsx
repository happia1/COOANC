'use client'

/**
 * 부모 상단바 — 설정 링크 옆 알람 버튼. 루틴 알람 시트를 엽니다.
 */

import { useState } from 'react'
import RoutineAlarmSettingsSheet from '@/components/parent/RoutineAlarmSettingsSheet'

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 14h18c0-7-3-7-3-14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
    </svg>
  )
}

export default function ParentRoutineAlarmButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
        aria-label="루틴 알람 설정"
      >
        <BellIcon className="h-[18px] w-[18px]" />
      </button>
      <RoutineAlarmSettingsSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
