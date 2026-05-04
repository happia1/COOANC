'use client'

/**
 * 루틴 알람 소리 선택 — 카테고리(기상·등원·취침·기타)별로 묶어 pill 형태 목록을 보여 줍니다.
 * 부모 루틴 알람 시트와 온보딩 초기 루틴 설정이 같은 화면을 쓰게 하려고 두고요.
 */

import {
  ROUTINE_ALARM_SOUND_CATEGORY_LABELS_KO,
  ROUTINE_ALARM_SOUND_CATEGORY_ORDER,
  ROUTINE_ALARM_SOUND_CATALOG,
  mergeRoutineAlarmPickListFromApi,
  type RoutineAlarmSoundCatalogItem,
  type RoutineAlarmSoundCategoryKey,
} from '@/lib/routineAlarmSounds'

/** `/api/assets/alarm-sounds` 한 줄과 동일 — 표시 전 항상 카탈로그로 거르고 순서·카테고리를 고정합니다 */
export type AlarmSoundPickRow = RoutineAlarmSoundCatalogItem

type Accent = 'parentBlue' | 'routineBlue'

const ACCENTS: Record<Accent, { selOn: string; selOffHover: string; playing: string }> = {
  parentBlue: {
    selOn: 'bg-[#4A90E2] text-white',
    selOffHover: 'text-gray-600 hover:bg-[#4A90E2]/10',
    playing: 'text-[#4A90E2]',
  },
  routineBlue: {
    selOn: 'bg-brand-blue text-white',
    selOffHover: 'text-gray-600 hover:border-brand-blue/40 hover:bg-brand-blue/5',
    playing: 'text-brand-blue',
  },
}

const ORDER_SET = new Set<string>(ROUTINE_ALARM_SOUND_CATEGORY_ORDER)

/** id 가 카탈로그에 있으면 그 카테고리만 씀 — 네트워크/캐시가 category 를 빼먹어도 기타로만 안 묶입니다 */
const CATEGORY_BY_CATALOG_ID = new Map<string, RoutineAlarmSoundCategoryKey>(
  ROUTINE_ALARM_SOUND_CATALOG.map((e) => [e.id, e.category]),
)

function coerceCategory(bucketField: RoutineAlarmSoundCategoryKey | undefined, id: string): RoutineAlarmSoundCategoryKey {
  const fromId = CATEGORY_BY_CATALOG_ID.get(id)
  if (fromId) return fromId
  if (bucketField !== undefined && ORDER_SET.has(bucketField)) return bucketField
  return 'other'
}

function bucketByCategory(sounds: AlarmSoundPickRow[]): Map<RoutineAlarmSoundCategoryKey, AlarmSoundPickRow[]> {
  const map = new Map<RoutineAlarmSoundCategoryKey, AlarmSoundPickRow[]>()
  for (const k of ROUTINE_ALARM_SOUND_CATEGORY_ORDER) map.set(k, [])
  for (const s of sounds) {
    const bucket = coerceCategory(s.category, s.id)
    map.get(bucket)?.push(s)
  }
  return map
}

type Props = {
  sounds: AlarmSoundPickRow[]
  selectedId: string
  onSelect: (id: string) => void
  onPreview: (url: string, id: string) => void
  onStop: () => void
  playingId: string | null
  accent: Accent
  /** 스크롤 영역 최대 높이(Tailwind) */
  listMaxHeightClass?: string
  /**
   * 온보딩 「초기 루틴 설정」알람 팝업용 — 기상·등원·취침·기타 블록을 카드처럼 나눠 한눈에 들어오게 합니다.
   * (부모 루틴 설정 시트는 기본값 false 로 더 컴팩트하게 유지합니다.)
   */
  emphasizeCategoryBlocks?: boolean
}

export default function RoutineAlarmSoundToggleList({
  sounds,
  selectedId,
  onSelect,
  onPreview,
  onStop,
  playingId,
  accent,
  listMaxHeightClass = 'max-h-40',
  emphasizeCategoryBlocks = false,
}: Props) {
  const tones = ACCENTS[accent]

  /** 부모/온보딩 레벨에서는 이미 카탈로그로 거르지만, 캐시된 옛 API·예외 경로 대비 표시 단계에서 한 번 더 고정합니다. */
  const list = mergeRoutineAlarmPickListFromApi(sounds)

  if (!list.length) {
    return (
      <p className="rounded-lg bg-gray-50 px-2 py-2 text-[10px] leading-snug text-gray-500">
        알람 음원 목록을 불러오는 중이거나 폴더가 비어 있어요.
      </p>
    )
  }

  const buckets = bucketByCategory(list)

  return (
    <div
      className={`overflow-y-auto py-0.5 ${emphasizeCategoryBlocks ? 'space-y-3' : 'space-y-2.5'} ${listMaxHeightClass}`}
    >
      {ROUTINE_ALARM_SOUND_CATEGORY_ORDER.map((cat) => {
        const sectionItems = buckets.get(cat) ?? []
        if (!sectionItems.length) return null
        const title = ROUTINE_ALARM_SOUND_CATEGORY_LABELS_KO[cat]
        const sectionCls = emphasizeCategoryBlocks
          ? 'min-w-0 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5'
          : 'min-w-0'
        const headingCls = emphasizeCategoryBlocks
          ? 'mb-2 border-b border-gray-200/80 pb-1.5 text-xs font-black text-brand-text'
          : 'mb-1 text-[10px] font-black text-gray-500'
        return (
          <section
            key={cat}
            className={sectionCls}
            role="group"
            aria-labelledby={`alarm-sound-cat-${cat}`}
          >
            <p id={`alarm-sound-cat-${cat}`} className={headingCls}>
              {title}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sectionItems.map((s) => {
                const on = selectedId === s.id
                const isPlayingThis = playingId === s.id
                return (
                  <div
                    key={s.id}
                    className="inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-full border border-gray-200 bg-white pl-1 pr-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      className={[
                        'min-w-0 max-w-[10rem] truncate rounded-full px-2 py-1 text-[10px] font-bold transition-all',
                        on ? tones.selOn : tones.selOffHover,
                      ].join(' ')}
                    >
                      {s.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => onPreview(s.url, s.id)}
                      className={[
                        'shrink-0 rounded-full p-1 text-[10px] transition-colors',
                        isPlayingThis ? tones.playing : 'text-gray-400 active:opacity-80',
                      ].join(' ')}
                      aria-label={`${s.label} 미리듣기`}
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      onClick={onStop}
                      disabled={!playingId}
                      className="shrink-0 rounded-full p-1 text-[10px] text-gray-500 transition-colors enabled:hover:text-rose-600 enabled:active:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="미리듣기 정지"
                    >
                      ■
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
