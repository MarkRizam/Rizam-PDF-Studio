'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MAX_PDF_SIZE = 60 * 1024 * 1024;

/** Recognize only a real, accessible PDF file passed by Windows as an argument. */
function findPdfArgument(args, {existsSync=fs.existsSync, statSync=fs.statSync}={}) {
  for(const raw of Array.isArray(args)?args:[]) {
    if(typeof raw!=='string' || !/\.pdf$/i.test(raw))continue;
    const full=path.resolve(raw);
    try {
      if(!existsSync(full))continue;
      const info=statSync(full);
      if(info.isFile() && info.size>0 && info.size<=MAX_PDF_SIZE)return full;
    } catch { /* A stale or unavailable path is ignored. */ }
  }
  return null;
}
module.exports={findPdfArgument,MAX_PDF_SIZE};
