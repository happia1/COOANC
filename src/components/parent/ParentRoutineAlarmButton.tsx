'use client'

/**
 * 부모 상단바 — 설정 링크 옆 알람 버튼. 루틴 알람 시트를 엽니다.
 */

import { useState } from 'react'
import Image from 'next/image'
import RoutineAlarmSettingsSheet from '@/components/parent/RoutineAlarmSettingsSheet'

export default function ParentRoutineAlarmButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-80"
        aria-label="루틴 알람 설정"
      >
        {/* 알약 배경 없이 이미지 아이콘만 노출 */}
        <Image src="/assets/img/common/ui/alarm.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
      </button>
      <RoutineAlarmSettingsSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
