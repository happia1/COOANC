'use client'
import ParentChevron from '@/components/parent/ParentChevron'

/**
 * 상단 알림창(공지센터) 안의 「자녀 레벨 안내」 목록입니다.
 *
 * 비개발자 설명:
 * - 부모 홈에서 X 로 닫은 레벨 안내를 여기서 다시 볼 수 있습니다(닫아도 없어지지 않습니다).
 * - 자녀가 여러 명이면 각각 한 줄씩 나오고, 누르면 펼쳐집니다.
 * - 펼치면 이번 레벨 안내와 함께 「지난 레벨 안내」도 훑어볼 수 있습니다.
 */

import { useState } from 'react'
import {
  buildParentChildLevelGuide,
  buildParentChildLevelGuideHistory,
} from '@/lib/parentChildLevelGuide'
import ParentFeatureHowToCard from '@/components/parent/ParentFeatureHowToCard'
import { PARENT_UPCOMING_NOTE } from '@/lib/parentChildLevelUnlocks'

type Props = {
  /** React 예약 prop 인 `children` 과 헷갈리지 않도록 `items` 로 받습니다 */
  items: { childId: string; name: string; level: number }[]
}

export default function ParentChildLevelGuideNoticeList({ items }: Props) {
  const [openChildId, setOpenChildId] = useState<string | null>(null)
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)
  /** 사용법을 펼쳐 둔 기능 — `자녀id:기능id` */
  const [howToOpenKey, setHowToOpenKey] = useState<string | null>(null)
  /** 지난 레벨 안내 중 펼쳐 둔 한 줄 — `자녀id:레벨` */
  const [historyLevelOpenKey, setHistoryLevelOpenKey] = useState<string | null>(null)

  if (items.length === 0) return null

  return (
    <div>
      <p className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500">
        자녀 레벨 안내
      </p>
      <ul className="space-y-2">
        {items.map((c) => {
          const guide = buildParentChildLevelGuide(c.level)
          const expanded = openChildId === c.childId
          const history = buildParentChildLevelGuideHistory(c.level).filter(
            (h) => h.level !== c.level,
          )

          return (
            <li key={c.childId} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenChildId(expanded ? null : c.childId)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-gray-900">
                    {c.name} · Lv.{guide.level} {guide.zone.emoji} {guide.zone.zone}
                  </p>
                  {/* 접힌 상태에서는 첫 문단만 한 줄로 — 줄바꿈이 들어가도 목록이 흐트러지지 않게 */}
                  <p className="mt-1 truncate text-[11px] leading-relaxed text-gray-600">
                    {guide.guideText.split('\n')[0]}
                  </p>
                </div>
                <span className="flex shrink-0 items-center text-gray-400" aria-hidden>
                  <ParentChevron direction={expanded ? 'up' : 'down'} />
                </span>
              </button>

              {expanded ? (
                <div className="border-t border-gray-100 px-3 py-3">
                  {guide.guideText ? (
                    <p className="whitespace-pre-line text-[11px] font-medium leading-relaxed text-gray-600">
                      {guide.guideText}
                    </p>
                  ) : null}

                  {guide.openedFeatures.length > 0 ? (
                    <div className="mt-2.5">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-gray-400">
                        지금 쓸 수 있어요
                      </p>
                      {/* 기능마다 눌러서 사용 순서를 펼쳐 볼 수 있게 — 레벨업 팝업을 놓쳐도 여기서 봅니다 */}
                      <ul className="space-y-1">
                        {guide.openedFeatures.map((f) => {
                          const key = `${c.childId}:${f.id}`
                          const howToOpen = howToOpenKey === key
                          return (
                            <li key={f.id}>
                              <button
                                type="button"
                                onClick={() => setHowToOpenKey(howToOpen ? null : key)}
                                aria-expanded={howToOpen}
                                className="flex w-full items-start gap-1.5 rounded-lg py-0.5 text-left transition-colors hover:bg-gray-50"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={f.iconSrc}
                                  alt=""
                                  width={16}
                                  height={16}
                                  className="mt-0.5 h-4 w-4 shrink-0 object-contain"
                                />
                                <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-gray-600">
                                  <b className="font-bold text-gray-700">{f.title}</b>
                                  <span className="text-gray-400"> · </span>
                                  {f.description}
                                </p>
                                <span className="shrink-0 text-[10px] font-bold text-[#2563EB]">
                                  {howToOpen ? '접기' : '사용법'}
                                </span>
                              </button>
                              {howToOpen ? (
                                <div className="mt-1.5">
                                  <ParentFeatureHowToCard feature={f} />
                                </div>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {guide.nextFeature ? (
                    <p className="mt-2.5 text-[11px] font-medium leading-relaxed text-gray-500">
                      {`레벨 ${guide.nextFeature.minLevel}이 되면 `}
                      <b className="font-bold text-gray-600">{guide.nextFeature.title}</b>
                      {`이 열려요 (${guide.levelsToNextFeature}레벨 남음)`}
                    </p>
                  ) : null}

                  {/* 정식 버전 예정 — 레벨을 붙이지 않고 「정식 버전에 열립니다」까지만 알립니다 */}
                  <p className="mt-2.5 whitespace-pre-line border-t border-gray-100 pt-2.5 text-[10px] leading-relaxed text-gray-400">
                    {PARENT_UPCOMING_NOTE}
                  </p>

                  {history.length > 0 ? (
                    <div className="mt-2.5 border-t border-gray-100 pt-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryOpenId(historyOpenId === c.childId ? null : c.childId)
                        }
                        aria-expanded={historyOpenId === c.childId}
                        className="text-[11px] font-bold text-[#2563EB] underline-offset-2 hover:underline"
                      >
                        {historyOpenId === c.childId
                          ? '지난 레벨 안내 접기'
                          : `지난 레벨 안내 보기 (${history.length})`}
                      </button>

                      {/* 레벨마다 접어 두고, 보고 싶은 줄만 눌러서 펼칩니다 */}
                      {historyOpenId === c.childId ? (
                        <ul className="mt-2 space-y-1">
                          {history.map((h) => {
                            const hKey = `${c.childId}:${h.level}`
                            const hOpen = historyLevelOpenKey === hKey
                            return (
                              <li key={h.level} className="rounded-lg bg-gray-50/70">
                                <button
                                  type="button"
                                  onClick={() => setHistoryLevelOpenKey(hOpen ? null : hKey)}
                                  aria-expanded={hOpen}
                                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-gray-100/70"
                                >
                                  <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-gray-500 ring-1 ring-gray-200">
                                    Lv.{h.level}
                                  </span>
                                  <p className="min-w-0 flex-1 truncate text-[11px] leading-relaxed text-gray-500">
                                    {h.guideText.split('\n')[0]}
                                  </p>
                                  <span className="flex shrink-0 items-center text-gray-400" aria-hidden>
                                    <ParentChevron direction={hOpen ? 'up' : 'down'} size="sm" />
                                  </span>
                                </button>
                                {hOpen ? (
                                  <p className="whitespace-pre-line px-2 pb-2 text-[11px] leading-relaxed text-gray-600">
                                    {h.guideText}
                                  </p>
                                ) : null}
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
