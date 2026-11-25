'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const pending=[];
let receiver=null;

ipcRenderer.on('rizam:open-pdf', (_event,payload)=>{
  if(!payload || typeof payload.name!=='string' || typeof payload.base64!=='string')return;
  if(receiver)receiver(payload);
  else pending.push(payload);
});

// Provide only one narrow, read-only bridge; no Node or filesystem access.
contextBridge.exposeInMainWorld('rizamDesktop', {
  onOpenPDF(callback) {
    if(typeof callback!=='function')return;
    receiver=callback;
    while(pending.length)receiver(pending.shift());
  }
});
