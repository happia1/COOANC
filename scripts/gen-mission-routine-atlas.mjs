import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const j = JSON.parse(
  fs.readFileSync(path.join(root, 'public/assets/img/missions/routines_01.json'), 'utf8'),
)
const frames = {}
for (const [k, v] of Object.entries(j.frames)) {
  const key = k.replace(/\.png$/i, '')
  frames[key] = {
    x: v.frame.x,
    y: v.frame.y,
    w: v.frame.w,
    h: v.frame.h,
    rotated: v.rotated,
  }
}
const meta = j.meta
const sheet = {
  image: 'missions/' + meta.image,
  atlasW: meta.size.w,
  atlasH: meta.size.h,
  frames,
}
const out =
  "import type { SpriteSheet } from '@/constants/sprites'\n\n" +
  '/**\n' +
  ' * TexturePacker `routines_01` — 자녀 미션 카드 썸네일용.\n' +
  ' * `scripts/gen-mission-routine-atlas.mjs` 로 `routines_01.json` 에서 재생성.\n' +
  ' */\n' +
  'export const MISSION_ROUTINES_ATLAS: SpriteSheet = ' +
  JSON.stringify(sheet, null, 2) +
  '\n'
fs.writeFileSync(path.join(root, 'src/constants/missionRoutineAtlas.ts'), out)
console.log('wrote missionRoutineAtlas.ts', Object.keys(frames).length, 'frames')
