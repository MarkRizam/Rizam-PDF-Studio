import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProfile,cleanProfile,safeToStore,isProppyTemplate,fitText,buildProppyAnnotations,fieldOptions
} from '../src/form-autofill.js';

test('recognizes only four-page verified PROPPY template',()=>{
 const base=[
  {text:'Job Application Form Personal Particulars Emergency Contact'},
  {text:'Educational Details Computer Literacy Skills'},
  {text:'Employment History'},
  {text:'PROPPY Expected Salary'},
 ].map(p=>({...p,width:595.2,height:841.8}));
 assert.ok(isProppyTemplate(base));
 assert.equal(isProppyTemplate(base.slice(0,3)),false);
 assert.equal(isProppyTemplate(base.map((p,i)=>i===0?{...p,width:612}:p)),false);
 assert.equal(isProppyTemplate(base.map((p,i)=>i===3?{...p,text:'Expected Salary'}:p)),false);
});
test('empty profile does not fill anything or invent answers',()=>{
 const out=buildProppyAnnotations(emptyProfile());
 assert.equal(out.items.length,0);assert.equal(out.skipped.length,0);
});
test('profile sanitization prevents prototype fields and stores no NRIC',()=>{
 const p=cleanProfile({fullName:' Demo ',identityNumber:'000000-00-0000',unknown:'ignore',education:[{institution:'Example College',secret:'ignore'}]});
 assert.equal(p.fullName,'Demo');assert.equal(p.unknown,undefined);
 assert.equal(safeToStore(p).identityNumber,'');
 assert.equal(p.education[0].secret,undefined);
});
test('fills every mapped section without touching declarations and official area',()=>{
 const result=buildProppyAnnotations({postApplied:'Software Engineer',fullName:'Example Applicant',email:'demo@example.org',phone:'011-23456789',
  education:[{institution:'Example University',from:'2015',to:'2019',qualification:'BSc Computing'}],
  employment:[{employer:'Example Employer',from:'01/2022',to:'12/2024',duties:'Built software'}],
  skills:[{name:'Python',level:'intermediate'}],expectedSalary:'RM 5000',noticePeriod:'1 month'});
 assert.ok(result.items.length>=13);
 assert.deepEqual(new Set(result.items.map(a=>a.page)),new Set([0,1,2,3]));
 assert.ok(result.items.every(a=>a.type==='text'&&a.autoFill===true&&a.y>0&&a.y<842));
 assert.ok(result.items.filter(a=>a.page===3).every(a=>a.field==='expectedSalary'||a.field==='noticePeriod'||a.field==='earliestStart'));
 assert.ok(result.items.some(a=>a.field==='skills.0.level'&&a.text==='X'));
});
test('too-long content is skipped rather than silently truncated',()=>{
 assert.equal(fitText('A'.repeat(500),120,1,9,6),null);
 const result=buildProppyAnnotations({postApplied:'UnbrokenWord'.repeat(100)});
 assert.equal(result.items.length,0);
 assert.equal(result.skipped.length,1);
});
test('limited repeated rows and manual options stay deterministic',()=>{
 const raw={education:Array.from({length:10},(_,i)=>({institution:'School '+i})),employment:[{employer:'Employer A'}]};
 const result=buildProppyAnnotations(raw);
 assert.equal(result.items.filter(a=>a.field.startsWith('education.')).length,6);
 assert.ok(fieldOptions(raw).some(o=>o.key==='employment.0.employer'));
});
test('single line fields fit without wrapping beyond one line',()=>{
 assert.ok(fitText('Test Applicant',135,1,8));
 assert.equal(fitText('A complete sentence that is far too long for this box',50,1,9,8),null);
});
