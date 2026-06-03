/**
 * 감정 그림일기 — emotion_diary 테이블 타입·조회·UI 더미
 * (마이그레이션 `010_emotion_diary.sql` 적용 전에는 더미로 달력 UI 확인)
 */

import { createClient } from '@/lib/supabase/client'
import { getSeoulDateString } from '@/lib/koreaDate'

export type EmotionDiaryRow = {
  id: string
  child_id: string
  diary_date: string
  face_id: string
  shape_id: string | null
  color_hex: string
}

/** 달력 UI 확인용 더미 (실제 DB 없을 때) */
export function buildEmotionDiaryDummyEntries(childId: string, baseDate = getSeoulDateString()): EmotionDiaryRow[] {
  const [y, m] = baseDate.split('-')
  const ym = `${y}-${m}`
  return [
    {
      id: 'dummy-1',
      child_id: childId,
      diary_date: `${ym}-01`,
      face_id: 'happy',
      shape_id: 'circle',
      color_hex: '#FBBF24',
    },
    {
      id: 'dummy-2',
      child_id: childId,
      diary_date: `${ym}-08`,
      face_id: 'calm',
      shape_id: 'heart',
      color_hex: '#A78BFA',
    },
    {
      id: 'dummy-3',
      child_id: childId,
      diary_date: `${ym}-15`,
      face_id: 'excited',
      shape_id: 'star',
      color_hex: '#F472B6',
    },
  ]
}

const FACE_EMOJI: Record<string, string> = {
  happy: '😊',
  calm: '😌',
  excited: '🤩',
  sad: '😢',
  angry: '😤',
}

export function emotionFaceEmoji(faceId: string): string {
  return FACE_EMOJI[faceId] ?? '🙂'
}

/** 해당 월(서울) emotion_diary — 테이블 없으면 더미 반환 */
export async function fetchEmotionDiaryForMonth(
  childId: string,
  year: number,
  monthIndex: number,
): Promise<EmotionDiaryRow[]> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(monthIndex + 1)}-01`
  const lastD = new Date(year, monthIndex + 1, 0).getDate()
  const end = `${year}-${pad(monthIndex + 1)}-${pad(lastD)}`

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('emotion_diary')
      .select('id, child_id, diary_date, face_id, shape_id, color_hex')
      .eq('child_id', childId)
      .gte('diary_date', start)
      .lte('diary_date', end)

    if (error || !data || data.length === 0) {
      return buildEmotionDiaryDummyEntries(childId, start).filter((e) => e.diary_date >= start && e.diary_date <= end)
    }

    return (data as EmotionDiaryRow[]).map((row) => ({
      ...row,
      diary_date: String(row.diary_date).slice(0, 10),
      color_hex: row.color_hex || '#E5E7EB',
    }))
  } catch {
    return buildEmotionDiaryDummyEntries(childId, start).filter((e) => e.diary_date >= start && e.diary_date <= end)
  }
}
