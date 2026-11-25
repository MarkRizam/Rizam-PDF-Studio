'use strict';
const {app,BrowserWindow,shell}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {findPdfArgument,MAX_PDF_SIZE}=require('./pdf-path.cjs');
let mainWindow=null;
let rendererReady=false;
const pendingPaths=[];

function addPdfToQueue(filename) {
  const selected=findPdfArgument([filename]);
  if(!selected)return;
  pendingPaths.push(selected);
  deliverQueuedPdfs();
}
function deliverQueuedPdfs(){
  if(!mainWindow || mainWindow.isDestroyed() || !rendererReady)return;
  while(pendingPaths.length){
    const filename=pendingPaths.shift();
    try {
      const bytes=fs.readFileSync(filename);
      if(!bytes.length || bytes.length>MAX_PDF_SIZE)continue;
      mainWindow.webContents.send('rizam:open-pdf',{
        name:path.basename(filename),base64:bytes.toString('base64'),
      });
    } catch (err) { console.warn('Unable to open selected PDF:',err.message); }
  }
}
function focusMainWindow(){
  if(!mainWindow || mainWindow.isDestroyed())return;
  if(mainWindow.isMinimized())mainWindow.restore();
  mainWindow.show();mainWindow.focus();
}
function createMainWindow(){
  mainWindow=new BrowserWindow({
    width:1440,height:900,minWidth:900,minHeight:620,
    title:'Rizam PDF Studio',backgroundColor:'#f5f7fa',
    show:false,
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),
      nodeIntegration:false,contextIsolation:true,sandbox:true,
      webSecurity:true,
    },
  });
  mainWindow.once('ready-to-show',()=>mainWindow?.show());
  // The packaged editor runs entirely from its own local files.
  const entry=path.join(__dirname,'..','dist','index.html');
  mainWindow.loadFile(entry).catch(err=>console.error('Cannot load desktop application:',err));
  mainWindow.webContents.on('did-finish-load',()=>{
    rendererReady=true;
    deliverQueuedPdfs();
  });
  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(()=>{});
    return {action:'deny'};
  });
  mainWindow.webContents.on('will-navigate',(event,url)=>{
    if(!url.startsWith('file://'))event.preventDefault();
  });
  mainWindow.on('closed',()=>{mainWindow=null;rendererReady=false;});
}

const primary=app.requestSingleInstanceLock();
if(!primary)app.quit();
else{
  app.on('second-instance',(_event,argv)=>{
    const filename=findPdfArgument(argv);
    if(filename)addPdfToQueue(filename);
    focusMainWindow();
  });
  app.on('open-file',(event,filename)=>{
    event.preventDefault();
    addPdfToQueue(filename);
    focusMainWindow();
  });
  app.whenReady().then(()=>{
    const startupFile=findPdfArgument(process.argv.slice(1));
    if(startupFile)pendingPaths.push(startupFile);
    createMainWindow();
    app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createMainWindow();});
  });
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}
