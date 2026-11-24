import test from 'node:test';
import assert from 'node:assert/strict';
import { extractResumeProfile, mergeResumeProfile, extractDocxText, linesFromPdfTextItems } from '../src/resume-import.js';
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
