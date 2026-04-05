import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

/** 알람 파일 확장자 — 새 포맷 쓰면 여기만 추가하면 됨 */
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|webm)$/i

/**
 * GET /api/assets/alarm-sounds
 * `public/assets/audio/alarm` 폴더를 읽어 목록을 돌려줍니다. 파일만 넣으면 빌드 없이 목록에 잡힙니다.
 */
export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'assets', 'audio', 'alarm')
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

  const sounds = filenames.map((filename) => {
    const base = filename.replace(AUDIO_EXT, '')
    const label = base.replace(/[-_]+/g, ' ').trim() || filename
    return {
      id: filename,
      label,
      url: `/assets/audio/alarm/${encodeURIComponent(filename)}`,
    }
  })

  return NextResponse.json({ sounds })
}
