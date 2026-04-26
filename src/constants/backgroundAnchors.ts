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
 * 이미지 원본: 858 × 968px (tablet_kidsroom_background_portrait.png)
 */
export const BACKGROUND_ANCHORS = {
  kids_background: {
    /**
     * 러그 좌우 중심 X 비율(캐릭터 `left%`).
     * 배경 `imageObjectPositionX` 조정에 맞춰 함께 사용합니다.
     * 42%·0.495 기준에서 가로 2%p 오른쪽(→44)에 맞춤.
     */
    rugCenterX: 0.501,
    /**
     * 풀블리드 배경 `object-position` x(%)—50=중앙, 44=42에서 반대(오른쪽)으로 2%p.
     */
    imageObjectPositionX: 44,
    /** 러그 상하 중심 Y 비율 */
    rugCenterY: 0.470,
    /** 캐릭터 발이 닿는 Y 비율 */
    characterFootY: 0.530,
    /** 배경 높이의 몇 배로 캐릭터를 그릴지 (기존 0.187의 1.5배) */
    characterScale: 0.28,
  },
} as const
