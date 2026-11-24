/**
 * Convert an annotation in PDF page coordinates to a CSS overlay rectangle.
 *
 * PDF.js PageViewport supports convertToViewportPoint(x, y), not
 * convertToViewportRectangle([x1, y1, x2, y2]).  Transform opposite corners
 * through the supported API and normalize their screen coordinates.
 * This also works for pages rotated in 90-degree increments.
 */
export function annotationViewportBounds(annotation, viewport, scale) {
  if (annotation.type === 'text') {
    const [left, baseline] = viewport.convertToViewportPoint(annotation.x, annotation.y);
    return { left, top: baseline - annotation.size * scale, width: null, height: null };
  }

  const [x1, y1] = viewport.convertToViewportPoint(annotation.x, annotation.y);
  const [x2, y2] = viewport.convertToViewportPoint(
    annotation.x + annotation.w,
    annotation.y + annotation.h,
  );

  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}
