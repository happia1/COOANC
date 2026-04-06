import { MISSION_ROUTINES_ATLAS } from '@/constants/missionRoutineAtlas'

/**
 * `routines_01` 아틀라스에 없을 때 쓰는 기본 썸네일(실내 놀이).
 * 미션 제목을 키워드로 매칭해 `SpriteImage` 의 `frame` 문자열을 고릅니다.
 */
const DEFAULT_FRAME = 'play_inside'

/**
 * 미션 제목(및 선택적 설명)을 보고 `missions/routines_01.png` 아틀라스의 프레임 이름을 고릅니다.
 * - 한글·영문 키워드를 섞어 두었고, 안 맞으면 `DEFAULT_FRAME` 입니다.
 * - 부모가 만든 제목이 다양해도 비슷한 그림이 나오도록 순서가 **구체적인 규칙이 위**입니다.
 */
export function missionRoutineIconFrame(title: string, description?: string | null): string {
  const raw = `${title} ${description ?? ''}`.trim()
  if (!raw) return pick(DEFAULT_FRAME)

  const t = raw.toLowerCase()
  const ko = raw

  const tryPick = (frame: string) => pick(frame)

  if (/기상|일어나|깨우|wake|alarm/i.test(ko) || /\bwake\b/i.test(t)) return tryPick('alarm')
  if (/양치|칫솔|brushing|brush\s*teeth/i.test(ko)) return tryPick('brush_teeth')
  if (/세수|세안|wash\s*face|face\s*wash/i.test(ko)) return tryPick('wash_hand')
  if (/손\s*씻|손씻|hand\s*wash/i.test(ko)) return tryPick('wash_hand')
  if (/샤워/i.test(ko) || /\bshower\b/i.test(t)) return tryPick('shower')
  if (/목욕|반신욕|bath/i.test(ko)) return tryPick('bath')
  if (/파자마|잠옷|pajama/i.test(ko)) return tryPick('pajama')
  if (/아침\s*식|아침밥|breakfast/i.test(ko)) return tryPick('breakfase')
  if (/저녁\s*식|저녁밥|dinner/i.test(ko)) return tryPick('dinner')
  if (/점심|lunch/i.test(ko)) return tryPick('chicken')
  if (/물\s*마시|물마시|drink\s*water|drinking/i.test(ko)) return tryPick('dringking')
  if (/물\s*따|정수기/i.test(ko)) return tryPick('water')
  if (/숙제|공부|homework/i.test(ko)) return tryPick('homework')
  if (/독서|책\s*읽|reading|story/i.test(ko)) return tryPick('reading_book')
  if (/도서관|picture\s*book|그림책/i.test(ko)) return tryPick('book')
  if (/장난감.*정리|정리.*장난감/i.test(ko)) return tryPick('organize_toys')
  if (/옷.*정리|정리.*옷|옷장/i.test(ko)) return tryPick('organize_cloth')
  if (/빨래|세탁|laundry|loundry/i.test(ko)) return tryPick('loundry')
  if (/갈아입|옷\s*갈이|옷\s*입/i.test(ko)) return tryPick('change')
  if (/요가|스트레칭|yoga/i.test(ko)) return tryPick('yoga')
  if (/실내.*놀이|놀이.*실내/i.test(ko)) return tryPick('play_inside')
  if (/바깥|야외|밖에서|play\s*outside|outside/i.test(ko)) return tryPick('play_outside')
  if (/모래|모래놀이/i.test(ko)) return tryPick('play_sand')
  if (/잘\s*먹|밥\s*잘|먹기|eat\s*well/i.test(ko)) return tryPick('eat_well')

  return tryPick(DEFAULT_FRAME)
}

function pick(frame: string): string {
  return frame in MISSION_ROUTINES_ATLAS.frames ? frame : DEFAULT_FRAME
}
