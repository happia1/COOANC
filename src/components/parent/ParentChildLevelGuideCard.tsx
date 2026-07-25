'use client'

/**
 * 부모 홈 — 「다가오는 일정」 바로 위에 놓이는 자녀 레벨 안내 블록입니다.
 *
 * 비개발자 설명:
 * - 지금 아이가 몇 레벨이고 어떤 단계인지, 이 레벨에서 무엇을 해 주면 좋은지,
 *   자녀 앱에서 어떤 기능이 열려 있고 다음에 무엇이 열리는지 한 번에 보여 줍니다.
 * - 루틴 탭의 안내 공지와 같은 모양(흰 카드 + 💡 + 오른쪽 X)입니다.
 * - X 를 누르면 홈에서만 사라지고, 상단 알림창(공지센터)에서는 계속 볼 수 있습니다.
 * - 아이가 다음 레벨이 되면 새 안내가 다시 뜹니다.
 */

import { useCallback, useEffect, useState } from 'react'
import { PARENT_NEUTRAL_CARD_CLASSNAME } from '@/lib/parentNeutralBlockStyle'
import { buildParentChildLevelGuide } from '@/lib/parentChildLevelGuide'
import {
  readDismissedLevelGuideLevels,
  writeDismissedLevelGuideLevel,
} from '@/lib/parentChildLevelGuideAck'

type Props = {
  childId: string | null
  childName: string
  level: number
}

export default function ParentChildLevelGuideCard({ childId, childName, level }: Props) {
  /** null = 아직 확인 전(깜빡임 방지로 숨겨 둡니다) */
  const [dismissedLevel, setDismissedLevel] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void readDismissedLevelGuideLevels().then((map) => {
      if (cancelled) return
      setDismissedLevel(childId ? (map.get(childId) ?? -1) : -1)
    })
    return () => {
      cancelled = true
    }
  }, [childId])

  const dismiss = useCallback(() => {
    setDismissedLevel(level)
    if (childId) void writeDismissedLevelGuideLevel(childId, level)
  }, [childId, level])

  // 확인 전이거나, 이 레벨 안내를 이미 닫았으면 홈에는 띄우지 않습니다.
  if (dismissedLevel === null || dismissedLevel >= level) return null

  const guide = buildParentChildLevelGuide(level)
  if (!guide.guideText && guide.openedFeatures.length === 0) return null

  return (
    <section className={`w-full ${PARENT_NEUTRAL_CARD_CLASSNAME} px-3 py-3`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>
          💡
        </span>

        <div className="min-w-0 flex-1">
          {/* 헤더 — 이름 · 레벨 · 존 · 칭호 */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-gray-700">
              {childName} · Lv.{guide.level}
            </p>
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">
              {guide.zone.emoji} {guide.zone.zone}
            </span>
            {guide.currentBadge ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                {guide.currentBadge.emoji} {guide.currentBadge.badge}
              </span>
            ) : null}
          </div>

          {/* 이 레벨에서 부모가 해 주면 좋은 것 */}
          {guide.guideText ? (
            <p className="text-[12px] font-medium leading-relaxed text-gray-600">{guide.guideText}</p>
          ) : null}

          {/* 지금 자녀 앱에서 쓸 수 있는 기능 */}
          {guide.openedFeatures.length > 0 ? (
            <div className="mt-2">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-gray-400">
                지금 쓸 수 있어요
              </p>
              <ul className="space-y-1">
                {guide.openedFeatures.map((f) => (
                  <li key={f.id} className="flex items-start gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.iconSrc}
                      alt=""
                      width={16}
                      height={16}
                      className="mt-0.5 h-4 w-4 shrink-0 object-contain"
                    />
                    <p className="min-w-0 text-[11px] leading-relaxed text-gray-600">
                      <b className="font-bold text-gray-700">{f.title}</b>
                      <span className="text-gray-400"> · </span>
                      {f.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 다음에 열릴 기능 */}
          {guide.nextFeature ? (
            <p className="mt-2 text-[11px] font-medium leading-relaxed text-gray-500">
              {`레벨 ${guide.nextFeature.minLevel}이 되면 `}
              <b className="font-bold text-gray-600">{guide.nextFeature.title}</b>
              {`이 열려요 (${guide.levelsToNextFeature}레벨 남음)`}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="레벨 안내 닫기"
          title="닫아도 상단 알림에서 다시 볼 수 있어요"
          className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </section>
  )
}
