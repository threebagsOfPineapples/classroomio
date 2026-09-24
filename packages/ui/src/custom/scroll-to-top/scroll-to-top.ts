export const SCROLL_TO_TOP_SHOW_RATIO = 1;
export const SCROLL_TO_TOP_HIDE_RATIO = 0.8;

export function isScrollToTopVisible(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  currentlyVisible: boolean
) {
  if (clientHeight <= 0 || scrollHeight <= clientHeight) return false;

  const ratio = currentlyVisible ? SCROLL_TO_TOP_HIDE_RATIO : SCROLL_TO_TOP_SHOW_RATIO;
  return scrollTop >= clientHeight * ratio;
}
