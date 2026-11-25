import test from 'node:test';
import assert from 'node:assert/strict';
import { extractResumeProfile, mergeResumeProfile, extractDocxText, linesFromPdfTextItems, readResumeFile } from '../src/resume-import.js';
import { emptyProfile } from '../src/form-autofill.js';
import { readFileSync } from 'node:fs';

const sample=`Amina Rahman
Software Engineer
Email: amina.rahman@example.com
Mobile: +60 12 345 6789
Address: 17 Example Street, Kuala Lumpur

Professional Summary
I build software and research AI.

Education
Bachelor of Science in Computer Science
Universiti Example Malaysia
2012 - 2016
MBA
Example University
2018 - 2020

Work Experience
Senior Software Engineer | Example Technology Sdn Bhd
Jan 2021 - Present
- Developed API services for organizations
- Wrote automated tests and reviewed pull requests
Software Engineer | Another Solutions Sdn Bhd
2016 - 2020
- Built internal software

Technical Skills
Python, JavaScript, React, Docker, SQL, Kubernetes

Certifications
Certified Cloud Practitioner | 2022 - 2023
`;

test('extract contact, two education records, work, and skills without inventing answers',()=>{
  const result=extractResumeProfile(sample);
  assert.equal(result.profile.fullName,'Amina Rahman');
  assert.equal(result.profile.email,'amina.rahman@example.com');
  assert.equal(result.profile.phone,'+60 12 345 6789');
  assert.equal(result.profile.address,'17 Example Street, Kuala Lumpur');
  assert.equal(result.profile.education.length,2);
  assert.equal(result.profile.education[0].institution,'Universiti Example Malaysia');
  assert.equal(result.profile.education[0].qualification,'Bachelor of Science in Computer Science');
  assert.deepEqual(result.profile.education[0].from,'2012');
  assert.equal(result.profile.employment.length,2);
  assert.equal(result.profile.employment[0].lastPosition,'Senior Software Engineer');
  assert.equal(result.profile.employment[0].employer,'Example Technology Sdn Bhd');
  assert.match(result.profile.employment[0].duties,/Developed API/);
  assert.equal(result.profile.skills.length,6);
  for(const name of ['identityNumber','postApplied','jobStatement','expectedSalary','dateOfBirth','nationality','noticePeriod'])assert.equal(result.profile[name],'');
  assert.equal(result.profile.skills.find(x=>x.name==='Python').level,'');
});
test('section headers prevent extracting content from unrelated sections',()=>{
  const p=extractResumeProfile('Nur Ali\nEmail: nur@example.com\nProjects\nDeveloper | Fake Company Ltd\n2023 - 2025\nAwards\nBest Developer\n');
  assert.equal(p.profile.employment.length,0);
});
test('high-risk personal answers are never inferred from résumé text',()=>{
  const p=extractResumeProfile('Farah Example\nEmail: farah@example.com\nNRIC: 111111-11-1111\nExpected salary: RM 9000\nDate of birth: 01/01/1990\nReligion: Example\n2018 - 2024\n').profile;
  assert.equal(p.identityNumber,'');assert.equal(p.expectedSalary,'');assert.equal(p.dateOfBirth,'');assert.equal(p.postApplied,'');
});
test('empty or scanned resumes return clear warning and no fields',()=>{
  const r=extractResumeProfile('  ');
  assert.equal(r.recognized,0);
  assert.match(r.warnings.join(' '),/OCR/);
});
test('merge fills blanks and deduplicates list items without clobbering existing answers',()=>{
  const old={...emptyProfile(),fullName:'Keep Name',skills:[{name:'Python',level:'advanced'}]};
  const fresh=extractResumeProfile(sample).profile;
  const merged=mergeResumeProfile(old,fresh);
  assert.equal(merged.profile.fullName,'Keep Name');
  assert.equal(merged.profile.email,'amina.rahman@example.com');
  assert.equal(merged.profile.skills.filter(x=>x.name==='Python').length,1);
  assert.equal(merged.profile.skills.find(x=>x.name==='Python').level,'advanced');
  const mergedAgain=mergeResumeProfile(merged.profile,fresh);
  assert.equal(mergedAgain.profile.education.length,2);
  assert.equal(mergedAgain.profile.employment.length,2);
});
test('overwrite mode updates supplied values but not blanks',()=>{
  const current={...emptyProfile(),fullName:'Old Name',postApplied:'Software Engineer'};
  const result=mergeResumeProfile(current,{fullName:'New Name'}, {overwrite:true}).profile;
  assert.equal(result.fullName,'New Name');assert.equal(result.postApplied,'Software Engineer');
});
test('PDF.js visual line grouping respects line coordinates',()=>{
  assert.equal(linesFromPdfTextItems([
    {str:'Email:',transform:[1,0,0,1,10,90]},
    {str:'amina@example.com',transform:[1,0,0,1,60,90]},
    {str:'Amina Rahman',transform:[1,0,0,1,10,110]},
  ]),'Amina Rahman\nEmail: amina@example.com');
});
test('DOCX extractor supports text, paragraphs and XML entities using local ZIP only',async()=>{
  const file=readFileSync(new URL('./synthetic-resume.docx',import.meta.url));
  const txt=await extractDocxText(file);
  assert.match(txt,/Amina Rahman/);assert.match(txt,/Example & Sons/);
  assert.match(txt,/Python/);
});


