/**
 * 온보딩(RoutineOnboarding)에서 미션 description 에 넣는 알람 메타 JSON 과 동일 형식입니다.
 * v1: { v: 1, alarmFile: "파일명" } — 재생 시 `/assets/audio/alarm/` 경로와 조합
 */

export type AlarmDescriptionV1 = { v: 1; alarmFile: string }

export function parseAlarmFromMissionDescription(description: string | null | undefined): {
  alarmFile: string | null
} {
  if (!description?.trim()) return { alarmFile: null }
  try {
    const j = JSON.parse(description) as unknown
    if (j && typeof j === 'object' && (j as AlarmDescriptionV1).v === 1) {
      const f = (j as AlarmDescriptionV1).alarmFile
      if (typeof f === 'string' && f.trim()) return { alarmFile: f.trim() }
    }
  } catch {
    /* JSON 아님 */
  }
  return { alarmFile: null }
}

/** 알람 파일명만 저장하는 description 문자열 (없으면 null) */
export function buildAlarmDescription(alarmFile: string | null | undefined): string | null {
  if (!alarmFile?.trim()) return null
  const payload: AlarmDescriptionV1 = { v: 1, alarmFile: alarmFile.trim() }
  return JSON.stringify(payload)
}

/** 알림이 켜져 있다고 볼 조건: 시각이 있거나 알람 파일이 지정됨 */
export function missionHasAlarmCue(m: {
  scheduled_time: string | null
  description: string | null
}): boolean {
  if (m.scheduled_time && /^\d{2}:\d{2}$/.test(m.scheduled_time)) return true
  return parseAlarmFromMissionDescription(m.description).alarmFile != null
}

/**
 * 미션 scheduled_time(HH:MM)을 루틴 탭과 같은 한글 시각 문구로 바꿉니다.
 * 유효하지 않거나 없으면 빈 문자열을 돌려줍니다.
 */
export function formatScheduleHHMMKo(t: string | null | undefined): string {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const period = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${period} ${h12}:${m}`
}
