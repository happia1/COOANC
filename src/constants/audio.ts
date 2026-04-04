// Auto-generated from public/assets/audio/ directory scan
// All paths are relative to /assets/audio/

const BASE = '/assets/audio'

export const AUDIO = {
  /** 알람 사운드 - 아침 기상 알람 */
  ALARM: {
    MORNING_ALARM_ROOSTER: `${BASE}/alarm/morning_alarm-rooster.wav`,
    MORNING_ALARM_BIRDS:   `${BASE}/alarm/morning_alarm_birds.wav`,
  },

  /** 알림 효과음 - 경고/거절 반응 */
  ALERTS: {
    TICK_TOCK_TIMER: `${BASE}/alerts/alarm-tick-tock-clock-timer-1045.wav`,
    CARTOON_NO:      `${BASE}/alerts/cartoon-girl-saying-no-no-no-2257.wav`,
  },

  /** 캐릭터 사운드 - 동물 캐릭터 반응음 */
  CHARACTER: {
    PUPPY_BARK:       `${BASE}/character_sound/happy-puppy-barks-741.wav`,
    KITTY_HUNGRY:     `${BASE}/character_sound/hungry_kitty-begging-meow-92.wav`,
    KITTY_SWEET_MEOW: `${BASE}/character_sound/mixkit-sweet-kitty-meow-93.wav`,
  },

  /** 카운트다운 - 타이머/미션 제한시간 */
  COUNTDOWN: {
    HAPPY_COUNTDOWN: `${BASE}/countdown/alarm-children-happy-countdown-923.wav`,
  },

  /** 효과음 - 보상/레벨업/알림 */
  EFFECTS: {
    HEART_REWARD: `${BASE}/effects/heart_reward-cartoon-friendly-kiss-2194.wav`,
    LEVEL_UP:     `${BASE}/effects/level_up-magic-festive-melody-2986.wav`,
    NOTICE_POP:   `${BASE}/effects/notice-long-pop-2358.wav`,
    STAR_POP:     `${BASE}/effects/star-pop-click-2364.wav`,
  },

  /** 미션 사운드 - 뱃지 획득/미션 성공 */
  MISSIONS: {
    GET_BADGE:      `${BASE}/missions/get_badge-christmas-reveal-tones-2988.wav`,
    SUCCESS_REWARD: `${BASE}/missions/success_reward-fairy-arcade-sparkle-866.wav`,
  },
} as const

export type AudioSrc = string
