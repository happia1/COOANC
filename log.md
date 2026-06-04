# 2026-05-29 작업 로그

## 오늘 한 일
- **화분 팝업**: 중앙 화분 + 물조리개, 영양제 UI 제거, 물주기·물방울 연출. 식물 PNG를 `plant/apple/` 등 **종류별 폴더**로 정리.
- **저금통·크레딧**: `credits_available` 모델(107 마이그레이션), 미션 카드 더미·이체 오버레이 등 구 UI 제거, `ChildHomePiggyBank` 중심으로 통합.
- **스페셜 미션**: 머리빗기·이불 정리·가글·로션 칩/썸네일 추가. **기도하기** PNG 경로 `special/pray.png` 수정(108 마이그레이션).

## 커밋/배포
- (이번 push) — 화분·저금통·스페셜 미션 에셋

## 메모
- 화분: `PlantPot.tsx`, `plantTrees.ts` (`getStageImage`)
- 기도하기 이미지: `routineMissionThumbnail.ts` + `108_pray_mission_icon_special_folder.sql`
- DB: `supabase db push` 로 107·108 적용 필요

## 다음에 이어서
- 마이그레이션 적용 후 실기기에서 저금통 이체·화분·스페셜 카드 확인
- lemon/peach 등 추가 나무는 `TREE_LIST`·폴더만 넣으면 확장 가능

# 2026-05-31 작업 로그

## 오늘 한 일
- **부모 ↔ 자녀 화면 전환 UX**: 클릭 직후 루트 전역 오버레이(자녀 키즈룸 / 부모 그라데이션) → `enter-child-ui`·`exit-child-ui` JSON API → `router.push` 로 **이중 새로고침·깜빡임** 제거.
- **자동 로그인**: `/api/auth/post-login-redirect` 로 목적지 1회 결정, `child-entry`·`/` 연쇄 리다이렉트 축소.
- **로딩 UI**: `TabTransitionSkeleton` 통일, 루트 `loading.tsx` null, 나가기/진입 중 중복 스켈레톤 생략.
- **안정성**: `ChildHomeScreenClient` 로 `ChildScreen` chunk 분리; dev `ChunkLoadError` 시 `.next` 재생성 가이드 정리.
- **정리**: 디버그 instrumentation 제거.

## 커밋/배포
- `35b90f9` — `feat(app): 부모-자녀 화면 전환·자동 로그인 경로 UX 개선` (`main` push 완료)

## 메모
- 전환 상태·오버레이: `src/components/child/ChildEnterTransitionProvider.tsx`
- 진입 링크: `ParentEnterChildUiLink.tsx` / 나가기: `ChildScreen.tsx` + `ParentExitTransitionEnd.tsx`
- 로그인 후 분기: `resolvePostLoginRedirect.ts`, `pickPostLoginNavigationTarget.ts`
- dev 서버 **실행 중**에는 `.next` 폴더 삭제하지 말 것 (webpack 캐시 손상 → ChunkLoadError)

## 다음에 이어서
- Vercel·실기기에서 전환·자동 로그인 최종 확인
- 필요 시 Supabase 플랜/쿼리 부하 점검

# 2026-06-03 작업 로그

## 오늘 한 일
- **부모 캘린더**: 일정 삭제 후 새로고침 시 복원되던 문제 수정(tombstone API), 「이번 달 일정」 기본 펼침.
- **부모 미션 탭**: 모바일 드래그앤드롭·텍스트 선택 개선(`TouchSensor` 250ms), Vercel `SyntheticListenerMap` 타입 오류 수정.
- **미션명**: `숙제하기` → `숙제·공부하기` (`110_homework_study_mission_title.sql`).
- **그림일기 DiaryModal** (캐릭터 터치 진입):
  - `EmotionCardLockedModal` 삭제 → `DiaryModal`로 통합.
  - 전체화면 → **슬라이드 팝업**(모바일 하단 시트 / 데스크톱 우측 패널).
  - 스케치 레이아웃: 테두리 밖 **날짜·날씨**, 안쪽 **오늘 기분이 어때?** + **그리기·사진 영역**, 하단 **음성·녹음·이미지** 한 줄.
  - 모바일 프로필 **2:8** 분할, 흰색 그림일기장 배경, 상단 × 버튼 제거.
  - **바깥 터치·스와이프**로 닫기(핸들/프로필 아래·데스크톱 왼쪽 가장자리).
  - 팝업 전체 **Phase1 잠금 오버레이**(`🔒 정식 앱버전 반영 예정`).
  - 배경 PNG 404 시 빈 화면 방지: `src/lib/diaryBackground.ts` probe·캐시.
  - `ChildHomeScreenClient` chunk 로드 실패 시 재시도·1회 새로고침.
- **DB**: `supabase/migrations/010_emotion_diary.sql` 추가(감정일기 스키마, Phase2용).

## 커밋/배포
- `4a39995` — 캘린더 삭제·미션 DnD·숙제·공부하기
- `ec1e136` — dnd-kit 타입 빌드 수정
- `7a0b739` — 감정카드 잠금 팝업(이후 DiaryModal로 대체됨)
- `01ece67` — **그림일기 DiaryModal 슬라이드 팝업 및 UI 통합** (`main` push 완료)

## 메모
- 핵심 파일: `DiaryModal.tsx`, `CalendarViewModal.tsx`, `ChildScreen.tsx`, `diaryBackground.ts`, `emotionDiary.ts`, `types/diaryModal.ts`
- 배경 에셋 `public/assets/diary/diary_open.png` 는 **아직 없음** → fallback 분할 배경 + 흰색 패널 사용
- 달력 보기: `CalendarViewModal` (더미 감정 데이터 fallback)
- dev `ChunkLoadError` 시: dev 서버 재시작 또는 `.next` 삭제 후 `npm run dev`

## 다음에 이어서
- `010_emotion_diary.sql` Supabase 적용(`db push`)
- Phase2: 감정·날씨·그림일기 DB 저장, 캔버스·사진·음성 입력 실제 연동
- `diary_open.png` 디자인 에셋 반영 및 잠금 오버레이 제거(Lv.10 등 조건 확정 후)
