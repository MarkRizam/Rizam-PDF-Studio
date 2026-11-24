/** Pure utilities for non-destructive cropping and draggable image resizing. */
export const fullCrop = () => ({ x: 0, y: 0, w: 1, h: 1 });
export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
export function normalizedCrop(input) {
  if (!input) return fullCrop();
  const x = clamp(Number(input.x) || 0, 0, 0.99);
  const y = clamp(Number(input.y) || 0, 0, 0.99);
  const w = clamp(Number(input.w) || 1, 0.01, 1 - x);
  const h = clamp(Number(input.h) || 1, 0.01, 1 - y);
  return { x, y, w, h };
}
export function isFullCrop(crop) {
  const c = normalizedCrop(crop);
  return c.x < 0.00001 && c.y < 0.00001 && c.w > 0.99999 && c.h > 0.99999;
}
export function croppedAspectRatio(crop, naturalWidth, naturalHeight) {
  const c = normalizedCrop(crop);
  return (naturalWidth * c.w) / (naturalHeight * c.h);
}
/** Convert existing crop to a centered region of a specified width:height ratio. */
export function centerCropToAspect(crop, width, height, targetAspect) {
  const c = normalizedCrop(crop);
  if (!Number.isFinite(targetAspect) || targetAspect <= 0) return c;
  const boxAspect = croppedAspectRatio(c, width, height);
  if (boxAspect > targetAspect) {
    const w = c.h * targetAspect * height / width;
    return normalizedCrop({ x: c.x + (c.w - w) / 2, y: c.y, w, h: c.h });
  }
  const h = c.w * width / (height * targetAspect);
  return normalizedCrop({ x: c.x, y: c.y + (c.h - h) / 2, w: c.w, h });
}
/** Positioning is in image fractions; crop values never include PDF-space coordinates. */
export function moveCrop(crop, deltaX, deltaY) {
  const c = normalizedCrop(crop);
  return { ...c, x: clamp(c.x + deltaX, 0, 1 - c.w), y: clamp(c.y + deltaY, 0, 1 - c.h) };
}
export function resizeCrop(crop, corner, pointX, pointY, naturalWidth, naturalHeight, aspect = null) {
  const c = normalizedCrop(crop);
  const oppositeX = corner.includes('w') ? c.x + c.w : c.x;
  const oppositeY = corner.includes('n') ? c.y + c.h : c.y;
  const x = clamp(pointX, 0, 1);
  const y = clamp(pointY, 0, 1);
  const maxW = corner.includes('w') ? oppositeX : 1 - oppositeX;
  const maxH = corner.includes('n') ? oppositeY : 1 - oppositeY;
  const dx = corner.includes('w') ? oppositeX - x : x - oppositeX;
  const dy = corner.includes('n') ? oppositeY - y : y - oppositeY;
  let w = clamp(dx, 0.02, maxW);
  let h = clamp(dy, 0.02, maxH);
  if (aspect) {
    const normalizedAspect = aspect * naturalHeight / naturalWidth;
    // Keep the crop inside the image while respecting the chosen aspect ratio.
    if (w / h > normalizedAspect) w = h * normalizedAspect;
    else h = w / normalizedAspect;
    if (w > maxW) { w = maxW; h = w / normalizedAspect; }
    if (h > maxH) { h = maxH; w = h * normalizedAspect; }
    if (w < 0.001 || h < 0.001) return c;
  }
  return normalizedCrop({ x: corner.includes('w') ? oppositeX - w : oppositeX, y: corner.includes('n') ? oppositeY - h : oppositeY, w, h });
}
/** Resize a screen-space box by its handle; the opposite corner stays fixed. */
export function resizeScreenRect(box, corner, dx, dy, lockRatio = true) {
  const anchorX = corner.includes('e') ? box.left : box.left + box.width;
  const anchorY = corner.includes('s') ? box.top : box.top + box.height;
  let w = Math.max(15, box.width + (corner.includes('e') ? dx : -dx));
  let h = Math.max(15, box.height + (corner.includes('s') ? dy : -dy));
  if (lockRatio) {
    const aspect = box.width / box.height;
    if (Math.abs(dx) > Math.abs(dy)) h = w / aspect;
    else w = h * aspect;
  }
  return { left: corner.includes('e') ? anchorX : anchorX - w, top: corner.includes('s') ? anchorY : anchorY - h, width: w, height: h };
}
