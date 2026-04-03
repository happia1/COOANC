COOANC 정적 이미지 루트 (Next.js public → URL은 /assets/img/...)

대분류 5개:
  common/      — UI 아이콘, 날짜, 손가락·박수 등
  characters/  — 캐릭터, 모드별 상태, 온보딩
  games/       — 농장·미니게임, 효과, 콘페티, 지도
  items/       — 상점, 돼지저금통, 보상
  layouts/     — 배경, 배너, 미션카드 프레임

각 대분류 폴더 안의 _분류안내.txt 에 하위 폴더 역할이 적혀 있습니다.
실제 파일명은 src/constants/assets.ts 의 상수로만 참조하는 것을 권장합니다.