test('PDF resume import succeeds when PDF document has no destroy method',async()=>{
  let destroyed=0;
  const file={name:'example-resume.pdf',size:100,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
  const doc={numPages:1,getPage:async()=>({getTextContent:async()=>({items:[
    {str:'Amina Rahman',transform:[1,0,0,1,20,700]},
    {str:'Email: amina@example.com',transform:[1,0,0,1,20,680]},
  ]})})};
  const reader={getDocument:()=>({promise:Promise.resolve(doc),destroy:async()=>{destroyed++;}})};
  const extracted=await readResumeFile(file,reader);
  assert.match(extracted,/Amina Rahman/);
  assert.match(extracted,/amina@example.com/);
  assert.equal(destroyed,1,'PDF.js loading task should be disposed after import');
});

test('PDF import disposes its loading task on extraction failure',async()=>{
  let destroyed=0;
  const file={name:'invalid-resume.pdf',size:100,arrayBuffer:async()=>new ArrayBuffer(0)};
  const reader={getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>{throw new Error('Unusable page');}}),destroy:async()=>{destroyed++;}})};
  await assert.rejects(readResumeFile(file,reader),/Unusable page/);
  assert.equal(destroyed,1);
});


test('MBA university line and responsibility prose never become employment records',()=>{
  const fake=`Amina Rahman
Email: amina@example.com
Education
MSc. (MBA) University Technology Malaysia in 2012. 2014
Work Experience
MSc. (MBA) University Technology Malaysia in 2012. 2014
2012 - 2014
inhouse developer team, guide and lead the team and develop new internal tools
2018 - 2022
Technical Skills
Python, Docker`;
  const result=extractResumeProfile(fake);
  assert.equal(result.profile.employment.length,0);
  assert.match(result.warnings.join(' '),/not.*confident|could not be safely matched/i);
});

test('employment only includes complete dated role and employer pairs',()=>{
  const sample=`Amina Rahman
Email: amina@example.com
Work Experience
Senior Software Engineer | Example Technology Sdn Bhd
Jan 2021 - Present
- Built production APIs
Backend Developer
Bright Labs
2018 - 2020
- Wrote tests
University Example - Master of Science
2012 - 2014
Technical Skills
Python`;
  const result=extractResumeProfile(sample);
  assert.equal(result.profile.employment.length,2);
  assert.equal(result.profile.employment[0].employer,'Example Technology Sdn Bhd');
  assert.equal(result.profile.employment[1].lastPosition,'Backend Developer');
  assert.equal(result.profile.employment[1].employer,'Bright Labs');
  assert.ok(!result.profile.employment.some(e=>/university|master/i.test(e.employer)));
});

test('undated incomplete jobs are omitted rather than guessed',()=>{
  const text='Amina Rahman\nEmail: amina@example.com\nEmployment History\nEngineer | Example Company\n- Built software\nProjects\nMy project';
  const result=extractResumeProfile(text);
  assert.deepEqual(result.profile.employment,[]);
  assert.match(result.warnings.join(' '),/manually/i);
});
