import test from 'node:test';
import assert from 'node:assert/strict';
import { annotationViewportBounds } from '../src/geometry.js';

const pageHeight = 842;
const scale = 1.4;
// Mock only the PDF.js viewport API actually exposed to the application.
const unrotatedViewport = {
  convertToViewportPoint(x, y) { return [x * scale, (pageHeight - y) * scale]; },
};
const rotated90Viewport = {
  convertToViewportPoint(x, y) { return [y * scale, x * scale]; },
};
const rotated180Viewport = {
  convertToViewportPoint(x, y) { return [-x * scale, y * scale]; },
};

for (const [name, viewport] of [
  ['unrotated', unrotatedViewport],
  ['rotated 90°', rotated90Viewport],
  ['rotated 180°', rotated180Viewport],
]) {
  test(`Image rectangles use supported PDF.js API: ${name}`, () => {
    const bounds = annotationViewportBounds({type:'image',x:100,y:400,w:85,h:110},viewport,scale);
    assert.ok(Number.isFinite(bounds.left));
    assert.ok(Number.isFinite(bounds.top));
    assert.ok(bounds.width>0);
    assert.ok(bounds.height>0);
    assert.equal(Math.round(bounds.width*bounds.height),Math.round(85*110*scale**2));
  });
}

test('Highlights and cover boxes render even without a nonexistent rectangle API', () => {
  const highlight = annotationViewportBounds({type:'highlight',x:10,y:10,w:40,h:25},unrotatedViewport,scale);
  const cover = annotationViewportBounds({type:'cover',x:10,y:10,w:40,h:25},unrotatedViewport,scale);
  assert.deepEqual(highlight,cover);
  assert.equal(highlight.width,56);
  assert.equal(highlight.height,35);
});

test('Text overlay baseline conversion is unchanged', () => {
  const a=annotationViewportBounds({type:'text',x:100,y:400,size:20},unrotatedViewport,scale);
  assert.equal(a.left,140);
  assert.equal(a.top,(842-400-20)*scale);
  assert.equal(a.width,null);
});
