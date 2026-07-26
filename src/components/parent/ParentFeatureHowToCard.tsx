'use client'

/**
 * 부모용 「기능 사용법」 카드 — 아이콘 · 한 줄 설명 · 사용 순서 · 아이와 함께 해 볼 것.
 *
 * 비개발자 설명:
 * - 아이는 글을 못 읽을 수 있어서, 자녀 앱에는 짧은 안내만 두고
 *   자세한 설명은 **부모 앱**에 모았습니다. 부모가 보고 아이와 함께 따라 하면 됩니다.
 * - 레벨업 팝업(새로 열린 기능)과 상단 알림창(언제든 다시 보기) 두 곳에서 같은 카드를 씁니다.
 */

import type { ParentChildUnlockMilestone } from '@/lib/parentChildLevelUnlocks'

type Props = {
  feature: ParentChildUnlockMilestone
  /** 레벨업 팝업처럼 강조가 필요한 자리에서 true */
  highlight?: boolean
}

export default function ParentFeatureHowToCard({ feature, highlight = false }: Props) {
  return (
    <div
      className={`rounded-xl p-3 ${
        highlight ? 'bg-sky-50/90 ring-1 ring-sky-100' : 'bg-gray-50/80 ring-1 ring-gray-100'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={feature.iconSrc}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-800">{feature.title}</p>
          <p className="text-[11px] leading-relaxed text-gray-600">{feature.description}</p>
        </div>
      </div>

      {/* 사용 순서 — 부모가 아이와 함께 그대로 따라 할 수 있게 */}
      {feature.howToSteps.length > 0 ? (
        <ol className="mt-2.5 space-y-1.5">
          {feature.howToSteps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black text-gray-500 ring-1 ring-gray-200">
                {i + 1}
              </span>
              <p className="min-w-0 text-[11px] leading-relaxed text-gray-700">{step}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {feature.withChildTip ? (
        <p className="mt-2.5 rounded-lg bg-white/80 px-2.5 py-2 text-[11px] font-medium leading-relaxed text-amber-800 ring-1 ring-amber-100">
          <span className="font-black">아이와 함께 </span>
          {feature.withChildTip}
        </p>
      ) : null}
    </div>
  )
}
