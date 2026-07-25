'use client'

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

type Props = {
  /** React 예약 prop 인 `children` 과 헷갈리지 않도록 `items` 로 받습니다 */
  items: { childId: string; name: string; level: number }[]
}

export default function ParentChildLevelGuideNoticeList({ items }: Props) {
  const [openChildId, setOpenChildId] = useState<string | null>(null)
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)

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
                <span
                  className={`shrink-0 text-lg font-bold text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                  aria-hidden
                >
                  ›
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

                  {guide.nextFeature ? (
                    <p className="mt-2.5 text-[11px] font-medium leading-relaxed text-gray-500">
                      {`레벨 ${guide.nextFeature.minLevel}이 되면 `}
                      <b className="font-bold text-gray-600">{guide.nextFeature.title}</b>
                      {`이 열려요 (${guide.levelsToNextFeature}레벨 남음)`}
                    </p>
                  ) : null}

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

                      {historyOpenId === c.childId ? (
                        <ul className="mt-2 space-y-1.5">
                          {history.map((h) => (
                            <li key={h.level} className="flex gap-1.5">
                              <span className="mt-px shrink-0 rounded-full bg-gray-50 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 ring-1 ring-gray-200">
                                Lv.{h.level}
                              </span>
                              <p className="min-w-0 whitespace-pre-line text-[11px] leading-relaxed text-gray-500">
                                {h.guideText}
                              </p>
                            </li>
                          ))}
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
