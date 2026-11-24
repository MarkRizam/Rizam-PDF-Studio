/*
 * Reusable local profile and position-based job-form template.
 * The template is intentionally strict. A wrong PDF layout must never be
 * stamped with guessed coordinates. No form questions are guessed.
 */
export const PROFILE_STORAGE_KEY = 'rizam-pdf-studio:career-profile:v1';
export const PROPPY_PAGE_HEIGHT = 841.8;

export const PROFILE_FIELDS = [
  ['postApplied', 'Post applied for'],
  ['fullName', 'Full name'], ['email', 'Email'], ['phone', 'Mobile number'],
  ['address', 'Address'], ['nationality', 'Nationality'],
  ['placeOfBirth', 'Place of birth'], ['dateOfBirth', 'Date of birth'],
  ['homePhone', 'Home telephone'], ['officePhone', 'Office telephone'],
  ['emergencyName', 'Emergency contact name'], ['emergencyRelationship', 'Emergency contact relationship'],
  ['emergencyPhone', 'Emergency contact phone'], ['emergencyAddress', 'Emergency contact address'],
  ['expectedSalary', 'Expected salary'], ['noticePeriod', 'Notice period'],
  ['earliestStart', 'Earliest commencement date'], ['jobStatement', 'Why I am applying'],
];
export const SESSION_FIELDS = [
  ['identityNumber', 'NRIC / Passport no. (session only)'],
];

export function emptyProfile() {
  return {
    postApplied:'', fullName:'', email:'', phone:'', address:'', nationality:'',
    placeOfBirth:'', dateOfBirth:'', homePhone:'', officePhone:'',
    emergencyName:'', emergencyRelationship:'', emergencyPhone:'', emergencyAddress:'',
    expectedSalary:'', noticePeriod:'', earliestStart:'', jobStatement:'',
    identityNumber:'', education:[], training:[], employment:[], skills:[],
  };
}
export function cleanProfile(raw) {
  const profile=emptyProfile();
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return profile;
  for(const [key] of [...PROFILE_FIELDS,...SESSION_FIELDS]) {
    const value=raw[key];
    profile[key]=typeof value==='string'?value.trim().slice(0,4000):'';
  }
  const listFields={
    education:['institution','from','to','qualification'],
    training:['institution','from','to','certification'],
    employment:['employer','from','to','startingPosition','lastPosition','duties','reason','startingSalary','lastSalary'],
    skills:['name','level'],
  };
  for(const [group,keys] of Object.entries(listFields)) {
    const list=Array.isArray(raw[group])?raw[group]:[];
    profile[group]=list.slice(0,30).map(item=>Object.fromEntries(keys.map(k=>[k,typeof item?.[k]==='string'?item[k].trim().slice(0,3000):''])));
  }
  return profile;
}
export function safeToStore(profile) {
  const saved=cleanProfile(profile);
  saved.identityNumber=''; // Never store identity number in browser localStorage.
  return saved;
}

/**
 * Recognition must use text from all four pages AND A4 dimensions. This PDF
 * contains no interactive PDF form widgets, so the layout mapping is exact.
 */
export function isProppyTemplate(pages) {
  if (!Array.isArray(pages) || pages.length!==4) return false;
  const has=(i,text)=>String(pages[i]?.text||'').toLowerCase().includes(text.toLowerCase());
  const correctSize=pages.every(p=>Math.abs(Number(p.width)-595.2)<3 && Math.abs(Number(p.height)-841.8)<3);
  return correctSize && has(0,'Job Application Form') && has(0,'Personal Particulars') &&
    has(0,'Emergency Contact') && has(1,'Educational Details') &&
    has(1,'Computer Literacy Skills') && has(2,'Employment History') &&
    has(3,'PROPPY') && has(3,'Expected Salary');
}

/** Approximate Helvetica metric. Conservative limits avoid collisions. */
export function fitText(value,width,maxLines=1,preferredSize=9,minSize=6) {
  const input=String(value||'').trim();
  if (!input) return null;
  for (let size=preferredSize;size>=minSize-0.001;size-=0.25) {
    const capacity=Math.max(1,Math.floor(width/(size*0.58)));
    const lines=[];
    for (const paragraph of input.replace(/\r/g,'').split('\n')) {
      if(!paragraph){lines.push('');continue;}
      let line='';
      for(const word of paragraph.split(/\s+/)){
        if(word.length>capacity){lines.push('!' .repeat(capacity+1));break;}
        if(!line){line=word;}else if((line+' '+word).length<=capacity){line+=' '+word;}
        else{lines.push(line);line=word;}
      }
      if(line)lines.push(line);
    }
    if(lines.length<=maxLines && lines.every(s=>s.length<=capacity))
      return {text:lines.join('\n'),size};
  }
  return null; // Never silently truncate answers.
}

/**
 * Items are PDF-space annotations for the existing Rizam editor.
 * A note explains any populated field that does not fit.
 */
