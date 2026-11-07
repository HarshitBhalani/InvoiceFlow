// Where to put a tooltip so it is always fully visible. Pure maths (no DOM), so it can be tested on its own.
// Only erasable TypeScript syntax is used on purpose, so Node can run this file directly in tests.

export type Anchor = { x: number; top: number; bottom: number }; // the element's horizontal centre, top and bottom edge
export type Size = { w: number; h: number };

export type Rect = { left: number; top: number; right: number; bottom: number };

// Where to put the tour card next to a highlighted element: to its right if it fits, otherwise below, otherwise
// above, otherwise centred. It always stays inside the screen and never covers the element it points at.
export function placePopover(anchor: Rect | null, size: Size, vp: { w: number; h: number }, margin = 12, gap = 14) {
  const clampX = (x: number) => Math.min(Math.max(x, margin), Math.max(margin, vp.w - margin - size.w));
  const clampY = (y: number) => Math.min(Math.max(y, margin), Math.max(margin, vp.h - margin - size.h));
  const centre = () => ({ left: clampX((vp.w - size.w) / 2), top: clampY((vp.h - size.h) / 2), side: "center" as const });

  if (!anchor) return centre();
  const cx = (anchor.left + anchor.right) / 2;
  const cy = (anchor.top + anchor.bottom) / 2;

  if (anchor.right + gap + size.w <= vp.w - margin) {
    return { left: anchor.right + gap, top: clampY(cy - size.h / 2), side: "right" as const };
  }
  if (anchor.bottom + gap + size.h <= vp.h - margin) {
    return { left: clampX(cx - size.w / 2), top: anchor.bottom + gap, side: "below" as const };
  }
  if (anchor.top - gap - size.h >= margin) {
    return { left: clampX(cx - size.w / 2), top: anchor.top - gap - size.h, side: "above" as const };
  }
  return centre();
}

export function placeTooltip(anchor: Anchor, size: Size, viewportWidth: number, margin = 8, gap = 8) {
  // Not enough room above the element (for example buttons in the top bar): open underneath instead
  const below = anchor.top < size.h + gap + margin;
  // Centred on the element, but never past either side of the screen
  const maxLeft = Math.max(margin, viewportWidth - margin - size.w);
  const left = Math.min(Math.max(anchor.x - size.w / 2, margin), maxLeft);
  const top = below ? anchor.bottom + gap : anchor.top - gap - size.h;
  return { left, top, below };
}
