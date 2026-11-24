import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fullCrop, normalizedCrop, isFullCrop, centerCropToAspect, croppedAspectRatio, moveCrop, resizeCrop, resizeScreenRect } from '../src/image-edit.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<0.00001,`Expected ${a} ~ ${b}`);
test('new image starts uncropped',()=>{assert.ok(isFullCrop(fullCrop()));});
test('normalization does not permit out-of-bounds crops',()=>{const c=normalizedCrop({x:.75,y:.8,w:.8,h:.7});near(c.x+c.w,1);near(c.y+c.h,1);});
test('passport portrait aspect is correct on a landscape image',()=>{
  const c=centerCropToAspect(fullCrop(),1600,1000,35/45);
  near(croppedAspectRatio(c,1600,1000),35/45);
  assert.ok(c.w<1 && c.h<=1);
});
test('square crop for portrait image',()=>{const c=centerCropToAspect(fullCrop(),900,1600,1);near(croppedAspectRatio(c,900,1600),1);});
test('crop movement remains inside source',()=>{const c=moveCrop({x:.2,y:.2,w:.5,h:.5},5,-5);near(c.x,.5);near(c.y,0);});
test('free resize changes both crop dimensions',()=>{const c=resizeCrop({x:.2,y:.2,w:.5,h:.5},'se',.85,.9,1000,1000);near(c.w,.65);near(c.h,.7);});
test('fixed-aspect resize from northwest anchors southeast',()=>{
 const c=resizeCrop({x:.1,y:.1,w:.6,h:.6},'nw',.3,.2,1200,800,35/45);
 near(c.x+c.w,.7);near(c.y+c.h,.7);near(croppedAspectRatio(c,1200,800),35/45);
});
test('dragging a crop corner beyond its opposite corner clamps rather than flipping',()=>{
 const c=resizeCrop({x:.2,y:.2,w:.5,h:.5},'nw',.95,.95,1000,1000);
 near(c.x+c.w,.7);near(c.y+c.h,.7);assert.ok(c.w>.009 && c.h>.009);
});
test('locked image resize preserves original aspect',()=>{
 const r=resizeScreenRect({left:50,top:60,width:100,height:150},'se',45,20,true);
 near(r.width/r.height,100/150);near(r.left,50);near(r.top,60);
});
test('free-form image resize can change aspect',()=>{
 const r=resizeScreenRect({left:50,top:60,width:100,height:150},'nw',-20,-25,false);
 near(r.left,30);near(r.top,35);near(r.width,120);near(r.height,175);
});
