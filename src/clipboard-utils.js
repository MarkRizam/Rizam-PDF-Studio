/** Local, reversible clipboard helpers. Never uploads document content. */
export function preparePastedText(raw, maxChars=60, maxLines=52){
  const original=String(raw??'').replace(/\r\n?/g,'\n').trim();
  if(!original)return {text:'',lines:0,error:'Clipboard has no text.'};
  // A pasted document can be too large to fit the page. Never silently cut it.
  if(original.length>8000)return {text:'',lines:0,error:'Text is too long for one PDF page. Paste a shorter section.'};
  const width=Math.max(10,Math.floor(Number(maxChars)||60));
  const lines=[];
  for(const paragraph of original.split('\n')){
    if(!paragraph.trim()){lines.push('');continue;}
    let line='';
    for(const word of paragraph.trim().split(/\s+/)){
      let rest=word;
      while(rest.length>width){
        if(line){lines.push(line);line='';}
        lines.push(rest.slice(0,width));rest=rest.slice(width);
      }
      if(!rest)continue;
      if(line.length+rest.length+1>width){lines.push(line);line=rest;}
      else line=line?line+' '+rest:rest;
    }
    if(line)lines.push(line);
  }
  if(lines.length>maxLines)return {text:'',lines:0,error:'Text will not fit on this page. Paste a shorter section.'};
  return {text:lines.join('\n'),lines:lines.length,error:null};
}

export function copyAnnotationForPage(annotation,bounds,offset=18){
  if(!annotation || !bounds)return null;
  const {id,...properties}=annotation;
  // Keep data URL/bytes attached to the copied image, but clone editable crop state.
  const copy={...properties};
  if(properties.crop)copy.crop={...properties.crop};
  const width=copy.w??0,height=copy.h??0;
  const minX=bounds.minX??0,minY=bounds.minY??0;
  const maxX=bounds.maxX??minX+(bounds.width||595);
  const maxY=bounds.maxY??minY+(bounds.height||842);
  copy.x=Math.min(maxX-Math.max(width,1),Math.max(minX,Number(copy.x||0)+offset));
  copy.y=Math.max(minY,Math.min(maxY-Math.max(height,0),Number(copy.y||0)-offset));
  if(copy.x<minX)copy.x=minX;
  if(copy.y<minY)copy.y=minY;
  return copy;
}
