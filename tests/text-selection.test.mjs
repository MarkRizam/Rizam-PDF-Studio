import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('page has a native PDF.js selectable text layer between canvas and annotations',()=>{
  assert.match(html,/<canvas id="pdfCanvas"><\/canvas><div id="textLayer" class="textLayer"/);
  assert.ok(html.indexOf('id="textLayer"')<html.indexOf('id="annotationLayer"'));
  assert.match(main,/new pdfjsLib\.TextLayer\(\{textContentSource:content,container,viewport\}\)/);
  assert.match(main,/await task\.render\(\)/);
  assert.match(main,/pdfjs-dist\/web\/pdf_viewer\.css/);
});
test('selection tool is separate from editing annotations',()=>{
  assert.match(html,/data-tool="text-select"/);
  assert.match(css,/\.page-stage\.text-select-mode \.annotation\{pointer-events:none!important\}/);
  assert.match(css,/\.page-stage\.text-select-mode>\.textLayer\{pointer-events:auto/);
  assert.match(main,/classList\.toggle\('text-select-mode',tool === 'text-select'\)/);
  assert.match(main,/s:'text-select'/);
});
test('native browser Ctrl+C is not captured in select-text mode',()=>{
  assert.match(main,/if\(state\.tool==='text-select'\)return false; \/\/ Native text selection and Ctrl\+C must work/);
  assert.match(main,/document\.addEventListener\('selectionchange',captureSelectedPdfText\)/);
  assert.match(main,/window\.getSelection\(\)/);
  assert.match(main,/navigator\.clipboard\.writeText\(value\)/);
});
test('render task cancels stale page selections on navigation',()=>{
  assert.match(main,/state\.textLayerTask\.cancel\(\)/);
  assert.match(main,/state\.selectedPdfText='';/);
  assert.match(main,/if\(serial!==state\.renderSerial\)return/);
});
