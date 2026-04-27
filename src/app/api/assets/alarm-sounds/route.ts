import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { ROUTINE_ALARM_SOUND_CATALOG } from '@/lib/routineAlarmSounds'

/** 알람 파일 확장자 — 새 포맷 쓰면 여기만 추가하면 됨 */
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|webm)$/i

type SoundItem = { id: string; label: string; url: string }

/** 같은 실제 파일인지 비교하기 위해 경로·이름을 한 가지 형태로 맞춥니다(인코딩 차이 흡수). */
function normalizeAssetAudioUrl(url: string): string {
  if (!url.startsWith('/assets/audio/')) return url
  const parts = url.split('/').filter(Boolean)
  const fname = parts[parts.length - 1] ?? ''
  const sub = parts[parts.length - 2] ?? ''
  try {
    return `/assets/audio/${sub}/${decodeURIComponent(fname)}`
  } catch {
    return url
  }
}

/**
 * 한 폴더(`alarm` | `alerts`)를 읽어 API용 SoundItem 목록으로 만듭니다.
 * 비개발자용: `public` 아래 해당 폴더에 음원 파일만 넣으면 목록에 잡힙니다.
 */
function soundsFromPublicSubdir(subdir: 'alarm' | 'alerts'): SoundItem[] {
  const dir = path.join(process.cwd(), 'public', 'assets', 'audio', subdir)
  let filenames: string[] = []
  try {
    filenames = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && AUDIO_EXT.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, 'ko'))
  } catch {
    filenames = []
  }
  return filenames.map((filename) => {
    const base = filename.replace(AUDIO_EXT, '')
    const label = base.replace(/[-_]+/g, ' ').trim() || filename
    return {
      id: filename,
      label,
      url: `/assets/audio/${subdir}/${encodeURIComponent(filename)}`,
    }
  })
}

/**
 * GET /api/assets/alarm-sounds
 * - 고정 카탈로그(한글 라벨·안정 id)를 먼저 두고,
 * - `alarm`·`alerts` 폴더에만 있고 카탈로그에 없는 파일은 뒤에 이어 붙입니다.
 */
export async function GET() {
  const catalogNormUrls = new Set(ROUTINE_ALARM_SOUND_CATALOG.map((s) => normalizeAssetAudioUrl(s.url)))
  const catalogIds = new Set(ROUTINE_ALARM_SOUND_CATALOG.map((s) => s.id))

  const disk = [...soundsFromPublicSubdir('alarm'), ...soundsFromPublicSubdir('alerts')]
  const extras = disk.filter(
    (d) => !catalogNormUrls.has(normalizeAssetAudioUrl(d.url)) && !catalogIds.has(d.id),
  )

  const sounds: SoundItem[] = [...ROUTINE_ALARM_SOUND_CATALOG, ...extras]
  return NextResponse.json({ sounds })
}
