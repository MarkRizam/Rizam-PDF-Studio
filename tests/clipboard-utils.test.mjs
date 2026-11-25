import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePastedText,copyAnnotationForPage} from '../src/clipboard-utils.js';

test('paste text wraps without cutting words or discarding content',()=>{
  const result=preparePastedText('Mohd Rizam Bakar\nFull Stack Developer with JavaScript and React',22,10);
  assert.equal(result.error,null);
  assert.match(result.text,/Mohd Rizam Bakar/);
  assert.match(result.text,/Full Stack Developer/);
  assert.match(result.text.replace(/\n/g,' '),/JavaScript and React/);
});
test('pasted empty and overlong content is rejected without truncation',()=>{
  assert.match(preparePastedText('  ').error,/no text/i);
  assert.match(preparePastedText('a '.repeat(100),10,2).error,/shorter section/i);
  assert.match(preparePastedText('X'.repeat(9000)).error,/too long/i);
});
test('long unbroken words wrap safely and original text stays intact',()=>{
  const r=preparePastedText('ABCDEFGHIJKLMNOPQRSTUVWXYZ',10,4);
  assert.equal(r.error,null);
  assert.equal(r.text.replace(/\n/g,''),'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
});
test('copy text or image preserves content, offsets, and respects page bounds',()=>{
  const box={minX:0,minY:0,maxX:595,maxY:842,width:595,height:842};
  const textItem={id:'item-5',type:'text',text:'Example name',x:400,y:600,size:12,color:'#000000'};
  const txt=copyAnnotationForPage(textItem,box);
  assert.equal(txt.id,undefined);
  assert.equal(txt.text,'Example name');
  assert.equal(txt.x,418);assert.equal(txt.y,582);
  const img={id:'item-6',type:'image',x:570,y:5,w:100,h:120,crop:{x:0,y:0,w:0.8,h:0.8},dataUrl:'data:image/png;base64,AA',bytes:new Uint8Array([1,2])};
  const duplicate=copyAnnotationForPage(img,box);
  assert.ok(duplicate.x<=495);assert.ok(duplicate.y>=0);
  duplicate.crop.x=.2;
  assert.equal(img.crop.x,0);
  assert.equal(duplicate.bytes,img.bytes);
});
