# 백업과 복구 안내

리팩토링 전의 상태는 아래 두 곳에 그대로 보존되어 있다. 리팩토링 중에도 `main`에는 직접 푸시하지 않는다.

| 백업 | 위치 | 내용 |
|---|---|---|
| `main` 브랜치 | GitHub | 리팩토링 전 서비스 코드 전체 (커밋 `874e68b`) |
| 로컬 태그 `backup-pre-refactor-2026-11-16` | 같은 커밋 | 클라우드 세션에서는 태그 푸시가 막혀 있어 로컬에만 있음 |

## 내 컴퓨터에서 확실히 백업하기 (한 번만)

```bash
git fetch origin
git tag backup-pre-refactor-2026-11-16 874e68b
git push origin backup-pre-refactor-2026-11-16
```

## 복구하는 법

- 파일 하나만 되돌리기: `git checkout 874e68b -- src/경로/파일.tsx`
- 전부 되돌리기(새 브랜치로): `git switch -c restore-backup 874e68b`
- 리팩토링 결과가 마음에 들지 않으면: 작업 브랜치를 버리고 `main`을 그대로 쓰면 된다.

## 운영 데이터(DB)

코드 백업과 별개다. 대규모 정리 전에 Supabase 대시보드의 백업(Database → Backups)을 직접 확인한다.
스키마 변경 이력은 `supabase/migrations/`에 있다.
