/**
 * GoTrue 브라우저 클라이언트는 IndexedDB/Web Lock 로 세션 저장소를 보호합니다.
 * 같은 탭에서 `getSession`·`getUser`·`signIn…` 등이 거의 동시에 돌면 「락을 다른 요청이 가져갔다」처럼
 * 거부(rejection)가 나고, 내부에서 `unhandledRejection` 까지 이어질 수 있습니다.
 *
 * 비개발자: 「로그인 정보 읽기·쓰기」를 **한 줄로 세워서** 한 번에 한 작업만 하게 합니다.
 */

let tail: Promise<unknown> = Promise.resolve()

/** 브라우저에서 Supabase Auth 관련 호출만 직렬로 실행합니다(`from()` 조회는 여기 포함하지 않음). */
export function runSerializedBrowserAuthOp<T>(op: () => Promise<T>): Promise<T> {
  const result = tail.then(op)
  tail = result.then(() => undefined, () => undefined)
  return result
}
