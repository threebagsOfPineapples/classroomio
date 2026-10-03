type ReadingBounds = { top: number; bottom: number; left: number; right: number };
type ReadingClip = ReadingBounds & { horizontal: boolean; vertical: boolean };

export function getVisibleReadingBounds(
  surface: ReadingBounds,
  viewport: ReadingBounds,
  clips: ReadingClip[] = []
): ReadingBounds | null {
  const visible = {
    top: Math.max(surface.top, viewport.top),
    bottom: Math.min(surface.bottom, viewport.bottom),
    left: Math.max(surface.left, viewport.left),
    right: Math.min(surface.right, viewport.right)
  };

  for (const clip of clips) {
    if (clip.vertical) {
      visible.top = Math.max(visible.top, clip.top);
      visible.bottom = Math.min(visible.bottom, clip.bottom);
    }
    if (clip.horizontal) {
      visible.left = Math.max(visible.left, clip.left);
      visible.right = Math.min(visible.right, clip.right);
    }
  }

  const surfaceHeight = surface.bottom - surface.top;
  const surfaceWidth = surface.right - surface.left;
  if (
    surfaceHeight <= 0 ||
    surfaceWidth <= 0 ||
    visible.bottom - visible.top < Math.min(40, surfaceHeight) ||
    visible.right - visible.left < Math.min(120, surfaceWidth)
  )
    return null;

  return visible;
}

export function canRecordReadingActivity(input: {
  visible: boolean;
  focused: boolean;
  editing: boolean;
  hasReadingSurface: boolean;
  lastInteraction: number;
  now: number;
}): boolean {
  return (
    input.visible &&
    input.focused &&
    !input.editing &&
    input.hasReadingSurface &&
    input.lastInteraction > 0 &&
    input.now - input.lastInteraction < 60000
  );
}