export function buildProppyAnnotations(raw) {
  const p=cleanProfile(raw);
  const items=[]; const skipped=[]; let provided=0;
  const add=(page,field,value,x,top,width,options={})=>{
    const v=String(value||'').trim(); if(!v)return;
    provided++;
    const {lines=1,size=9,min=6,color='#132841'}=options;
    const fit=fitText(v,width,lines,size,min);
    if(!fit){skipped.push(field+' (text too long for box)');return;}
    items.push({page,field,type:'text',x,y:PROPPY_PAGE_HEIGHT-top-fit.size,
      text:fit.text,size:fit.size,color,autoFill:true});
  };

  // Page 1: fields that are not declarations or personal protected categories.
  add(0,'postApplied',p.postApplied,128,127,260,{size:10});
  add(0,'fullName',p.fullName,204,206,135,{size:8});
  add(0,'address',p.address,43,242,298,{size:9,lines:3});
  add(0,'homePhone',p.homePhone,438,224,125,{size:8});
  add(0,'officePhone',p.officePhone,438,241,125,{size:8});
  add(0,'phone',p.phone,438,258,125,{size:8});
  add(0,'email',p.email,421,276,151,{size:8,min:6});
  add(0,'identityNumber',p.identityNumber,156,293,186,{size:8});
  add(0,'nationality',p.nationality,438,293,125,{size:8});
  add(0,'placeOfBirth',p.placeOfBirth,123,311,50,{size:7,min:6});
  add(0,'dateOfBirth',p.dateOfBirth,260,311,80,{size:8});
  add(0,'emergencyName',p.emergencyName,83,533,256,{size:8});
  add(0,'emergencyRelationship',p.emergencyRelationship,436,533,130,{size:8});
  add(0,'emergencyAddress',p.emergencyAddress,91,550,464,{size:8});
  add(0,'emergencyPhone',p.emergencyPhone,439,568,128,{size:8});

  // Page 2: a known number of blank rows; never extend beyond the form.
  p.education.slice(0,6).forEach((e,i)=>{
    const top=67+17.45*i;
    add(1,`education.${i}.institution`,e.institution,42,top,198,{size:8,min:6});
    add(1,`education.${i}.from`,e.from,261,top,66,{size:8});
    add(1,`education.${i}.to`,e.to,340,top,62,{size:8});
    add(1,`education.${i}.qualification`,e.qualification,419,top,159,{size:8,min:6});
  });
  p.training.slice(0,3).forEach((e,i)=>{
    const top=220+17.45*i;
    add(1,`training.${i}.institution`,e.institution,42,top,200,{size:8});
    add(1,`training.${i}.from`,e.from,261,top,66,{size:8});
    add(1,`training.${i}.to`,e.to,340,top,62,{size:8});
    add(1,`training.${i}.certification`,e.certification,419,top,159,{size:8});
  });
  p.skills.slice(0,3).forEach((s,i)=>{
    const top=523+18.0*i;
    add(1,`skills.${i}.name`,s.name,48,top,357,{size:8});
    const levels={advanced:438,intermediate:489,elementary:550};
    if (levels[s.level?.toLowerCase()])add(1,`skills.${i}.level`,'X',levels[s.level.toLowerCase()],top,11,{size:10});
  });
  add(1,'jobStatement',p.jobStatement,49,604,508,{size:6.4,min:6,lines:1});

  // Page 3: 4 employment boxes (179 pt apart), newest first.
  p.employment.slice(0,4).forEach((e,i)=>{
    const top=48.5+178.6*i;
    const prefix=`employment.${i}`;
    add(2,`${prefix}.employer`,e.employer,42,top+19,280,{size:8,lines:2});
    add(2,`${prefix}.from`,e.from,425,top+2,146,{size:8});
    add(2,`${prefix}.to`,e.to,425,top+19,146,{size:8});
    add(2,`${prefix}.startingSalary`,e.startingSalary,461,top+36,108,{size:8});
    add(2,`${prefix}.lastSalary`,e.lastSalary,461,top+55,108,{size:8});
    add(2,`${prefix}.startingPosition`,e.startingPosition,139,top+75,145,{size:8});
    add(2,`${prefix}.lastPosition`,e.lastPosition,420,top+75,150,{size:8});
    add(2,`${prefix}.duties`,e.duties,42,top+104,518,{size:8,lines:5});
    add(2,`${prefix}.reason`,e.reason,151,top+161,411,{size:8});
  });

  // Page 4: applicant-controlled practical details only; never tick sensitive
  // declarations or signature, and leave "For Official Use Only" untouched.
  add(3,'expectedSalary',p.expectedSalary,75,429,153,{size:9});
  add(3,'noticePeriod',p.noticePeriod,242,429,137,{size:9});
  add(3,'earliestStart',p.earliestStart,430,429,134,{size:9});
  return {items,skipped,provided,filled:items.length};
}

/** Profile fields for manual placement on any other PDF. */
export function fieldOptions(profile) {
  const p=cleanProfile(profile), result=[];
  for(const [key,label] of [...PROFILE_FIELDS,...SESSION_FIELDS])if(p[key])result.push({key,label,value:p[key]});
  p.education.forEach((e,i)=>{
    for(const [key,label] of [['institution','Institute'],['qualification','Qualification'],['from','From'],['to','To']])
      if(e[key])result.push({key:`education.${i}.${key}`,label:`Education ${i+1} - ${label}`,value:e[key]});
  });
  p.employment.forEach((e,i)=>{
    for(const [key,label] of [['employer','Employer'],['lastPosition','Position'],['from','From'],['to','To'],['duties','Duties']])
      if(e[key])result.push({key:`employment.${i}.${key}`,label:`Work ${i+1} - ${label}`,value:e[key]});
  });
  return result;
}
