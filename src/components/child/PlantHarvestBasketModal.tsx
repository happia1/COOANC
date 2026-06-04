'use client'

/**
 * 수확한 과일 보관함 — 종류별 개수 (추후 판매·크레딧 전환 예정)
 */

import { useState } from 'react'
import Image from 'next/image'
import type { PlantHarvestInventoryRow } from '@/lib/plantHarvest'
import {
  getSeedSelectCardImage,
  PLANT_HARVEST_BASKET_ICON_SRC,
  type PlantTreeId,
} from '@/constants/plantTrees'

type Props = {
  isOpen: boolean
  onClose: () => void
  items: PlantHarvestInventoryRow[]
  loading?: boolean
}

function FruitThumb({ fruitId, emoji }: { fruitId: PlantTreeId; emoji: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className="text-2xl">{emoji}</span>
  return (
    <Image
      src={getSeedSelectCardImage(fruitId)}
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
      onError={() => setFailed(true)}
      unoptimized
    />
  )
}

export default function PlantHarvestBasketModal({ isOpen, onClose, items, loading }: Props) {
  if (!isOpen) return null

  const total = items.reduce((s, r) => s + r.quantity, 0)

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="harvest-basket-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-center gap-2">
          <Image
            src={PLANT_HARVEST_BASKET_ICON_SRC}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            unoptimized
          />
          <h2 id="harvest-basket-title" className="text-base font-black text-gray-800">
            내 과일 바구니
          </h2>
        </div>
        <p className="mt-1 text-center text-xs text-gray-500">
          {loading ? '불러오는 중…' : `총 ${total}개 · 나중에 판매해서 크레딧을 받을 수 있어요`}
        </p>

        <ul className="mt-3 max-h-[14rem] space-y-1.5 overflow-y-auto">
          {items.map((row) => (
            <li
              key={row.fruitId}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${
                row.quantity > 0 ? 'border-amber-200 bg-amber-50/80' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <FruitThumb fruitId={row.fruitId} emoji={row.emoji} />
              <span className="flex-1 text-sm font-bold text-gray-800">{row.fruitName}</span>
              <span className="text-sm font-black tabular-nums text-amber-800">{row.quantity}개</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 h-11 w-full rounded-2xl bg-gray-100 text-sm font-bold text-gray-600 transition active:scale-[0.98]"
        >
          닫기
        </button>
      </div>
    </div>
  )
}
