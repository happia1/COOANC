/**
 * 루틴 칩/온보딩이 heart_reward: 0 으로 넣은 미션을 1로 맞춥니다.
 * - 스키마(005) 기본값은 1이며, 완료 API는 이 값을 child_stats.hearts 에 더합니다.
 * - 0이면 자녀 홈 「오늘의 미션」카드에 애정 하트가 0으로만 보이는 문제가 있었습니다.
 *
 * 주의: 의도적으로 0을 둔 미션이 있다면 부모 루틴 탭에서 다시 조정할 수 있습니다.
 */
update public.missions
set heart_reward = 1
where heart_reward = 0;
