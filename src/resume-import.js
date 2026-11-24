/**
 * Résumé import for Rizam PDF Studio.
 * Local-only, deterministic and intentionally conservative. Do not infer
 * protected/sensitive answers, salary, dates, proficiency or qualifications.
 * Works without a remote AI API. Human review is mandatory.
 */
import { cleanProfile, PROFILE_FIELDS } from './form-autofill.js';

const MAX_RESUME_BYTES = 15 * 1024 * 1024;
const MAX_DOCX_XML_BYTES = 6 * 1024 * 1024;
const textDecoder = new TextDecoder('utf-8');
const knownHeadings = [
  ['education', /^(?:education|academic (?:background|qualifications?|history)|kelayakan akademik|pendidikan|academic qualifications?)\s*:?(?:\s*)$/i],
  ['employment', /^(?:work experience|professional experience|experience|employment history|employment|work history|career history|pengalaman (?:kerja|pekerjaan)|pengalaman profesional)\s*:?(?:\s*)$/i],
  ['skills', /^(?:technical skills|computer skills|skills|technologies|technology stack|technical proficiencies|kemahiran(?: teknikal)?|technical expertise|tools & technologies)\s*:?(?:\s*)$/i],
  ['training', /^(?:certifications?|certificates?|professional qualifications?|courses?|training|professional development|latihan|sijil|pensijilan)\s*:?(?:\s*)$/i],
  ['other', /^(?:about me|summary|profile|professional summary|objective|career objective|awards?|publications?|projects?|languages?|references?|referees?|personal information|personal details|contact(?: information)?|interests?|hobbies|volunteer(?:ing)?|achievements?|soft skills|research|research interests|leadership)\s*:?(?:\s*)$/i],
];
const yearOrMonth = '(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\\s/-]+)?(?:19|20)\\d{2}';
const dateRangeRe = new RegExp(`\\b(${yearOrMonth})\\s*(?:-|–|—|to|until|through)\\s*((?:${yearOrMonth})|Present|Current|Now|Ongoing|Kini|Sekarang)\\b`, 'i');
const degreeRe = /\b(?:bachelor|master|masters|mba\b|bsc\b|b\.sc\b|beng\b|b\.eng\b|msc\b|m\.sc\b|phd\b|ph\.d\b|doctorate|diploma|degree|certificate|ijazah|sarjana|sijil|spm\b|stpm\b)\b/i;
const institutionRe = /\b(?:universit(?:y|i|as)|college|kolej|politeknik|polytechnic|institute|institut|school|sekolah|academy|akademi)\b/i;
const employerRe = /\b(?:sdn\.?\s*bhd\.?|bhd\b|berhad\b|company\b|corporation\b|corp\b|inc\b|ltd\b|llc\b|technologies\b|technology\b|solutions\b|systems\b|agency\b|bank\b|group\b|consulting\b|university\b|universiti\b)\b/i;
const titleRe = /\b(?:engineer|developer|architect|analyst|scientist|consultant|manager|specialist|programmer|designer|administrator|executive|lecturer|researcher|intern|director|technician|officer|lead|assistant|freelance|founder|coordinator|operator|teacher|head|support|designer)\b/i;

const trimLine = (s) => String(s || '').replace(/[\u00a0\t]+/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeLines = (text) => String(text||'').replace(/\r/g, '\n').split(/\n+/).map(trimLine).filter(Boolean).slice(0, 2200);
const getHeading = (line) => knownHeadings.find(([, re]) => re.test(line))?.[0] || null;
const withoutBullet = (line) => String(line).replace(/^\s*(?:[•●▪*+\-–—]\s+|\d{1,2}[.)]\s+)/, '').trim();
const cleanCell = (value) => withoutBullet(value).replace(/\s*[|,;:]\s*$/, '').slice(0, 260);
const splitRange = (s) => {
  const m = String(s).match(dateRangeRe);
  return m ? {from:m[1],to:m[2],rest:trimLine(s.replace(m[0], '').replace(/^[|,;:()\-\s]+|[|,;:()\-\s]+$/g,''))} : null;
};

function sectionize(lines) {
  const result = {header:[],education:[],employment:[],skills:[],training:[],other:[]};
  let current='header';
  for(const line of lines){
    const key=getHeading(line);
    if(key){current=key;continue;}
    result[current].push(line);
  }
  return result;
}

