import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import './styles.css';
import { annotationViewportBounds } from './geometry.js';
import { fullCrop, normalizedCrop, isFullCrop, centerCropToAspect, croppedAspectRatio, moveCrop, resizeCrop, resizeScreenRect, clamp } from './image-edit.js';
import { PROFILE_STORAGE_KEY, PROFILE_FIELDS, SESSION_FIELDS, emptyProfile, cleanProfile, safeToStore, isProppyTemplate, buildProppyAnnotations, fieldOptions } from './form-autofill.js';
import { readResumeFile, extractResumeProfile, mergeResumeProfile } from './resume-import.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const $ = (id) => document.getElementById(id);
const state = {
  bytes: null, pdf: null, filename: '', pages: [], pageIndex: 0,
  tool: 'select', selectedId: null, viewport: null, scale: 1,
  renderTask: null, renderSerial: 0, nextId: 1,
  defaults: { text: 'Your text here', size: 18, color: '#18253c', rectColor: '#fbe06c', opacity: 0.35 },
  pendingImage: null, drawing: null, dragging: null, resizing: null, cropEditing: null, profile: emptyProfile(), resumeImport: null,
};
const id = () => `item-${state.nextId++}`;
const activePage = () => state.pages[state.pageIndex];
const activeAnnotation = () => activePage()?.annotations.find((x) => x.id === state.selectedId);
const setStatus = (s) => { $('status').textContent = s; };
const hexRgb = (hex) => {
  const h = (hex || '#18253c').replace('#', '');
  return rgb(parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255);
};
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll('[data-tool]').forEach((el) => el.classList.toggle('active', el.dataset.tool === tool));
  const draw = ['text', 'highlight', 'cover', 'image', 'profile'].includes(tool);
  $('drawLayer').hidden = !draw || !state.pdf;
  if (tool === 'image' && !state.pendingImage) $('imageInput').click();
  updateInspector();
  if (state.pdf) setStatus(tool === 'select' ? 'Select an item to move or edit it.' : tool === 'text' ? 'Click the page to add text.' : tool === 'image' ? 'Choose a PNG/JPG image. It will appear on the current page automatically.' : tool === 'profile' ? 'Choose a saved detail on the right, then click the PDF to place it.' : 'Drag on the page to draw a rectangle.');
}
function updateToolbar() {
  const ok = state.pages.length > 0;
  $('saveBtn').disabled = !ok;
  $('removePageBtn').disabled = !ok || state.pages.length === 1;
  $('prevBtn').disabled = !ok || state.pageIndex === 0;
  $('nextBtn').disabled = !ok || state.pageIndex === state.pages.length - 1;
  $('pageCounter').textContent = ok ? `${state.pageIndex + 1} / ${state.pages.length}` : '– / –';
  $('filename').textContent = state.filename || 'No document selected';
  $('zoomLabel').textContent = state.pdf ? `${Math.round(state.scale*100)}%` : '100%';
}
async function openPDF(file) {
  if (!file || (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf')) { setStatus('Please choose a PDF file.'); return; }
  if (file.size > 60 * 1024 * 1024) { setStatus('This demo supports PDFs up to 60 MB.'); return; }
  setStatus(`Opening ${file.name}…`);
  try {
    if (state.pdf) await state.pdf.destroy();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({data: bytes.slice()}).promise;
    state.pdf = pdf; state.bytes = bytes; state.filename = file.name;
    state.pages = Array.from({length: pdf.numPages}, (_, i) => ({sourceIndex: i, annotations: []}));
    state.pageIndex = 0; state.selectedId = null; state.pendingImage = null;
    $('welcome').hidden = true; $('pageStage').hidden = false;
    setTool('select'); updateToolbar(); updateInspector();
    await renderPage();
    setStatus(`${file.name} opened locally. ${pdf.numPages} page${pdf.numPages === 1?'':'s'}.`);
  } catch (e) {
    console.error(e);
    $('pageStage').hidden = true; $('welcome').hidden = false;
    state.pdf = null; state.bytes = null; state.pages = [];
    updateToolbar(); setStatus(`Cannot open this PDF: ${e.message || 'Invalid or unsupported file.'}`);
  }
}
async function renderPage() {
  if (!state.pdf || !activePage()) return;
  const serial = ++state.renderSerial;
  if (state.renderTask) {
    try { state.renderTask.cancel(); await state.renderTask.promise; } catch (_) { /* normal cancellation */ }
    state.renderTask = null;
  }
  const page = await state.pdf.getPage(activePage().sourceIndex + 1);
  if (serial !== state.renderSerial) return;
  const base = page.getViewport({scale:1});
  const availableWidth = Math.max(270, $('canvasScroll').clientWidth - 70);
  state.scale = Math.min(1.4, availableWidth / base.width);
  state.viewport = page.getViewport({scale:state.scale});
  const vp = state.viewport, canvas = $('pdfCanvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(vp.width * dpr); canvas.height = Math.round(vp.height * dpr);
  canvas.style.width = `${vp.width}px`; canvas.style.height = `${vp.height}px`;
  const stage = $('pageStage'); stage.style.width = `${vp.width}px`; stage.style.height = `${vp.height}px`;
  const context = canvas.getContext('2d', {alpha:false});
  state.renderTask = page.render({canvasContext:context, viewport:vp, transform:dpr===1?undefined:[dpr,0,0,dpr,0,0]});
  try { await state.renderTask.promise; } catch (e) { if (e.name !== 'RenderingCancelledException') throw e; }
  if (serial !== state.renderSerial) return;
  state.renderTask = null;
  renderAnnotations(); updateToolbar(); updateInspector();
  $('pageDetails').textContent = `${Math.round(base.width)} × ${Math.round(base.height)} pt`;
}
function posOnPage(event) {
  const rect = $('pageStage').getBoundingClientRect();
  return {x: Math.max(0, Math.min(rect.width, event.clientX-rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY-rect.top))};
}
function toPDF(px,py) { const [x,y] = state.viewport.convertToPdfPoint(px,py); return {x,y}; }
function pageBounds() {
  const [minX,minY,maxX,maxY]=state.viewport.viewBox;
  return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY};
}
function keepImageOnPage(a) {
  if(!a || a.type!=='image' || !state.viewport)return;
  const b=pageBounds();
  // Preserve both dimensions, including deliberate free-form resizing.
  // Oversized images shrink proportionally without distorting the photo.
  const factor=Math.min(1,b.width/a.w,b.height/a.h);
  a.w=Math.max(1,a.w*factor);a.h=Math.max(1,a.h*factor);
  a.x=Math.min(Math.max(a.x,b.minX),b.maxX-a.w);
  a.y=Math.min(Math.max(a.y,b.minY),b.maxY-a.h);
}
function visiblePageCenter() {
  const scroll=$('canvasScroll').getBoundingClientRect();
  const stage=$('pageStage').getBoundingClientRect();
  const left=Math.max(0,scroll.left-stage.left);
  const right=Math.min(stage.width,scroll.right-stage.left);
  const top=Math.max(0,scroll.top-stage.top);
  const bottom=Math.min(stage.height,scroll.bottom-stage.top);
  return {x:right>left?(left+right)/2:stage.width/2,y:bottom>top?(top+bottom)/2:stage.height/2};
}
function centerImageAtVisiblePage(a) {
  const center=visiblePageCenter();
  const topLeftX=center.x-a.w*state.scale/2;
  const topLeftY=center.y-a.h*state.scale/2;
  const p=toPDF(topLeftX,topLeftY+a.h*state.scale);
  a.x=p.x;a.y=p.y;
  keepImageOnPage(a);
}
function findSelectedImage() {
  const a=activeAnnotation();if(!a || a.type!=='image')return;
  const previous={x:a.x,y:a.y,w:a.w,h:a.h};
  keepImageOnPage(a);
  const b=boundsFor(a);
  const stage=$('pageStage').getBoundingClientRect();
  const scroll=$('canvasScroll');const outer=scroll.getBoundingClientRect();
  const itemLeft=stage.left+b.left;
  const itemTop=stage.top+b.top;
  // Center the item without changing the document zoom or page.
  scroll.scrollTo({
    left:Math.max(0,scroll.scrollLeft+itemLeft-outer.left-(scroll.clientWidth-(b.width||0))/2),
    top:Math.max(0,scroll.scrollTop+itemTop-outer.top-(scroll.clientHeight-(b.height||0))/2),
    behavior:'smooth',
  });
  renderAnnotations();updateInspector();
  setStatus(previous.x!==a.x||previous.y!==a.y||previous.w!==a.w?'Image was outside the page and has been brought inside.':'Image located and highlighted. Drag it to the correct position.');
}
function boundsFor(a) {
  return annotationViewportBounds(a, state.viewport, state.scale);
}
function renderAnnotations() {
  const layer = $('annotationLayer'); layer.replaceChildren();
  const pg = activePage(); if (!pg || !state.viewport) return;
  for (const a of pg.annotations) {
    const el=document.createElement('div');
    const b=boundsFor(a); el.className=`annotation ${a.type}-annotation${a.id === state.selectedId?' selected':''}`;
    el.dataset.annotationId = a.id; el.style.left=`${b.left}px`; el.style.top=`${b.top}px`;
    if (b.width !== null) { el.style.width=`${b.width}px`; el.style.height=`${b.height}px`; }
    if (a.type === 'text') {
      el.textContent = a.text;
      el.style.fontSize=`${a.size * state.scale}px`;
      el.style.color=a.color;
      el.style.fontFamily='Helvetica, Arial, sans-serif';
      el.style.lineHeight='1.18';
    } else if (a.type === 'highlight' || a.type === 'cover') {
      el.style.background=a.color;
      el.style.opacity=String(a.opacity);
    } else if (a.type === 'image') {
      // Crop remains non-destructive: draw a clipped window into the original image.
      const c=normalizedCrop(a.crop);
      const im=document.createElement('img');im.src=a.dataUrl;im.alt='Inserted image';
      im.className='cropped-image';
      im.style.width=`${100/c.w}%`;im.style.height=`${100/c.h}%`;
      im.style.left=`${-100*c.x/c.w}%`;im.style.top=`${-100*c.y/c.h}%`;
      const windowEl=document.createElement('div');windowEl.className='image-window';windowEl.append(im);el.append(windowEl);
      if(a.id === state.selectedId && state.tool === 'select') {
        for (const corner of ['nw','ne','sw','se']) {
          const handle=document.createElement('button');handle.type='button';
          handle.className=`resize-handle handle-${corner}`;
          handle.setAttribute('aria-label',`Resize image from ${corner} corner`);
          handle.addEventListener('pointerdown',(e)=>beginResizeImage(e,a,corner));
          el.append(handle);
        }
      }
    }
    el.addEventListener('pointerdown', (e) => beginMoveAnnotation(e,a));
    layer.append(el);
  }
}
function addAnnotation(a) {
  const pg=activePage();
  const previousSelected=state.selectedId;
  const inserted={id:id(),...a};
  pg.annotations.push(inserted);
  state.selectedId=inserted.id;
  try {
    renderAnnotations(); updateInspector();
  } catch (error) {
    // Do not leave a hidden/ghost annotation when an upload cannot be placed.
    pg.annotations=pg.annotations.filter((item)=>item.id!==inserted.id);
    state.selectedId=previousSelected;
    try { renderAnnotations(); updateInspector(); } catch (_) { /* Preserve the original error. */ }
    throw error;
  }
}
function beginMoveAnnotation(e,a) {
  e.preventDefault(); e.stopPropagation();
  state.selectedId=a.id; renderAnnotations(); updateInspector();
  if (state.tool !== 'select') return;
  const old = {...a};
  state.dragging={id:a.id,startX:e.clientX,startY:e.clientY,old};
  window.addEventListener('pointermove', moveAnnotation);
  window.addEventListener('pointerup', endMoveAnnotation,{once:true});
}
function moveAnnotation(e) {
  if (!state.dragging || !state.viewport) return;
  const a=activeAnnotation(); if (!a) return;
  const scale=state.scale;
  const dx=(e.clientX-state.dragging.startX)/scale;
  const dy=(e.clientY-state.dragging.startY)/scale;
  a.x=state.dragging.old.x+dx;
  a.y=state.dragging.old.y-dy;
  if(a.type==='image')keepImageOnPage(a);
  renderAnnotations();
}
function endMoveAnnotation() {state.dragging=null; window.removeEventListener('pointermove',moveAnnotation); setStatus('Item moved.');}
function beginResizeImage(e,a,corner) {
  e.preventDefault();e.stopPropagation();
  const b=boundsFor(a);
  state.resizing={id:a.id,corner,startX:e.clientX,startY:e.clientY,box:b};
  window.addEventListener('pointermove',resizeImageMove);
  window.addEventListener('pointerup',endResizeImage,{once:true});
  setStatus('Drag the blue corner handle to resize. Release to keep the new size.');
}
function resizeImageMove(e) {
  const r=state.resizing;if(!r)return;
  const a=activeAnnotation();if(!a||a.id!==r.id)return;
  const b=resizeScreenRect(r.box,r.corner,e.clientX-r.startX,e.clientY-r.startY,$('lockAspect').checked);
  const p1=toPDF(b.left,b.top),p2=toPDF(b.left+b.width,b.top+b.height);
  a.x=Math.min(p1.x,p2.x);a.y=Math.min(p1.y,p2.y);
  a.w=Math.abs(p1.x-p2.x);a.h=Math.abs(p1.y-p2.y);
  keepImageOnPage(a);renderAnnotations();
  $('imageWidth').value=Math.round(a.w);$('imageHeight').value=Math.round(a.h);
}
function endResizeImage() {
  state.resizing=null;window.removeEventListener('pointermove',resizeImageMove);
  setStatus('Image resized. You can also enter an exact width or height in Properties.');
}

function updateInspector() {
  const a=activeAnnotation();
  const mode=a?.type || (state.tool === 'select' ? null : state.tool);
  $('emptyInspector').hidden=!!mode;
  $('textInspector').hidden=mode !== 'text';
  $('rectInspector').hidden=!['cover','highlight'].includes(mode);
  $('imageInspector').hidden=mode !== 'image';
  $('profileInspector').hidden=mode !== 'profile';
  $('selectionActions').hidden=!a;
  $('fillOpacity').parentElement?.classList?.toggle('cover',mode==='cover');
  $('textInput').value = a?.type === 'text' ? a.text : state.defaults.text;
  $('fontSize').value = a?.type === 'text' ? a.size : state.defaults.size;
  $('textColor').value = a?.type === 'text' ? a.color : state.defaults.color;
  $('fillColor').value = (a && ['cover','highlight'].includes(a.type)) ? a.color : mode === 'cover' ? '#ffffff' : state.defaults.rectColor;
  const opacity=Math.round((a && ['cover','highlight'].includes(a.type) ? a.opacity : mode === 'cover' ? 1 : state.defaults.opacity)*100);
  $('fillOpacity').value=opacity; $('opacityLabel').textContent=`${opacity}%`;
  if (a?.type === 'image') { $('imageWidth').value=Math.round(a.w); $('imageHeight').value=Math.round(a.h); }
  document.querySelector('.right-sidebar').classList.toggle('has-selection',!!a || mode === 'text');
}
function startDraw(e) {
  if (!state.pdf || !state.viewport) return;
  e.preventDefault();
  const pos=posOnPage(e);
  if (state.tool === 'profile') {
    const key=$('profileFieldSelect').value;
    const field=fieldOptions(state.profile).find(item=>item.key===key);
    if (!field) {setStatus('Please enter a profile value first (Auto-fill form).');return;}
    const size=9;const p=toPDF(pos.x,pos.y+size*state.scale);
    addAnnotation({type:'text',x:p.x,y:p.y,text:field.value,size,color:'#17283f'});
    setTool('select');setStatus('Saved detail inserted. Drag to adjust its position, or edit the text on the right.');
  } else if (state.tool === 'text') {
    const size=Number($('fontSize').value)||18;
    const p=toPDF(pos.x,pos.y+size*state.scale);
    addAnnotation({type:'text',x:p.x,y:p.y,text:$('textInput').value || state.defaults.text,size,color:$('textColor').value});
    setTool('select'); setStatus('Text added. Select it to change the wording or position.');
  } else if (state.tool === 'image') {
    if (!state.pendingImage) { $('imageInput').click(); return; }
    const ratio=state.pendingImage.height/state.pendingImage.width;
    const bounds=pageBounds();
    const width=Math.min(125,bounds.width*.32,bounds.height*.3/ratio), height=width*ratio;
    const p=toPDF(pos.x,pos.y+height*state.scale);
    const a={type:'image',x:p.x,y:p.y,w:width,h:height,bytes:state.pendingImage.bytes,dataUrl:state.pendingImage.dataUrl,mime:state.pendingImage.mime,crop:fullCrop(),naturalWidth:state.pendingImage.width,naturalHeight:state.pendingImage.height};
    keepImageOnPage(a);addAnnotation(a);
    state.pendingImage=null;setTool('select');findSelectedImage();
    setStatus('Image added and selected. Drag to move, or adjust width under Properties.');
  } else if (['highlight','cover'].includes(state.tool)) {
    state.drawing={start:pos,end:pos,type:state.tool};
    const preview=document.createElement('div');preview.className='draw-preview';
    preview.id='drawPreview'; $('drawLayer').append(preview);
    drawPreview();
    window.addEventListener('pointermove', moveDraw);
    window.addEventListener('pointerup', finishDraw,{once:true});
  }
}
function drawPreview() {
  const d=state.drawing, el=$('drawPreview');if(!d||!el)return;
  const x=Math.min(d.start.x,d.end.x),y=Math.min(d.start.y,d.end.y),w=Math.abs(d.end.x-d.start.x),h=Math.abs(d.end.y-d.start.y);
  Object.assign(el.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`,height:`${h}px`});
}
function moveDraw(e) { if (!state.drawing) return; state.drawing.end=posOnPage(e); drawPreview(); }
function finishDraw(e) {
  window.removeEventListener('pointermove',moveDraw);
  const d=state.drawing; state.drawing=null; $('drawPreview')?.remove();
  if(!d)return;
  d.end=posOnPage(e);
  if(Math.abs(d.start.x-d.end.x)<5||Math.abs(d.start.y-d.end.y)<5){setStatus('Drag to define a rectangle.');return;}
  const a=toPDF(d.start.x,d.start.y),b=toPDF(d.end.x,d.end.y);
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
  addAnnotation({type:d.type,x,y,w,h,color:d.type==='cover'?'#ffffff':$('fillColor').value,opacity:d.type==='cover'?1:($('fillOpacity').value/100)});
  setTool('select');setStatus(d.type==='cover'?'Cover added. This is not secure redaction.':'Highlight added.');
}
async function imageFromFile(file) {
  if(!file)return;
  if(!['image/png','image/jpeg'].includes(file.type)){setStatus('Choose a PNG or JPG image.');return;}
  if(file.size>8*1024*1024){setStatus('Please choose an image under 8 MB.');return;}
  const bytes=new Uint8Array(await file.arrayBuffer());
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=dataUrl;});
  if(!state.pdf || !activePage()){setStatus('Open a PDF before inserting an image.');return;}
  const bounds=pageBounds();
  const maxSize=Math.min(125,bounds.width*.32);
  const ratio=img.naturalHeight/img.naturalWidth;
  const width=Math.min(maxSize,bounds.height*.3/ratio);
  const a={type:'image',x:0,y:0,w:width,h:width*ratio,bytes,dataUrl,mime:file.type,crop:fullCrop(),naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight};
  centerImageAtVisiblePage(a);
  addAnnotation(a);
  setTool('select');
  findSelectedImage();
  setStatus('Image added to this page and selected. Drag it into place; adjust width under Properties.');
}

/** Render only the visible crop to a PNG for export, leaving the source untouched. */
async function croppedImageBytes(a) {
  const image=new Image();
  image.src=a.dataUrl;
  await (image.decode ? image.decode() : new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;}));
  const c=normalizedCrop(a.crop),nw=image.naturalWidth,nh=image.naturalHeight;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(nw*c.w));canvas.height=Math.max(1,Math.round(nh*c.h));
  const context=canvas.getContext('2d');
  if(!context)throw new Error('Image cropping canvas is unavailable.');
  context.drawImage(image,nw*c.x,nh*c.y,nw*c.w,nh*c.h,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Cannot export cropped image.')),'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
const cropAspect=()=>{
  const value=$('cropPreset').value;
  return value==='square'?1:value==='passport'?(35/45):value==='portrait'?(4/5):null;
};
function updateCropPreview() {
  const edit=state.cropEditing;if(!edit)return;
  const c=normalizedCrop(edit.crop),el=$('cropSelection');
  Object.assign(el.style,{left:`${c.x*100}%`,top:`${c.y*100}%`,width:`${c.w*100}%`,height:`${c.h*100}%`});
  const ratio=croppedAspectRatio(c,edit.naturalWidth,edit.naturalHeight);
  $('cropInfo').textContent=`Crop: ${Math.round(c.w*100)}% × ${Math.round(c.h*100)}% of original · ${ratio.toFixed(2)}:1`;
}
function openCropEditor() {
  const a=activeAnnotation();if(!a || a.type!=='image')return;
  state.cropEditing={id:a.id,crop:normalizedCrop(a.crop),naturalWidth:a.naturalWidth,naturalHeight:a.naturalHeight,drag:null};
  $('cropPreset').value='free';
  $('cropPreview').src=a.dataUrl;
  $('cropDialog').hidden=false;
  updateCropPreview();
}
function closeCropEditor() {
  state.cropEditing=null;$('cropDialog').hidden=true;
}
function cropPosition(e) {
  const r=$('cropPreview').getBoundingClientRect();
  return {x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)};
}
function beginCropDrag(e) {
  const edit=state.cropEditing;if(!edit)return;
  e.preventDefault();e.stopPropagation();
  const pos=cropPosition(e);
  edit.drag={corner:e.target.dataset.cropCorner || null,original:{...edit.crop},start:pos};
  window.addEventListener('pointermove',moveCropSelection);
  window.addEventListener('pointerup',endCropSelection,{once:true});
}
function moveCropSelection(e) {
  const edit=state.cropEditing;if(!edit?.drag)return;
  const pos=cropPosition(e),d=edit.drag;
  edit.crop=d.corner ? resizeCrop(d.original,d.corner,pos.x,pos.y,edit.naturalWidth,edit.naturalHeight,cropAspect())
    : moveCrop(d.original,pos.x-d.start.x,pos.y-d.start.y);
  updateCropPreview();
}
function endCropSelection() {
  window.removeEventListener('pointermove',moveCropSelection);
  if(state.cropEditing)state.cropEditing.drag=null;
}
function applyCrop() {
  const edit=state.cropEditing;if(!edit)return;
  const a=activeAnnotation();if(!a||a.id!==edit.id){closeCropEditor();return;}
  a.crop=normalizedCrop(edit.crop);
  // Cropping is a framing operation; reset the image ratio to the cropped photo.
  const aspect=croppedAspectRatio(a.crop,edit.naturalWidth,edit.naturalHeight);
  a.h=a.w/aspect;
  keepImageOnPage(a);closeCropEditor();renderAnnotations();updateInspector();
  setStatus('Crop applied. Drag its corners to resize, then Export PDF to save the cropped photo.');
}
const PROFILE_GROUPS = {
  education: [['institution','Name of institution'],['from','From'],['to','To'],['qualification','Qualification']],
  training: [['institution','Institution'],['from','From'],['to','To'],['certification','Certification']],
  employment: [['employer','Employer name / address'],['from','From'],['to','To'],
    ['startingPosition','Starting position'],['lastPosition','Last position'],
    ['duties','Responsibilities (short summary)'],['reason','Reason for leaving'],
    ['startingSalary','Starting salary (optional)'],['lastSalary','Last salary (optional)']],
  skills: [['name','Computer skill'],['level','Level']],
};

function addProfileRow(group, values={}) {
  const host=$(group+'Rows');if (!host)return;
  const row=document.createElement('section');row.className='profile-row';row.dataset.profileGroup=group;
  const heading=document.createElement('div');heading.className='profile-row-head';
  const title=document.createElement('span');title.textContent=`${group[0].toUpperCase()+group.slice(1)} ${host.children.length+1}`;
  const remove=document.createElement('button');remove.type='button';remove.className='button remove-row subtle';remove.textContent='Remove';
  remove.addEventListener('click',()=>{row.remove();numberProfileRows(group);});
  heading.append(title,remove);row.append(heading);
  const fields=document.createElement('div');fields.className='profile-row-grid';
  for(const [key,labelText] of PROFILE_GROUPS[group]) {
    const label=document.createElement('label');label.textContent=labelText;
    let input;
    if(key==='level') {
      input=document.createElement('select');
      for(const [v,l] of [['','Choose level'],['advanced','Advanced'],['intermediate','Intermediate'],['elementary','Elementary']]){
        const option=document.createElement('option');option.value=v;option.textContent=l;input.append(option);
      }
    } else if(key==='duties') {
      input=document.createElement('textarea');input.rows=3;label.classList.add('wide');
    } else input=document.createElement('input');
    input.dataset.rowKey=key;input.value=values[key]||'';
    label.append(input);fields.append(label);
  }
  row.append(fields);host.append(row);
}
function numberProfileRows(group) {
  $(group+'Rows')?.querySelectorAll('.profile-row').forEach((row,i)=>{
    row.querySelector('.profile-row-head span').textContent=`${group[0].toUpperCase()+group.slice(1)} ${i+1}`;
  });
}
function readProfileForm() {
  const raw=emptyProfile();
  $('autofillDialog').querySelectorAll('[data-profile-key]').forEach(el=>raw[el.dataset.profileKey]=el.value);
  for(const group of Object.keys(PROFILE_GROUPS)) {
    raw[group]=Array.from($(group+'Rows').querySelectorAll('[data-profile-group]')).map(row=>{
      const entry={};row.querySelectorAll('[data-row-key]').forEach(el=>entry[el.dataset.rowKey]=el.value);
      return entry;
    }).filter(entry=>Object.values(entry).some(v=>String(v).trim()));
  }
  return cleanProfile(raw);
}
function writeProfileForm(profile) {
  const p=cleanProfile(profile);
  $('autofillDialog').querySelectorAll('[data-profile-key]').forEach(el=>el.value=p[el.dataset.profileKey]||'');
  for(const group of Object.keys(PROFILE_GROUPS)) {
    $(group+'Rows').replaceChildren();
    p[group].forEach(values=>addProfileRow(group,values));
  }
}
function profileMessage(text) {$('profileStatus').textContent=text;}
function updateProfileFieldSelect() {
  const choices=fieldOptions(state.profile),previous=$('profileFieldSelect').value;
  $('profileFieldSelect').replaceChildren();
  if(!choices.length){const option=document.createElement('option');option.value='';option.textContent='Enter details in Auto-fill form';$('profileFieldSelect').append(option);return;}
  for(const f of choices){const o=document.createElement('option');o.value=f.key;o.textContent=f.label;$('profileFieldSelect').append(o);}
  if(choices.some(c=>c.key===previous))$('profileFieldSelect').value=previous;
}
function clearResumePreview(){
  state.resumeImport=null;
  $('resumePreview').hidden=true;
  $('resumePreviewDetails').replaceChildren();
  $('resumeWarnings').replaceChildren();
  $('resumeOverwrite').checked=false;
}
function showResumePreview(file,result){
  const p=result.profile;
  const detail=$('resumePreviewDetails');detail.replaceChildren();
  const fields=[['Full name',p.fullName],['Email',p.email],['Mobile',p.phone],['Address',p.address],['Nationality',p.nationality]]
    .filter(([,value])=>Boolean(value));
  const dl=document.createElement('dl');
  for(const [label,value] of fields){
    const dt=document.createElement('dt');dt.textContent=label;
    const dd=document.createElement('dd');dd.textContent=value;
    dl.append(dt,dd);
  }
  detail.append(dl);
  const groups=[
    ['education','Education',e=>[e.qualification,e.institution,[e.from,e.to].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')],
    ['employment','Employment',e=>[e.lastPosition,e.employer,[e.from,e.to].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')],
    ['training','Training',e=>[e.certification,e.institution].filter(Boolean).join(' · ')],
    ['skills','Skills',e=>e.name],
  ];
  for(const [group,label,format] of groups){
    if(!p[group].length)continue;
    const heading=document.createElement('strong');heading.textContent=label+' ('+p[group].length+')';
    const description=document.createElement('p');
    description.textContent=group==='employment'||group==='education'||group==='training'
      ? 'Select only entries you have checked against your résumé. Nothing in this section is selected automatically.'
      : 'Uncheck any incorrect skills.';
    const list=document.createElement('div');list.className='resume-records';
    for(const [index,entry] of p[group].entries()){
      const row=document.createElement('label');row.className='resume-record';
      const checkbox=document.createElement('input');checkbox.type='checkbox';
      checkbox.dataset.resumeGroup=group;checkbox.dataset.resumeIndex=String(index);
      checkbox.checked=group==='skills';
      const value=document.createElement('span');value.textContent=format(entry);
      row.append(checkbox,value);list.append(row);
    }
    detail.append(heading,description,list);
  }
  $('resumePreviewTitle').textContent='Review '+file.name+' ('+result.recognized+' extracted items)';
  const list=$('resumeWarnings');list.replaceChildren();
  for(const warning of result.warnings){const li=document.createElement('li');li.textContent=warning;list.append(li);}
  $('resumePreview').hidden=false;
}
async function handleResumeUpload(file){
  if(!file)return;
  clearResumePreview();
  $('importResumeBtn').disabled=true;
  profileMessage(`Reading ${file.name} locally…`);
  try{
    const text=await readResumeFile(file,pdfjsLib);
    const result=extractResumeProfile(text);
    if(!result.recognized){
      profileMessage('No reliable profile details detected. '+(result.warnings[0] || 'Please use a text-based résumé, or enter fields manually.'));
      return;
    }
    state.resumeImport=result;
    showResumePreview(file,result);
    profileMessage(`${result.recognized} résumé detail(s) detected. Review the preview and choose “Use extracted details.” Nothing has been inserted into the PDF yet.`);
  }catch(e){
    console.warn('Local résumé import failed:',e);
    profileMessage(`Unable to read résumé: ${e.message || e}. If this is a scanned PDF, OCR is not supported yet.`);
  }finally{$('importResumeBtn').disabled=false;}
}
function applyImportedResume(){
  if(!state.resumeImport)return;
  // Read any unsaved edits before merging. We never overwrite profile inputs silently.
  const overwrite=$('resumeOverwrite').checked;
  // Import only approved records; unverified education and work start unchecked.
  const accepted=cleanProfile(state.resumeImport.profile);
  for(const group of ['education','employment','training','skills']){
    accepted[group]=accepted[group].filter((item,index)=>
      $('resumePreviewDetails').querySelector('input[data-resume-group="'+group+'"][data-resume-index="'+index+'"]')?.checked===true);
  }
  const merge=mergeResumeProfile(readProfileForm(),accepted,{overwrite});
  writeProfileForm(merge.profile);
  state.profile=merge.profile;
  updateProfileFieldSelect();
  clearResumePreview();
  profileMessage(`${merge.changed.length} profile detail(s) added or updated. Review the form sections, then select “Auto-fill matching fields” to populate a supported PDF. This profile is not saved on this device unless you explicitly click Save.`);
}

function openProfileEditor() {
  writeProfileForm(state.profile);
  $('profileSupport').textContent=state.pdf
    ? 'This editor can automatically map the 4-page PROPPY job application. Other layouts: choose “Place fields manually.”'
    : 'Enter details now, then open the PDF. Auto-fill requires a recognized template.';
  profileMessage('Review every field. Blank answers are left blank; sensitive declarations are never guessed.');
  $('autofillDialog').showModal();
}
async function applyProfileToPDF() {
  if(!state.pdf){profileMessage('Open the PDF first, then click Auto-fill matching fields.');return;}
  const profile=readProfileForm();
  const pdfPages=[];
  profileMessage('Recognizing form layout…');
  try{
    for(let i=0;i<state.pdf.numPages;i++){
      const page=await state.pdf.getPage(i+1),viewport=page.getViewport({scale:1});
      const content=await page.getTextContent();
      pdfPages.push({width:viewport.width,height:viewport.height,text:content.items.map(x=>x.str).join(' ')});
    }
  } catch(e) {profileMessage('Could not inspect PDF: '+e.message);return;}
  if(!isProppyTemplate(pdfPages)){
    profileMessage('This layout is not a verified template. No fields were changed. Use “Place fields manually” for this PDF.');
    return;
  }
  const fill=buildProppyAnnotations(profile);
  if(!fill.items.length){profileMessage(fill.skipped.length
    ? `No fields fit. Adjust long answers: ${fill.skipped.slice(0,3).join(', ')}.`
    : 'Enter at least one profile detail. Blank profile fields are not filled.');return;}
  // Applying a second time intentionally replaces earlier *automatically*
  // placed fields, leaving manual text and images untouched.
  for(const pg of state.pages)pg.annotations=pg.annotations.filter(a=>!a.autoFill);
  for(const a of fill.items){
    const page=state.pages.find(p=>p.sourceIndex===a.page);
    if(!page)continue;
    const {page:pageIndex,...rest}=a;
    page.annotations.push({id:id(),...rest});
  }
  state.profile=profile;updateProfileFieldSelect();
  $('autofillDialog').close();state.selectedId=null;setTool('select');
  await renderPage();
  const warning=fill.skipped.length?` ${fill.skipped.length} long answers did not fit and were skipped; shorten them in your profile.`:'';
  setStatus(`Auto-filled ${fill.items.length} answers across 4 pages. Review every page before exporting.${warning}`);
  if(fill.skipped.length){window.alert(`Auto-fill completed, but ${fill.skipped.length} answer(s) did not fit and were NOT inserted.\n\n${fill.skipped.slice(0,10).join('\n')}\n\nShorten these answers or place them manually. Review all four pages before export.`);}
}
function bindProfile() {
  try {
    const raw=window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if(raw)state.profile=cleanProfile(JSON.parse(raw));
  } catch(e) {console.warn('Profile storage unavailable:',e);}
  updateProfileFieldSelect();
  $('autoFillBtn').addEventListener('click',openProfileEditor);
  $('clearEmploymentRows').addEventListener('click',()=>{
    if(!window.confirm('Clear every employment row in the current form? This cannot be undone, but does not change an already exported PDF.'))return;
    $('employmentRows').replaceChildren();
    state.profile=readProfileForm();updateProfileFieldSelect();
    profileMessage('Employment entries cleared from the current profile. Re-import and select only verified job records. Save on this device to update a previously saved profile.');
  });
  $('importResumeBtn').addEventListener('click',()=> $('resumeInput').click());
  $('resumeInput').addEventListener('change',async(e)=>{
    const file=e.target.files?.[0];e.target.value='';
    await handleResumeUpload(file);
  });
  $('discardResumeBtn').addEventListener('click',()=>{clearResumePreview();profileMessage('Imported résumé suggestions discarded. Your career profile was not changed.');});
  $('applyResumeBtn').addEventListener('click',applyImportedResume);
  $('closeProfileBtn').addEventListener('click',()=>{state.profile=readProfileForm();updateProfileFieldSelect();$('autofillDialog').close();});
  $('autofillDialog').addEventListener('close',()=>{
    // The modal can also close using Escape. Keep unsaved work in this session.
    if($('autofillDialog').returnValue!=='forget'){state.profile=readProfileForm();updateProfileFieldSelect();}
  });
  document.querySelectorAll('[data-add-group]').forEach(btn=>btn.addEventListener('click',()=>addProfileRow(btn.dataset.addGroup)));
  $('saveProfileBtn').addEventListener('click',()=>{
    const p=readProfileForm();
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY,JSON.stringify(safeToStore(p)));
      state.profile=p;updateProfileFieldSelect();
      profileMessage('Career profile saved on this device (unencrypted browser storage). Identity card / passport number was not stored.');
    } catch(e){profileMessage('Could not save locally (browser storage blocked or full). You can still fill this document.');}
  });
  $('forgetProfileBtn').addEventListener('click',()=>{
    if(!window.confirm('Forget your locally saved career profile and clear the form?'))return;
    try{window.localStorage.removeItem(PROFILE_STORAGE_KEY);}catch(_){}
    state.profile=emptyProfile();writeProfileForm(state.profile);updateProfileFieldSelect();clearResumePreview();
    profileMessage('Saved profile cleared. This does not remove answers already placed in the open PDF.');
  });
  $('demoProfileBtn').addEventListener('click',()=>{
    if(!window.confirm('Replace the current fields with fictional test data?'))return;
    writeProfileForm({postApplied:'Example position (test only)',fullName:'DEMO APPLICANT',email:'demo@example.com',phone:'012-0000000',address:'123 Example Street, Sample Town',nationality:'Malaysian',
      education:[{institution:'Example University',from:'2015',to:'2019',qualification:'BSc Computing'}],
      employment:[{employer:'Example Company',from:'01/2020',to:'12/2024',startingPosition:'Software Engineer',lastPosition:'Software Engineer',duties:'Developed and maintained web applications. Collaborated on software testing and documentation.',reason:'Career progression'}],
      skills:[{name:'JavaScript',level:'advanced'}],expectedSalary:'RM 5,000',noticePeriod:'1 month'});
    profileMessage('Fictional DEMO data loaded. Replace every example before submitting a real application.');
  });
  $('manualProfileBtn').addEventListener('click',()=>{
    if(!state.pdf){profileMessage('Open a PDF before placing fields.');return;}
    const p=readProfileForm();if(!fieldOptions(p).length){profileMessage('Enter at least one detail to place.');return;}
    state.profile=p;updateProfileFieldSelect();$('autofillDialog').close();state.selectedId=null;setTool('profile');
  });
  $('applyAutoFillBtn').addEventListener('click',applyProfileToPDF);
}

async function exportPDF() {
  if(!state.bytes||!state.pages.length)return;
  $('saveBtn').disabled=true;setStatus('Creating edited PDF…');
  try {
    const source=await PDFDocument.load(state.bytes.slice(),{updateMetadata:false});
    const font=await source.embedFont(StandardFonts.Helvetica);
    for (const pg of state.pages) {
      const page=source.getPage(pg.sourceIndex);
      for (const a of pg.annotations) {
        if(a.type==='text') {
          page.drawText(a.text,{x:a.x,y:a.y,font,size:a.size,color:hexRgb(a.color),lineHeight:a.size*1.18});
        } else if(a.type==='cover' || a.type==='highlight') {
          page.drawRectangle({x:a.x,y:a.y,width:a.w,height:a.h,color:hexRgb(a.color),opacity:a.opacity,borderWidth:0});
        } else if(a.type==='image') {
          const bytes=isFullCrop(a.crop) ? a.bytes : await croppedImageBytes(a);
          const embedded=!isFullCrop(a.crop) || a.mime==='image/png' ? await source.embedPng(bytes) : await source.embedJpg(bytes);
          page.drawImage(embedded,{x:a.x,y:a.y,width:a.w,height:a.h});
        }
      }
    }
    const retained=new Set(state.pages.map(p=>p.sourceIndex));
    for(let i=source.getPageCount()-1;i>=0;i--)if(!retained.has(i))source.removePage(i);
    const result=await source.save();
    const url=URL.createObjectURL(new Blob([result],{type:'application/pdf'}));
    const anchor=document.createElement('a');anchor.href=url;
    anchor.download=state.filename.replace(/\.pdf$/i,'')+'-edited.pdf';
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatus('Edited PDF downloaded. Your original file was not changed.');
  } catch(e) {
    console.error(e);
    const detail=String(e.message || e);
    setStatus('Export failed. '+(detail.includes('WinAnsi')?'This font cannot export certain characters; try plain Latin characters.':detail));
  } finally {updateToolbar();}
}
function deleteSelected() {
  if(!activeAnnotation())return;
  activePage().annotations=activePage().annotations.filter(a=>a.id!==state.selectedId);
  state.selectedId=null;renderAnnotations();updateInspector();setStatus('Item deleted.');
}
function bind() {
  const open=()=>$('pdfInput').click();
  $('openBtn').addEventListener('click',open);$('welcomeOpen').addEventListener('click',open);
  $('pdfInput').addEventListener('change',async(e)=>{await openPDF(e.target.files?.[0]);e.target.value='';});
  $('imageInput').addEventListener('change',async(e)=>{try{await imageFromFile(e.target.files?.[0]);}catch(err){setStatus('Could not insert image: '+err.message);console.error(err);}e.target.value='';});
  $('saveBtn').addEventListener('click',exportPDF);
  $('prevBtn').addEventListener('click',()=>{if(state.pageIndex>0){state.pageIndex--;state.selectedId=null;renderPage();}});
  $('nextBtn').addEventListener('click',()=>{if(state.pageIndex<state.pages.length-1){state.pageIndex++;state.selectedId=null;renderPage();}});
  $('removePageBtn').addEventListener('click',()=>{
    if(state.pages.length<=1)return;
    state.pages.splice(state.pageIndex,1);
    state.pageIndex=Math.min(state.pageIndex,state.pages.length-1);
    state.selectedId=null;renderPage();setStatus('Page removed from export. The original PDF is unchanged.');
  });
  document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
  $('drawLayer').addEventListener('pointerdown',startDraw);
  $('pageStage').addEventListener('pointerdown',(e)=>{if(e.target===$('pdfCanvas')||e.target===$('annotationLayer')){state.selectedId=null;renderAnnotations();updateInspector();}});
  $('findSelectedImage').addEventListener('click',findSelectedImage);
  $('deleteSelection').addEventListener('click',deleteSelected);
  $('deselect').addEventListener('click',()=>{state.selectedId=null;renderAnnotations();updateInspector();});
  $('textInput').addEventListener('input',()=>{const a=activeAnnotation();if(a?.type==='text'){a.text=$('textInput').value;renderAnnotations();}else state.defaults.text=$('textInput').value;});
  $('fontSize').addEventListener('input',()=>{const v=Math.max(6,Math.min(100,Number($('fontSize').value)||18));const a=activeAnnotation();if(a?.type==='text'){a.size=v;renderAnnotations();}else state.defaults.size=v;});
  $('textColor').addEventListener('input',()=>{const a=activeAnnotation();if(a?.type==='text'){a.color=$('textColor').value;renderAnnotations();}else state.defaults.color=$('textColor').value;});
  $('fillColor').addEventListener('input',()=>{const a=activeAnnotation();if(a && ['cover','highlight'].includes(a.type)){a.color=$('fillColor').value;renderAnnotations();}else state.defaults.rectColor=$('fillColor').value;});
  $('fillOpacity').addEventListener('input',()=>{const opacity=Number($('fillOpacity').value)/100;$('opacityLabel').textContent=`${Math.round(opacity*100)}%`;const a=activeAnnotation();if(a && ['cover','highlight'].includes(a.type)){a.opacity=opacity;renderAnnotations();}else state.defaults.opacity=opacity;});
  $('imageWidth').addEventListener('change',()=>{
    const a=activeAnnotation();if(a?.type!=='image')return;
    const w=clamp(Number($('imageWidth').value)||a.w,10,1200);
    if($('lockAspect').checked)a.h*=w/a.w;
    a.w=w;keepImageOnPage(a);renderAnnotations();updateInspector();
  });
  $('imageHeight').addEventListener('change',()=>{
    const a=activeAnnotation();if(a?.type!=='image')return;
    const h=clamp(Number($('imageHeight').value)||a.h,10,1200);
    if($('lockAspect').checked)a.w*=h/a.h;
    a.h=h;keepImageOnPage(a);renderAnnotations();updateInspector();
  });
  $('cropImageBtn').addEventListener('click',openCropEditor);
  $('cropCancel').addEventListener('click',closeCropEditor);
  $('cropApply').addEventListener('click',applyCrop);
  $('cropReset').addEventListener('click',()=>{if(state.cropEditing){state.cropEditing.crop=fullCrop();if(cropAspect())state.cropEditing.crop=centerCropToAspect(state.cropEditing.crop,state.cropEditing.naturalWidth,state.cropEditing.naturalHeight,cropAspect());updateCropPreview();}});
  $('cropPreset').addEventListener('change',()=>{const e=state.cropEditing;if(e){e.crop=centerCropToAspect(e.crop,e.naturalWidth,e.naturalHeight,cropAspect());updateCropPreview();}});
  $('cropSelection').addEventListener('pointerdown',beginCropDrag);
  $('cropDialog').addEventListener('pointerdown',e=>{if(e.target===$('cropDialog'))closeCropEditor();});
  const dropZone=$('canvasScroll');
  dropZone.addEventListener('dragover',(e)=>{e.preventDefault();dropZone.style.outline='3px dashed #4279ec';});
  dropZone.addEventListener('dragleave',()=>dropZone.style.outline='');
  dropZone.addEventListener('drop',(e)=>{e.preventDefault();dropZone.style.outline='';const file=Array.from(e.dataTransfer.files).find(f=>f.name.toLowerCase().endsWith('.pdf'));if(file)openPDF(file);else setStatus('Drop a PDF file to open it.');});
  bindProfile();
  let resizeTimeout;window.addEventListener('resize',()=>{clearTimeout(resizeTimeout);resizeTimeout=setTimeout(()=>{if(state.pdf)renderPage();},200);});
  window.addEventListener('keydown',(e)=>{
    const tag=document.activeElement?.tagName;
    if(['INPUT','TEXTAREA'].includes(tag)||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='Escape'){if(state.cropEditing){closeCropEditor();return;}state.selectedId=null;setTool('select');renderAnnotations();}
    if((e.key==='Delete'||e.key==='Backspace')&&activeAnnotation())deleteSelected();
    const shortcuts={v:'select',t:'text',h:'highlight',c:'cover',i:'image',p:'profile'};
    if(shortcuts[e.key.toLowerCase()])setTool(shortcuts[e.key.toLowerCase()]);
    if(e.key==='ArrowLeft'&&!$('prevBtn').disabled)$('prevBtn').click();
    if(e.key==='ArrowRight'&&!$('nextBtn').disabled)$('nextBtn').click();
  });
}
bind(); updateToolbar(); updateInspector();
