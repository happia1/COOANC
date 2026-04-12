/**
 * 경제 EQ 피드백·코칭 가이드 — **플레이스홀더(더미) 문구 생성**
 *
 * 나중에 AI 엔지니어가 붙일 때:
 * - 이 파일의 함수 본문을 **API 호출(RAG + 내부 지표)** 로 교체하거나,
 * - 동일 시그니처를 유지한 채 서버 액션/Edge Function에서 문자열만 내려주면 됩니다.
 * - 입력으로 `child_stats` 요약, 이번 주(월~일) 루틴, 성장 단계 이름 등을 넘기면
 *   모델이 부모·자녀 상황에 맞는 문장을 생성하기 좋습니다.
 */
import type { ChildStats } from '@/types/database'
import type { WeeklyRoutineDay } from '@/lib/childWeeklyRoutine'

export type EqInsightInput = {
  stats: Pick<ChildStats, 'eq_routine_rate' | 'eq_delay_score' | 'eq_save_ratio' | 'streak_days' | 'credits'>
  /** 화면에 쓰는 성장 단계 한글 이름 (예: 씨앗, 새싹) */
  growthStageName: string
  /** 자녀 이름 (문장 안에서 호칭용) */
  childName: string
  weeklyRoutine: WeeklyRoutineDay[]
}

/**
 * 차트 아래에 들어가는 「데이터 기반 피드백」 한 덩어리.
 * 실서비스에서는 미션 로그·크레딧 흐름·또래 통계 등과 함께 LLM이 생성합니다.
 */
export function buildPlaceholderEqDataFeedback(input: EqInsightInput): string {
  const { stats, growthStageName, childName, weeklyRoutine } = input
  const doneDays = weeklyRoutine.filter((d) => d.hasMissions && d.ratePercent >= 80).length
  const missDays = weeklyRoutine.filter((d) => d.hasMissions && d.ratePercent < 40).length

  const routineHint =
    missDays >= 2
      ? `최근 일주일 중 완주가 어려웠던 날이 ${missDays}일 있었어요. 부모님과 함께 「하루에 미션 개수」나 시간대를 조정해 보면 좋아요.`
      : doneDays >= 5
        ? `일주일 중 ${doneDays}일 이상 루틴을 잘 지켰어요. 꾸준함이 경제 습관의 기초가 됩니다.`
        : `루틴 완주율은 ${stats.eq_routine_rate}%예요. 조금씩이라도 매일 이어가면 지수가 함께 올라갑니다.`

  const delayHint =
    stats.eq_delay_score >= 60
      ? `만족 지연 지수가 ${stats.eq_delay_score}%로, 총 크레딧 중 저금통에 모아 둔 비율이 높아요.`
      : `만족 지연 지수는 ${stats.eq_delay_score}%예요. 미션 보상을 돈바구니에만 두지 말고 저금통으로 옮기면 이 수치가 올라가요.`

  const saveHint =
    stats.eq_save_ratio >= 50
      ? `저축 비중이 ${stats.eq_save_ratio}%로, 지갑과 저금통에 나눈 돈 중 저금통 쪽이 큽니다.`
      : `저축 비중은 ${stats.eq_save_ratio}%예요. 지갑·저금통으로 나누기(돈바구니에만 두지 않기)를 함께 연습해 보면 좋아요.`

  // 화면에서는 `whitespace-pre-wrap` 으로 줄바꿈이 보이도록 `\n` 으로 구간을 나눕니다.
  return [
    `${childName} 님은 지금 「${growthStageName}」 단계예요.`,
    '',
    routineHint,
    '',
    delayHint,
    '',
    saveHint,
    '',
    `(연속 ${stats.streak_days}일 · 크레딧 ${stats.credits.toLocaleString()})`,
    '— AI 연동 전 임시 요약입니다.',
  ].join('\n')
}

/**
 * 「경제 습관 코칭 가이드」 카드용 — 부모가 집에서 쓸 말투·행동 제안.
 * RAG를 붙일 때는 내부 문서(연령별 가이드, 개념 태그별 팁)를 검색해 합성하면 됩니다.
 */
export function buildPlaceholderCoachingGuide(input: EqInsightInput): string {
  const { stats, growthStageName, childName } = input

  return [
    `「${childName}야, ${growthStageName} 단계에서 이렇게 해보자」는 식으로 가볍게 시작해 보세요.`,
    '',
    `지금 수치를 보면 만족 지연 ${stats.eq_delay_score}%, 저축 비중 ${stats.eq_save_ratio}%예요.`,
    '',
    '구체적으로 한 가지 행동만 골라 칭찬하세요.',
    '예: “오늘은 사고 싶은 걸 바로 쓰지 않고 적어 둔 거 정말 대단해.”',
    '같은 문장은 아이의 자기조절을 긍정적으로 고정시킵니다.',
    '',
    '이 단락은 RAG·LLM 연동 전 템플릿이며, 나중에 자녀 연령·기관 유형·미션 태그에 맞는 문서를 검색해 바꿔 끼우면 됩니다.',
  ].join('\n')
}
