# 리팩토링 진행 현황

> 변경이 생길 때마다 이 파일 맨 위에 한 줄씩 추가한다. 여기만 보면 "무엇이 바뀌었는지" 알 수 있다.

## 변경 내용 보는 법 (1인 개발자용)

- **전체 변경 한눈에**: GitHub에서 아래 비교 링크를 연다 (백업 `main` 대비 작업 브랜치의 모든 차이).
  <https://github.com/happia1/COOANC/compare/main...claude/vigilant-bell-ykh6g2>
- **터미널에서**: `git fetch origin && git diff --stat origin/main...origin/claude/vigilant-bell-ykh6g2`
- **이 문서**: 단계별 요약과 "사용자 확인 필요" 항목

## 규칙

1. 작업 브랜치는 `claude/vigilant-bell-ykh6g2` 하나만 쓴다. 브랜치를 늘리지 않는다.
2. 삭제·구조 변경은 목록으로 먼저 보여주고 승인받은 뒤에 한다.
3. 단계 하나가 끝나면 커밋 한 개, 이 문서에 한 줄 추가.
4. `main`은 사용자가 직접 병합하기 전까지 건드리지 않는다.

## 단계

| 단계 | 상태 | 산출물 |
|---|---|---|
| 0. 백업 | 완료 | [BACKUP.md](BACKUP.md) |
| 1. 지침 정리 | 완료 | `CLAUDE.md`, `AI_INSTRUCTIONS.md` |
| 2. 분석·진단 | 진행 중 | `DIAGNOSIS.md` |
| 3. 설계 | 대기 (사용자와 논의 후) | |
| 4. 리팩토링 | 대기 | |
| 5. 문서 갱신 | 대기 | |

## 로그 (최신이 위)

- 2026-11-16 백업 안내 작성, 지침 정리, 진단 시작. 코드 변경 없음.
