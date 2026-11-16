# COOANC (쿠앵크) — 프로젝트 지침

4~11세 자녀의 습관 형성을 게이미피케이션으로 돕는 앱. 부모/자녀 모드가 한 Next.js 앱에 있다. 응답은 한국어로, 객관적이고 간결하게. 불확실하면 "확인 불가"라고 쓴다.

## 기술 스택 (package.json 기준)
Next.js 16 (App Router) · React 19 · TypeScript 6 · Tailwind 3 · Supabase (`@supabase/ssr`) · zustand · framer-motion
- 명령: `npm run dev` / `build` / `lint`. 테스트는 `tests/*.test.mjs` (`node --test tests/<파일>`). `*-live-check.mjs`는 실제 서버가 필요한 수동 점검용.
- DB 변경은 `supabase/migrations/`에 새 파일로만 추가한다. 기존 마이그레이션은 수정하지 않는다.

## 작업 원칙
1. **문서 확인**: 작업 전 `docs/00_overview.md`로 문서 지도를 보고, 관련 문서만 읽는다. 핵심 문서(PRD, IA, 디자인 가이드, master_doc)는 2026-08-18 이후 갱신이 안 됐을 수 있으므로 코드와 `dev_log.md`가 더 최신이다. 충돌하면 코드를 기준으로 하고 차이를 보고한다.
2. **분석 먼저**: 요구사항을 받으면 코드를 짜기 전에 구현 전략을 단계별로 제시한다.
3. **최소 파일**: 새 파일을 만들기 전에 기존 파일 확장이 가능한지 확인한다. 중복 로직은 `src/components/shared`나 `src/lib`로 모은다.
4. **보안**: 모든 데이터 접근은 Supabase RLS 기준으로 설계한다. 서비스 롤 키와 민감 정보는 클라이언트에 노출하지 않는다. `.env*`는 커밋하지 않는다.
5. **UI 유지**: 가지고 있는 에셋(`public/`)과 기존 화면 모습은 명시적 요청 없이 바꾸지 않는다.
6. **검증**: 작업 후 `npm run lint`/`build` 결과를 확인하고, 엣지 케이스를 3가지 이상 점검한 뒤 완료라고 말한다. 실행하지 않은 검증을 했다고 쓰지 않는다.
7. **기록**: 작업이 끝나면 `dev_log.md` 형식(`## [날짜] - 제목` + 변경 요약)으로 맨 위에 추가한다.

## 리팩토링 진행 중 (docs/refactor/)
- 백업: `main` + 태그 `backup-pre-refactor-2026-11-16` → `docs/refactor/BACKUP.md`
- 작업은 `claude/vigilant-bell-ykh6g2` 브랜치 하나에서만 한다. `main`에는 푸시하지 않는다.
- **삭제·구조 변경은 목록으로 먼저 보여주고 승인받은 뒤에 한다.**
- 단계가 끝나면 `docs/refactor/PROGRESS.md`에 한 줄 추가하고 커밋한다.
- 설계 선택지가 있거나 UI/동작이 달라질 수 있으면 결정을 사용자에게 묻는다.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
