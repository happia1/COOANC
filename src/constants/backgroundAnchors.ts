/**
 * 배경 이미지별 앵커포인트 상수
 *
 * 비개발자 설명:
 * - 각 배경 이미지에서 캐릭터가 서 있을 위치(러그 중심, 발 위치)와 크기 비율을 픽셀 측정값으로 저장합니다.
 * - 이 숫자를 바꾸면 캐릭터가 러그 위 정확한 위치에 서게 됩니다.
 * - rugCenterX / rugCenterY: 러그 중심의 X, Y 비율 (0 = 왼쪽/위, 1 = 오른쪽/아래)
 * - characterFootY: 캐릭터 발이 닿는 Y 비율 (러그 중심보다 위쪽)
 * - characterScale: 배경 높이 대비 캐릭터 높이 비율
 * - imageObjectPositionX: `object-position` x(%)—50이 중앙, 50보다 **크면** 가로 **오른쪽**,
 *   50보다 **작으면** **왼쪽**으로 illust(방·러그)가 살짝 밀어 보이게(크롭) 맞출 때 씁니다.
 *   바꾸면 `rugCenterX` 를 같이 맞춥니다.
 *
 * 이미지 원본: 418 × 537px (kidsroom.png)
 */
export const BACKGROUND_ANCHORS = {
  kids_background: {
    /**
     * 러그 좌우 중심 X 비율(캐릭터 `left%`).
     * kidsroom.png 는 러그가 가로 중앙(≈50%)에 있어 0.50.
     */
    rugCenterX: 0.50,
    /**
     * 풀블리드 배경 `object-position` x(%)—50=중앙. 러그가 중앙이라 50.
     */
    imageObjectPositionX: 50,
    /** 러그 상하 중심 Y 비율 (kidsroom.png 는 러그가 세로 약간 아래 ≈0.54) */
    rugCenterY: 0.54,
    /** 캐릭터 발이 닿는 Y 비율 (러그 앞·중앙) */
    characterFootY: 0.56,
    /** 배경 높이의 몇 배로 캐릭터를 그릴지 */
    characterScale: 0.30,
    /**
     * 화분 UI 가로 앵커(0~1) — 캐릭터 **왼발** 쪽(화면에서 발 왼쪽).
     * 비개발자: 발 높이 근처에 두고 `translate(-50%, …)` 로 가운데를 발 옆에 맞춥니다.
     */
    plantPotBesideLeftFootX: 0.385,
    /**
     * 물조리개 가로 앵커 — 캐릭터 **오른발** 쪽.
     */
    wateringCanBesideRightFootX: 0.615,
  },
} as const
