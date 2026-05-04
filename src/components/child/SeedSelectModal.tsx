'use client'

/**
 * 열매 완성 후 — 어떤 씨앗을 심을지 고르는 모달입니다.
 *
 * 비개발자 설명:
 * - 나무 종류 리스트(`TREE_LIST`)를 카드로 보여 줘요.
 * - 지금은 사과나무 하나만 있지만, 나중에 항목만 추가하면 자동으로 여러 카드가 뜹니다.
 */

import { useState } from 'react'
import { TREE_LIST, type PlantTreeId } from '@/constants/plantTrees'

type Props = {
  open: boolean
  onClose: () => void
  /** 확인 시 DB 초기화 + 선택한 나무 id 저장 */
  onConfirm: (treeId: PlantTreeId) => Promise<void>
}

export default function SeedSelectModal({ open, onClose, onConfirm }: Props) {
  const [picked, setPicked] = useState<PlantTreeId>(TREE_LIST[0]?.id ?? 'apple')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm(picked)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seed-modal-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
        <h2 id="seed-modal-title" className="text-center text-lg font-black text-gray-800">
          새 씨앗을 골라요
        </h2>
        <p className="mt-1 text-center text-xs text-gray-500">
          완성한 나무는 쉬고, 새 싹이 올라올 거예요.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {TREE_LIST.map((tree) => {
            const selected = picked === tree.id
            return (
              <li key={tree.id}>
                <button
                  type="button"
                  onClick={() => setPicked(tree.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition ${
                    selected ? 'border-pink-400 bg-pink-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <span className="text-3xl" aria-hidden>
                    {tree.seedEmoji}
                  </span>
                  <span className="flex-1 font-bold text-gray-800">{tree.label}</span>
                  {selected ? <span className="text-xs font-black text-pink-500">선택</span> : null}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-600 transition active:scale-[0.98] disabled:opacity-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 rounded-2xl bg-pink-500 py-3 text-sm font-black text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? '심는 중…' : '심기'}
          </button>
        </div>
      </div>
    </div>
  )
}
