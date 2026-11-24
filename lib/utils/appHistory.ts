"use client";

/**
 * 이 문서(탭)의 방문 기록이 앱 안에 있는지 판단한다.
 *
 * `router.back()`은 "직전 기록"이 무엇이든 거기로 간다. 앱 안에서 화면을 옮겨
 * 왔다면 그게 우리 화면이지만, 링크·QR·주소 입력으로 특정 화면에 **바로** 들어온
 * 경우 직전 기록은 아예 다른 사이트다. 삼성 인터넷처럼 외부 앱의 링크를 쓰던
 * 탭에 그대로 여는 브라우저에서는 그 상태로 뒤로가기를 누르면 사이트 밖으로
 * 나가 버린다(PC에서는 새 탭이라 뒤로가기가 비활성이어서 증상이 안 보인다).
 *
 * 앱 안에서의 화면 이동은 모두 같은 문서에서 pushState로 일어나므로,
 * **진입 시점의 history.length**를 기준으로 삼으면 그 뒤로 몇 번 움직였는지
 * 알 수 있다. 기준값보다 길어졌다면 뒤로가기는 앱 안에 머문다.
 */

/** 진입 시점의 history.length. 아직 기록하지 않았으면 null. */
let entryLength: number | null = null;

/**
 * 진입 시점의 방문 기록 깊이를 기록한다.
 *
 * 루트 레이아웃에서 문서당 한 번 호출한다(화면 이동보다 반드시 먼저 실행되도록).
 * 같은 값으로 다시 불려도 무해하다 — dev StrictMode의 이펙트 두 번 실행 등.
 */
export function markHistoryEntryPoint(): void {
  if (typeof window === "undefined") return;
  entryLength = window.history.length;
}

/**
 * 진입 후 앱 안에서 화면을 옮긴 적이 있는가 = `router.back()`이 앱 안에 머무는가.
 *
 * 기준값을 아직 기록하지 못했으면 false를 돌려준다. 확실하지 않을 때는
 * 기록에 기대지 않고 상위 화면으로 보내는 쪽이 안전하다.
 */
export function hasInAppHistory(): boolean {
  if (typeof window === "undefined" || entryLength === null) return false;
  return window.history.length > entryLength;
}
