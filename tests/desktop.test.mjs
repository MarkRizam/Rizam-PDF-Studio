import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const {findPdfArgument,MAX_PDF_SIZE}=require('../desktop/pdf-path.cjs');

test('file association uses an existing PDF file, never a random argument',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rizam-desktop-test-'));
 try{
  const pdf=join(dir,'example.pdf'),txt=join(dir,'example.txt');
  writeFileSync(pdf,'%PDF-1.7 test content');writeFileSync(txt,'not a PDF');
  assert.equal(findPdfArgument(['--some-flag',txt,pdf]),pdf);
  assert.equal(findPdfArgument([txt]),null);
  assert.equal(findPdfArgument([join(dir,'missing.pdf')]),null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('rejects file-like PDF directories and oversized files',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rizam-desktop-test-'));
 try{
  const pdfDir=join(dir,'directory.pdf');mkdirSync(pdfDir);
  assert.equal(findPdfArgument([pdfDir]),null);
  const over=join(dir,'oversize.pdf');
  assert.equal(findPdfArgument([over],{existsSync:()=>true,statSync:()=>({isFile:()=>true,size:MAX_PDF_SIZE+1})}),null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('frontend includes the desktop open-file bridge',()=>{
 const {readFileSync}=require('node:fs');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/rizamDesktop\?\.onOpenPDF/);
 assert.match(main,/await openPDF\(file\)/);
});