function looksLikePersonName(s){
  const name=trimLine(s);
  if(!name || name.length>75 || /\d|@|https?:|linkedin|github|resume|résumé|curriculum vitae|profile|contact|summary|experience|education|skills|engineer|developer|scientist|analyst|manager|phone|email|address|portfolio/i.test(name))return false;
  return /^(?:[\p{L}'’.\-]+\s+){1,5}[\p{L}'’.\-]+$/u.test(name);
}
function findField(lines,labels) {
  const re = new RegExp(`^(?:${labels.join('|')})\\s*[:：-]\\s*(.+)$`, 'i');
  return lines.map(s=>s.match(re)).find(Boolean)?.[1]?.trim() || '';
}
function contactInfo(lines,profile,warnings) {
  const all=lines.join('\n');
  const email=all.match(/\b[A-Z0-9._%+\-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  if(email)profile.email=email[0];
  const labelled=findField(lines,['(?:mobile|phone|handphone|telefon|tel|contact number|contact no\\.?|hp)']);
  const phoneCandidate=labelled||lines.find(s=>/^(?:(?:\+?60)|0)\d[\d\s().-]{7,16}$/.test(s))||'';
  const digits=phoneCandidate.replace(/\D/g,'');
  if(digits.length>=9 && digits.length<=13 && !/^(?:\d{6}-?\d{2}-?\d{4})$/.test(phoneCandidate))profile.phone=phoneCandidate.replace(/^(?:mobile|phone|handphone|telefon|tel|contact number|contact no\.?|hp)\s*[:：-]?\s*/i,'').trim();
  const labelledName=findField(lines,['(?:full )?name','nama(?: penuh)?']);
  if(labelledName&&looksLikePersonName(labelledName))profile.fullName=labelledName;
  else {const candidate=lines.slice(0,9).find(looksLikePersonName);if(candidate)profile.fullName=candidate;}
  const addr=findField(lines,['(?:residential |home |mailing |current )?address','alamat(?: rumah)?']);
  if(addr)profile.address=addr;
  const nat=findField(lines,['nationality','warganegara']);
  if(nat)profile.nationality=nat;
  if(!profile.fullName)warnings.push('Full name not confidently detected.');
  if(!profile.email)warnings.push('Email not detected.');
}
function parseEducation(lines, warnings) {
  const result=[];
  let entry=null;
  function flush(){if(entry && (entry.institution || entry.qualification)){result.push(entry);}entry=null;}
  for (let i=0;i<lines.length;i++) {
    const line=withoutBullet(lines[i]);
    if(!line)continue;
    const range=splitRange(line);
    const stripped=range?.rest || line;
    const institution=institutionRe.test(stripped);
    const degree=degreeRe.test(stripped);
    if(institution && degree && stripped.length<180) {
      flush();entry={institution:'',qualification:'',from:range?.from||'',to:range?.to||''};
      const bits=stripped.split(/\s*(?:\||\s+at\s+|\s+@\s+|\s+[-–—]\s+)\s*/i).filter(Boolean);
      const ii=bits.findIndex(b=>institutionRe.test(b));
      if(ii>=0 && bits.length>=2){entry.institution=cleanCell(bits[ii]);entry.qualification=cleanCell(bits.filter((_,k)=>k!==ii).join(' '));}
      else if(/\b(?:university|universiti|college|kolej|institute)\b/i.test(stripped) && /\s+\b(?:Bachelor|Master|Diploma|MBA|BSc|MSc|PhD)\b/i.test(stripped)) {
        const m=stripped.match(/\b(?:Bachelor|Master|Diploma|MBA|BSc|MSc|PhD)\b/i);
        const a=stripped.slice(0,m.index).trim(),b=stripped.slice(m.index).trim();
        entry.institution=cleanCell(a);entry.qualification=cleanCell(b);
      } else {entry.qualification=cleanCell(stripped);}
      continue;
    }
    if(degree && stripped.length<165){
      if(!entry || (entry.qualification && entry.institution))flush();
      if(!entry)entry={institution:'',qualification:'',from:'',to:''};
      if(!entry.qualification)entry.qualification=cleanCell(stripped);
      if(range){entry.from=range.from;entry.to=range.to;}
      continue;
    }
    if(institution && stripped.length<145){
      if(!entry || (entry.institution && entry.qualification))flush();
      if(!entry)entry={institution:'',qualification:'',from:'',to:''};
      if(!entry.institution)entry.institution=cleanCell(stripped);
      if(range){entry.from=range.from;entry.to=range.to;}
      continue;
    }
    if(range && !range.rest && entry){entry.from=range.from;entry.to=range.to;continue;}
    if(range && range.rest && entry && !entry.from){entry.from=range.from;entry.to=range.to;continue;}
  }
  flush();
  if(lines.length && !result.length)warnings.push('Education section needs manual review.');
  return result.slice(0,15);
}
function parseEmployment(lines,warnings) {
  const items=[];
  let current=null;
  function flush(){if(current && (current.employer || current.lastPosition)){items.push(current);}current=null;}
  const fresh=()=>({employer:'',from:'',to:'',startingPosition:'',lastPosition:'',duties:'',reason:'',startingSalary:'',lastSalary:''});
  for(let i=0;i<lines.length;i++){
    const raw=lines[i],line=withoutBullet(raw);
    const range=splitRange(line);
    const text=(range?.rest||line).replace(/\s*[|–—]\s*$/,'').trim();
    const divided=text.split(/\s*\|\s*|\s+[-–—]\s+/).map(cleanCell).filter(Boolean);
    let position='',employer='';
    if(divided.length>=2){
      const a=divided[0],b=divided[1];
      if(titleRe.test(a)&&!titleRe.test(b)){position=a;employer=b;}
      else if(employerRe.test(a)&&titleRe.test(b)){employer=a;position=b;}
    }
    const isRangeOnly=range && !text;
    if(isRangeOnly && current){current.from=range.from;current.to=range.to;continue;}
    if(position && employer){
      flush();current=fresh();current.lastPosition=position;current.employer=employer;
      if(range){current.from=range.from;current.to=range.to;}
      continue;
    }
    // A date on the same line as a title, followed by the employer or vice versa.
    if(range && titleRe.test(text) && text.length<110 && !/^(?:developed|managed|built|created|implemented)\b/i.test(text)){
      if(current?.lastPosition && current.employer)flush();
      if(!current)current=fresh();
      current.lastPosition=current.lastPosition||cleanCell(text);
      current.from=range.from;current.to=range.to;
      continue;
    }
    if(range && employerRe.test(text) && text.length<110){
      if(current?.employer && current.lastPosition)flush();
      if(!current)current=fresh();
      current.employer=current.employer||cleanCell(text);
      current.from=range.from;current.to=range.to;
      continue;
    }
    if(!range && titleRe.test(text) && text.length<85 && !/^[-•*]/.test(raw) && !/^\b(?:developed|built|managed|worked|implemented|led|created|improved|designed|maintained)\b/i.test(text)){
      if(current?.lastPosition && current.employer)flush();
      if(!current)current=fresh();
      if(!current.lastPosition)current.lastPosition=cleanCell(text);
      continue;
    }
    if(!range && employerRe.test(text) && text.length<115 && !/^[-•*]/.test(raw) && !/^(?:developed|built|managed|worked|implemented|led|created|improved|designed|maintained)\b/i.test(text)){
      if(current?.employer && current.lastPosition)flush();
      if(!current)current=fresh();
      if(!current.employer)current.employer=cleanCell(text);
      continue;
    }
    if(current && /^[•*\-–]\s+/.test(raw) && line.length<280){
      current.duties=[current.duties,line].filter(Boolean).join('; ').slice(0,1000);
    }
  }
  flush();
  if(lines.length&&!items.length)warnings.push('Employment section needs manual review.');
  if(items.some(e=>!e.employer || !e.lastPosition))warnings.push('Some employment entries are incomplete; confirm employer and job title.');
  return items.slice(0,15);
}
function parseSkills(lines){
  const items=[];
  const known=/^(?:java(?:script)?|typescript|python|php|react(?:\.js)?|node(?:\.js)?|next(?:\.js)?|vue(?:\.js)?|angular|c#|c\+\+|c\b|go|rust|sql|postgres(?:ql)?|mysql|mongodb|docker|kubernetes|git|github|linux|aws|azure|gcp|machine learning|deep learning|pytorch|tensorflow|llm|rag|langchain|langgraph|llamaindex|html|css|fastapi|flask|django|laravel|figma|power bi|excel|powerpoint|word|ms office|microsoft office|data engineering|airflow|spark|hadoop|pandas|numpy|scikit-learn|ci\/cd|devops|redis|graphql|rest(?: api)?|spring boot|\.net|asp\.net|csharp|visual basic|vb\.net)$/i;
  for(const line of lines){
    const clean=withoutBullet(line).replace(/^(?:skills|languages|tools|frameworks|programming|databases|platforms|technologies)\s*:\s*/i,'');
    const pieces=clean.split(/[,;|•·]/).map(v=>v.trim()).filter(Boolean);
    for(const piece of pieces){
      if(piece.length>50)continue;
      const candidate=piece.replace(/\s*\([^)]*\)\s*$/,'').trim();
      if(known.test(candidate) && !items.some(x=>x.name.toLowerCase()===candidate.toLowerCase()))items.push({name:candidate,level:''});
    }
  }
  return items.slice(0,30);
}
function parseTraining(lines){
  const result=[];
  for(const raw of lines){
    const line=withoutBullet(raw);
    if(line.length>130 || !line || /^(?:technical|soft|personal)\s+skills/i.test(line))continue;
    const range=splitRange(line);
    const label=(range?.rest||line);
    if(label.length<8)continue;
    // Certification title only; do not guess issuing body.
    result.push({institution:'',from:range?.from||'',to:range?.to||'',certification:label});
  }
  return result.slice(0,15);
}

export function extractResumeProfile(text) {
  const lines=normalizeLines(text);
  const warnings=[];
  if(lines.join('').length<35)return {profile:cleanProfile({}),warnings:['Could not read enough résumé text. A scanned/image-only PDF needs OCR, which is not available yet.'],recognized:0,lines:lines.length};
  const sections=sectionize(lines);
  const profile={};
  contactInfo(lines.slice(0,80),profile,warnings);
  profile.education=parseEducation(sections.education,warnings);
  profile.employment=parseEmployment(sections.employment,warnings);
  profile.training=parseTraining(sections.training);
  profile.skills=parseSkills(sections.skills);
  if(!sections.education.length)warnings.push('No clearly labelled education section found.');
  if(!sections.employment.length)warnings.push('No clearly labelled employment section found.');
  if(sections.skills.length && !profile.skills.length)warnings.push('Skills were not confidently matched; please enter them manually.');
  // Never infer: job title applied for, salary, personal ID, birth date,
  // private declarations, notice period, or writing a motivation statement.
  const cleaned=cleanProfile(profile);
  const recognized=PROFILE_FIELDS.filter(([k])=>cleaned[k]).length+
    ['education','employment','training','skills'].reduce((n,k)=>n+cleaned[k].length,0);
  return {profile:cleaned,warnings:[...new Set(warnings)],recognized,lines:lines.length};
}

export function mergeResumeProfile(current,imported,{overwrite=false}={}){
  const old=cleanProfile(current),fresh=cleanProfile(imported),result=cleanProfile(old);
  const changed=[];
  for(const [key] of PROFILE_FIELDS){
    if(!fresh[key] || (!overwrite && old[key]))continue;
    if(old[key]!==fresh[key]){result[key]=fresh[key];changed.push(key);}
  }
  // List entries are merged by normalized identifying content, never blindly duplicated.
  for(const [group,identity] of [['education','institution'],['employment','employer'],['training','certification'],['skills','name']]){
    for(const item of fresh[group]){
      const canonical=(item[identity]||Object.values(item).find(Boolean)||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      const previous=result[group].find(r=>{
        const label=(r[identity]||Object.values(r).find(Boolean)||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
        return canonical && label === canonical;
      });
      if(previous){
        for(const [k,v] of Object.entries(item)){
          if(v && (overwrite || !previous[k]) && previous[k]!==v){previous[k]=v;changed.push(`${group}.${k}`);}
        }
      } else if(result[group].length<30){result[group].push(item);changed.push(`${group}+`);}
    }
  }
  return {profile:cleanProfile(result),changed};
}

/** Join PDF.js text items into visual lines for simple single-column CVs. */
export function linesFromPdfTextItems(items){
  const entries=(items||[]).filter(i=>typeof i.str==='string' && i.str.trim() && Array.isArray(i.transform)).map(i=>({s:i.str.trim(),x:Number(i.transform[4])||0,y:Number(i.transform[5])||0}));
  entries.sort((a,b)=>b.y-a.y || a.x-b.x);
  const lines=[];
  for(const e of entries){
    let row=lines.find(row=>Math.abs(row.y-e.y)<3);
    if(!row){row={y:e.y,parts:[]};lines.push(row);}
    row.parts.push(e);
  }
  return lines.sort((a,b)=>b.y-a.y).map(row=>row.parts.sort((a,b)=>a.x-b.x).map(e=>e.s).join(' ')).join('\n');
}

function decodeXMLText(s){
  return String(s).replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (all,num,named)=>{
    if(named)return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[named.toLowerCase()]||all;
    const code=num[0]?.toLowerCase()==='x'?parseInt(num.slice(1),16):parseInt(num,10);
    return Number.isFinite(code) && code>=0 && code<=0x10ffff ? String.fromCodePoint(code) : '';
  });
}
/** Minimal DOCX text-only extraction using ZIP central directory, no external calls. */
export async function extractDocxText(buffer){
  const bytes=new Uint8Array(buffer);
  if(bytes.byteLength>MAX_RESUME_BYTES)throw new Error('Résumé exceeds 15 MB limit.');
  if(bytes.byteLength<22)throw new Error('Not a valid DOCX file.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16=(p)=>view.getUint16(p,true),u32=(p)=>view.getUint32(p,true);
  let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(u32(i)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error('Not a valid DOCX/ZIP archive.');
  const entries=u16(eocd+10),centralOffset=u32(eocd+16);
  if(entries>5000 || centralOffset>=bytes.length)throw new Error('DOCX has an unsupported ZIP directory.');
  let position=centralOffset, file=null;
  for(let n=0;n<entries;n++){
    if(position+46>bytes.length||u32(position)!==0x02014b50)throw new Error('DOCX ZIP directory is damaged.');
    const method=u16(position+10),compressed=u32(position+20),uncompressed=u32(position+24);
    const nameSize=u16(position+28),extraSize=u16(position+30),commentSize=u16(position+32);
    const filename=textDecoder.decode(bytes.slice(position+46,position+46+nameSize));
    if(filename==='word/document.xml'){
      file={method,compressed,uncompressed,offset:u32(position+42)};
      break;
    }
    position+=46+nameSize+extraSize+commentSize;
  }
  if(!file)throw new Error('DOCX does not contain word/document.xml.');
  if(file.uncompressed>MAX_DOCX_XML_BYTES || file.compressed>MAX_RESUME_BYTES)throw new Error('DOCX text is too large.');
  const start=file.offset;
  if(start+30>bytes.length||u32(start)!==0x04034b50)throw new Error('DOCX file header is invalid.');
  const dataStart=start+30+u16(start+26)+u16(start+28);
  if(dataStart+file.compressed>bytes.length)throw new Error('DOCX data is incomplete.');
  const compressed=bytes.slice(dataStart,dataStart+file.compressed);
  let xmlBytes;
  if(file.method===0)xmlBytes=compressed;
  else if(file.method===8){
    if(typeof DecompressionStream==='undefined')throw new Error('This browser does not support DOCX decompression. Use Chrome or Edge.');
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const reader=stream.getReader();const chunks=[];let total=0;
    try{
      while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;
        if(total>MAX_DOCX_XML_BYTES){await reader.cancel();throw new Error('DOCX expanded beyond the allowed size.');}
        chunks.push(value);
      }
    }finally{reader.releaseLock();}
    xmlBytes=new Uint8Array(total);let i=0;for(const chunk of chunks){xmlBytes.set(chunk,i);i+=chunk.length;}
  } else throw new Error('Unsupported DOCX ZIP compression format.');
  if(xmlBytes.length>MAX_DOCX_XML_BYTES)throw new Error('DOCX text exceeds allowed size.');
  const xml=textDecoder.decode(xmlBytes);
  if(!/<w:document\b/.test(xml)||!/<w:body\b/.test(xml))throw new Error('Not a readable Word DOCX document.');
  const paragraphs=[];
  for(const match of xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)){
    const paragraph=match[1].replace(/<w:tab(?:\s[^>]*)?\s*\/>/g,' ').replace(/<w:br(?:\s[^>]*)?\s*\/>/g,'\n');
    const tokens=Array.from(paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),m=>decodeXMLText(m[1]));
    if(tokens.length)paragraphs.push(tokens.join(''));
  }
  return paragraphs.join('\n').trim();
}

export async function readResumeFile(file,pdfjsLib){
  if(!file)throw new Error('Please select a résumé.');
  if(file.size>MAX_RESUME_BYTES)throw new Error('Résumé is too large (maximum 15 MB).');
  const name=file.name.toLowerCase();
  if(name.endsWith('.txt'))return file.text();
  if(name.endsWith('.docx'))return extractDocxText(await file.arrayBuffer());
  if(name.endsWith('.pdf')){
    if(!pdfjsLib)throw new Error('PDF reader unavailable.');
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    try{
      if(pdf.numPages>40)throw new Error('Please choose a résumé shorter than 40 pages.');
      const pages=[];
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i);pages.push(linesFromPdfTextItems((await page.getTextContent()).items));
      }
      return pages.join('\n');
    } finally {await pdf.destroy();}
  }
  throw new Error('Supported résumé formats: PDF, DOCX or TXT.');
}
