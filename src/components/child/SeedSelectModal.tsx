'use client'

/**
 * 씨앗 선택 전용 오버레이 — 화분 팝업 외 경로가 필요할 때만 사용
 */

import SeedSelectPicker, { type SeedSelectPickerProps } from '@/components/child/SeedSelectPicker'

export type SeedSelectModalProps = SeedSelectPickerProps & {
  isOpen: boolean
  onClose: () => void
}

export default function SeedSelectModal({ isOpen, onClose, onPlanted, ...pickerProps }: SeedSelectModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seed-modal-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white px-3 pt-3 pb-3 shadow-xl">
        <SeedSelectPicker
          {...pickerProps}
          title={pickerProps.title ?? '🌱 어떤 씨앗을 심을까요?'}
          onPlanted={() => {
            onPlanted?.()
            onClose()
          }}
        />
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl bg-gray-100 text-sm font-bold text-gray-600 transition active:scale-[0.98]"
        >
          닫기
        </button>
      </div>
    </div>
  )
}
