'use client'

/**
 * 씨앗(나무) 선택 카드·심기 버튼 — 화분 팝업·전용 모달에서 공통 사용
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  TREE_LIST,
  getPlantTree,
  getPlantTreeCreditCost,
  getSeedSelectCardImage,
  type PlantTreeId,
} from '@/constants/plantTrees'
import { CHILD_CREDIT_COIN_PNG_SRC } from '@/lib/childCreditDisplay'
import type { BuySeedResult } from '@/hooks/usePlantPot'

export type SeedSelectPickerProps = {
  currentCredits: number
  onSelect: (treeId: PlantTreeId) => Promise<BuySeedResult>
  onPlanted?: () => void
  title?: string
  /** 수확 직후 등 안내 한 줄 */
  intro?: string | null
}

const FOOTER_BTN_CLASS =
  'flex h-11 w-full items-center justify-center rounded-2xl text-sm font-black transition active:scale-[0.98] disabled:opacity-50'

function CreditCoinIcon({ size = 18 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CHILD_CREDIT_COIN_PNG_SRC}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain select-none"
      style={{ width: size, height: size }}
      draggable={false}
    />
  )
}

function SeedCardImage({ treeId, emoji }: { treeId: PlantTreeId; emoji: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const src = getSeedSelectCardImage(treeId)

  if (imgFailed) {
    return <span className="text-4xl leading-none">{emoji}</span>
  }

  return (
    <Image
      src={src}
      alt=""
      width={72}
      height={72}
      className="h-12 w-12 object-contain"
      onError={() => setImgFailed(true)}
      unoptimized
    />
  )
}

export default function SeedSelectPicker({
  currentCredits,
  onSelect,
  onPlanted,
  title = '어떤 씨앗을 골라볼까요?',
  intro = null,
}: SeedSelectPickerProps) {
  const [selected, setSelected] = useState<PlantTreeId>(TREE_LIST[0]?.id ?? 'apple')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    setSelected(TREE_LIST[0]?.id ?? 'apple')
    setFeedback(null)
  }, [currentCredits])

  const tree = getPlantTree(selected)
  const cost = getPlantTreeCreditCost(selected)
  const canAfford = currentCredits >= cost

  async function handlePlant() {
    if (busy) return
    if (!canAfford) {
      setFeedback(`크레딧이 ${Math.max(0, cost - currentCredits)}개 부족해요!`)
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const result = await onSelect(selected)
      if (result.ok) {
        onPlanted?.()
        return
      }
      setFeedback('message' in result ? result.message : '씨앗 심기에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col">
      <h3 className="text-center text-base font-black leading-snug text-gray-800">{title}</h3>
      {intro ? (
        <p className="mt-1.5 text-center text-xs font-bold leading-snug text-amber-800">{intro}</p>
      ) : null}
      <p className="mt-2 flex items-center justify-center gap-1 text-sm text-gray-600">
        <span>보유 크레딧:</span>
        <CreditCoinIcon size={18} />
        <span className="font-bold text-amber-700 tabular-nums">{currentCredits}</span>
      </p>

      <div className="mt-2">
        <div
          className="overflow-x-auto snap-x snap-mandatory py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex w-max min-w-full items-center gap-2 px-[calc(50%-3rem)]">
            {TREE_LIST.map((item) => {
              const itemCost = item.creditCost
              const affordable = currentCredits >= itemCost
              const isSelected = selected === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item.id)}
                  className={`relative box-border flex h-[7.25rem] w-24 flex-shrink-0 snap-center flex-col items-center justify-between rounded-xl border-2 px-1 py-0.5 transition ${
                    isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'
                  } ${affordable ? '' : 'opacity-50'}`}
                >
                  {!affordable ? (
                    <span
                      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[10px] bg-black/10 text-2xl"
                      aria-hidden
                    >
                      🔒
                    </span>
                  ) : null}
                  <div className="flex flex-1 items-center justify-center">
                    <SeedCardImage treeId={item.id} emoji={item.emoji} />
                  </div>
                  <span className="text-center text-sm font-semibold leading-tight text-gray-800">
                    {item.name}
                  </span>
                  <span
                    className={`flex items-center justify-center gap-0.5 text-xs font-medium ${
                      affordable ? 'text-amber-600' : 'text-red-400'
                    }`}
                  >
                    <CreditCoinIcon size={14} />
                    <span className="tabular-nums">{itemCost}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {feedback ? (
        <p
          role="alert"
          className="mt-2 rounded-xl bg-red-50 px-2.5 py-2 text-center text-xs font-bold leading-snug text-red-600"
        >
          {feedback}
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handlePlant}
          disabled={busy || !canAfford}
          className={`${FOOTER_BTN_CLASS} shadow-md disabled:cursor-not-allowed ${
            canAfford ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'
          }`}
        >
          {busy ? '심는 중…' : canAfford ? `${tree.name} 심기` : '크레딧이 부족해요'}
        </button>
      </div>
    </div>
  )
}
