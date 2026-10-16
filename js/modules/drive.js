/**
 * ============================================================
 * AERCOM CRM v2
 * Google Drive Module
 * Migrado tal cual desde index.html (Sprint 15)
 * ============================================================
 *
 * Responsabilidad: integración con Google Drive vía Google
 * Identity Services (OAuth2 implícito) — conexión, creación de
 * la estructura de carpetas ("Aercom Gestion/Reportes",
 * ".../Importaciones"), sincronización de `aercom-data.json`
 * (carga al conectar + guardado con debounce), subida de
 * archivos (usada por reportes/exportaciones), y el intento de
 * reconexión silenciosa al arrancar la app.
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, toast(), today(), markSaved(), markUnsaved() (index.html)
 *   _parseImportedData(), _applyImportedData(), STORAGE_KEY (js/storage.js)
 *
 * Relación con persist() (NO migrada, sigue en index.html):
 *   `persist()` es quien LLAMA a `_scheduleDriveSave()` (migrada
 *   acá) después de cada guardado exitoso — la relación es
 *   unidireccional (persist → Drive), Drive no llama a persist()
 *   ni a `_origPersist()`/`_history`/`_future` (undo/redo). La
 *   conciliación y la elección de copia viven en este módulo.
 *
 * Relación con Excel (js/modules/excel.js, ya migrado):
 *   `xlsExport(tipo,'drive')` depende de `_gdriveReady`,
 *   `_gdriveUploadFile()` y `_folderReportId`, todas definidas
 *   acá. Es Excel quien llama a Drive, no al revés — no hay
 *   lógica de Excel en este archivo.
 *
 * Relación con Reportes (js/modules/reportes.js, ya migrado):
 *   ninguna. `generarReporteVencimientos()` abre una ventana
 *   nueva con `window.open`/`document.write` y no invoca ninguna
 *   función de este módulo — el botón "Generar informe" no tiene
 *   opción de subir a Drive (a diferencia de los reportes Excel).
 *
 * Los datos locales se guardan con STORAGE_KEY. Una subida solo se
 * confirma tras comprobar HTTP y corresponde al snapshot enviado.
 */

// ─── GOOGLE DRIVE INTEGRATION ────────────────────────────────────────────────
const GDRIVE_CLIENT_ID = '300143180626-7hiucjehd9g69iqjhu8b71jfigavobed.apps.googleusercontent.com';
const GDRIVE_SCOPES    = 'https://www.googleapis.com/auth/drive.file';
let _gdriveToken   = null;
let _gdriveReady   = false;
let _gdriveSaveTimer = null;
// Folder IDs
let _folderRootId    = null;
let _folderReportId  = null;
let _folderImportId  = null;
let _gdriveDataFileId = null;
let _gdriveSession = 0;
let _gdriveSyncJob = null;
let _gdriveConflict = null;
let _gdriveDialog = null;
// Lectura única por pestaña: otra pestaña no debe cambiar nuestra base en memoria.
let _gdriveBase = _gdriveReadBase();

function _gdriveReadBase(){
  try{
    const base=JSON.parse(localStorage.getItem('aercom-drive-sync-base'));
    return base && typeof base.folderId==='string' && typeof base.fileId==='string' &&
      /^[a-f0-9]{64}$/.test(base.signature) ? base : null;
  }catch{ return null; }
}

function _gdriveAssertSession(session){
  if(session!==_gdriveSession){
    const error=new Error('La sesión de Drive cambió.');
    error.cancelled=true;
    throw error;
  }
}

function _gdriveCloseConflict(){
  if(_gdriveDialog){ _gdriveDialog.remove(); _gdriveDialog=null; }
  document.getElementById('btn-drive-conflict')?.remove();
}

function _gdriveStartSession(token){
  _gdriveSession++;
  _gdriveToken=token;
  _gdriveReady=false;
  _gdriveDataFileId=null;
  _folderRootId=_folderReportId=_folderImportId=null;
  _gdriveConflict=null;
  _gdriveCloseConflict();
  return _gdriveSession;
}


function _loadGIS(){
  return new Promise(resolve=>{
    if(window.google&&window.google.accounts){resolve();return;}
    const s=document.createElement('script');
    s.src='https://accounts.google.com/gsi/client';
    s.onload=resolve;
    document.head.appendChild(s);
  });
}

async function gdriveAuth(){
  await _loadGIS();
  google.accounts.oauth2.initTokenClient({
    client_id: GDRIVE_CLIENT_ID,
    scope: GDRIVE_SCOPES,
    callback: async(resp)=>{
      if(resp.error){toast('⚠ Error al conectar con Drive: '+resp.error);return;}
      const session=_gdriveStartSession(resp.access_token);
      try{
        await _gdriveEnsureFolders();
        _gdriveAssertSession(session);
        _gdriveReady=true;
        localStorage.setItem('aercom-drive-connected','1'); // recordar que conectó
        _updateDriveUI();
        toast('✓ Conectado a Google Drive');
        await _gdriveLoadData();
      }catch(e){
        if(e.cancelled) return;
        _gdriveReady=false;
        _resetDriveUI();
        toast('⚠ No se pudo preparar Drive: '+e.message);
      }
    }
  }).requestAccessToken();
}

function _updateDriveUI(){
  // Sidebar button
  const btn=document.getElementById('btn-drive');
  const txt=document.getElementById('btn-drive-text');
  if(btn&&txt){
    btn.style.cssText='background:var(--ok-bg);color:var(--ok);border-color:var(--ok)';
    txt.textContent='✓ Drive conectado';
    btn.title='Click para desconectar';
    btn.onclick=gdriveDisconnect;
  }
  // Excel module status
  const status=document.getElementById('excel-drive-status');
  const msg=document.getElementById('excel-drive-msg');
  if(status&&msg){
    status.style.background='var(--ok-bg)';
    status.style.borderColor='var(--ok)';
    msg.style.color='var(--ok)';
    msg.textContent='✓ Drive conectado — los reportes se guardarán en Aercom Gestion/Reportes/';
    const btn2=status.querySelector('button');
    if(btn2) btn2.style.display='none';
  }
}

function _resetDriveUI(){
  // Sidebar button
  const btn=document.getElementById('btn-drive');
  const txt=document.getElementById('btn-drive-text');
  if(btn&&txt){
    btn.style.cssText='';
    txt.textContent='Conectar Drive';
    btn.title='';
    btn.onclick=gdriveAuth;
  }
  // Excel module status
  const status=document.getElementById('excel-drive-status');
  const msg=document.getElementById('excel-drive-msg');
  if(status&&msg){
    status.style.background='var(--warn-bg)';
    status.style.borderColor='var(--warn)';
    msg.style.color='var(--warn)';
    msg.textContent='Drive no conectado — conectate desde el sidebar para guardar reportes en la nube';
    const btn2=status.querySelector('button');
    if(btn2) btn2.style.display='';
  }
}

function gdriveDisconnect(){
  _gdriveSession++;
  _gdriveConflict=null;
  _gdriveCloseConflict();
  if(_gdriveSaveTimer){ clearTimeout(_gdriveSaveTimer); _gdriveSaveTimer=null; }
  if(window.google&&google.accounts&&_gdriveToken){
    google.accounts.oauth2.revoke(_gdriveToken, ()=>{});
  }
  _gdriveToken=null;
  _gdriveReady=false;
  _folderRootId=null;
  _folderReportId=null;
  _folderImportId=null;
  _gdriveDataFileId=null;
  localStorage.removeItem('aercom-drive-connected');
  _resetDriveUI();
  document.getElementById('sb-saved').textContent='Drive desconectado';
  toast('Drive desconectado');
}

// Comprobar HTTP sin incluir tokens ni cuerpos de respuesta en los mensajes.
async function _driveRequest(url, options){
  const session=_gdriveSession;
  const response=await fetch(url, options);
  _gdriveAssertSession(session);
  if(!response.ok){
    const error=new Error(`Drive respondió HTTP ${response.status}.`);
    error.status=response.status;
    throw error;
  }
  return response;
}

function _driveFileId(file){
  if(!file || typeof file.id!=='string' || !file.id.trim()){
    throw new Error('Drive no devolvió un identificador de archivo válido.');
  }
  return file.id;
}

function _driveFileList(data){
  if(!data || !Array.isArray(data.files)) throw new Error('Respuesta de Drive incompatible.');
  data.files.forEach(_driveFileId);
  return data.files;
}

function _driveSingleFile(data){
  const files=_driveFileList(data);
  if(files.length>1 || data.nextPageToken){
    throw new Error('Hay varios archivos o carpetas con el mismo nombre en Drive. Revisalos antes de sincronizar; no se eliminó ninguno.');
  }
  return files[0]||null;
}

// ── Crear estructura de carpetas ──
async function _gdriveEnsureFolders(){
  const session=_gdriveSession;
  const root=await _gdriveGetOrCreateFolder('Aercom Gestion', null);
  _gdriveAssertSession(session);
  const reports=await _gdriveGetOrCreateFolder('Reportes', root);
  _gdriveAssertSession(session);
  const imports=await _gdriveGetOrCreateFolder('Importaciones', root);
  _gdriveAssertSession(session);
  _folderRootId=root; _folderReportId=reports; _folderImportId=imports;
}

async function _gdriveGetOrCreateFolder(name, parentId){
  const session=_gdriveSession;
  let q=`mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if(parentId) q+=` and '${parentId}' in parents`;
  const res=await _driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    {headers:{Authorization:'Bearer '+_gdriveToken}});
  const data=await res.json();
  const file=_driveSingleFile(data);
  _gdriveAssertSession(session);
  if(file) return file.id;
  // Crear
  const body={name,mimeType:'application/vnd.google-apps.folder'};
  if(parentId) body.parents=[parentId];
  const res2=await _driveRequest('https://www.googleapis.com/drive/v3/files',{
    method:'POST',
    headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const d2=await res2.json();
  _gdriveAssertSession(session);
  return _driveFileId(d2);
}

// Comparación de contenido normalizado: lastSaved no decide qué copia prevalece.
async function _gdriveSignature(data){
  const normalized=_parseImportedData(JSON.stringify(data));
  delete normalized.lastSaved;
  const ordered=value=>Array.isArray(value)?value.map(ordered):
    value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])) : value;
  const bytes=new TextEncoder().encode(JSON.stringify(ordered(normalized)));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

function _gdriveRememberBase(remote, signature, session){
  _gdriveAssertSession(session);
  const base={folderId:_folderRootId,fileId:remote.fileId,signature};
  localStorage.setItem('aercom-drive-sync-base',JSON.stringify(base));
  _gdriveBase=base;
  _gdriveDataFileId=remote.fileId;
}

async function _gdriveReadRemote(session){
  const q=`name='aercom-data.json' and '${_folderRootId}' in parents and trashed=false`;
  const res=await _driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name)`,
    {headers:{Authorization:'Bearer '+_gdriveToken}});
  const file=_driveSingleFile(await res.json());
  _gdriveAssertSession(session);
  if(!file) return null;
  const media=await _driveRequest(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    {headers:{Authorization:'Bearer '+_gdriveToken}});
  const data=_parseImportedData(await media.text());
  const signature=await _gdriveSignature(data);
  _gdriveAssertSession(session);
  return {fileId:file.id,data,signature,etag:media.headers?.get('ETag')||null};
}

function _gdriveRecovery(local, remote){
  const key='aercom-drive-recovery';
  const previous=localStorage.getItem(key);
  const copies=previous?JSON.parse(previous):[];
  if(!Array.isArray(copies)) throw new Error('El respaldo de conflictos necesita revisión.');
  const entry={folderId:_folderRootId,fileId:remote.fileId,local,drive:remote.data};
  const text=JSON.stringify(entry);
  if(!copies.some(copy=>JSON.stringify(copy)===text)){
    copies.push(entry);
    // Si no hay espacio, no se autoriza un reemplazo sin conservar ambas copias.
    localStorage.setItem(key,JSON.stringify(copies));
  }
  _gdriveRecoveryAction();
}

async function _gdriveShowConflict(remote, session){
  _gdriveAssertSession(session);
  const local=_parseImportedData(JSON.stringify(D));
  let backupError='';
  try{ _gdriveRecovery(local,remote); }catch{ backupError='No se pudo guardar el respaldo de ambas copias. Descargalas antes de liberar espacio; no se reemplazarán datos.'; }
  _gdriveConflict={remote,session,backupError};
  markUnsaved();
  document.getElementById('sb-saved').textContent='⚠ Drive: hay diferencias por resolver';
  _gdriveRenderConflict();
}

function _gdriveDownloadCopy(data, name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url; link.download=name; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// El respaldo sigue accesible después de elegir una copia o recargar la página.
function _gdriveRecoveryAction(){
  const anchor=document.getElementById('btn-drive');
  if(!anchor?.insertAdjacentElement || document.getElementById('btn-drive-recovery')) return;
  try{ if(!localStorage.getItem('aercom-drive-recovery')) return; }catch{ return; }
  const button=document.createElement('button');
  button.id='btn-drive-recovery'; button.className='btn btn-outline';
  button.style.cssText='white-space:normal;width:100%;font-size:12px';
  button.textContent='Descargar respaldos de conflictos';
  button.onclick=()=>{
    try{ _gdriveDownloadCopy(JSON.parse(localStorage.getItem('aercom-drive-recovery')),'aercom-respaldos-conflictos.json'); }
    catch{ toast('⚠ No se pudo preparar el respaldo de conflictos.'); }
  };
  anchor.insertAdjacentElement('afterend',button);
}
document.addEventListener?.('DOMContentLoaded',_gdriveRecoveryAction);

function _gdriveRenderConflict(){
  if(!_gdriveConflict) return;
  _gdriveCloseConflict();
  const reopen=document.createElement('button');
  reopen.id='btn-drive-conflict'; reopen.className='btn btn-outline';
  reopen.style.cssText='white-space:normal;width:100%;font-size:12px';
  reopen.textContent='Resolver diferencias con Drive';
  reopen.onclick=_gdriveRenderConflict;
  document.getElementById('btn-drive')?.insertAdjacentElement('afterend',reopen);
  const dialog=document.createElement('dialog');
  dialog.className='modal'; dialog.style.padding='24px'; dialog.style.margin='auto';
  dialog.setAttribute('aria-label','Elegir copia del CRM');
  const title=document.createElement('h2'); title.textContent='Hay dos copias distintas del CRM'; dialog.append(title);
  const text=document.createElement('p');
  text.style.margin='16px 0';
  text.textContent=_gdriveConflict.backupError || 'Ambas copias están respaldadas en este navegador. Elegí cuál usar completa; no se combinarán registros automáticamente.';
  dialog.append(text);
  const summary=document.createElement('p');
  summary.textContent=`Clientes: local ${D.clientes.length}, Drive ${_gdriveConflict.remote.data.clientes.length}. Podés descargar ambas copias antes de elegir.`;
  dialog.append(summary);
  const buttons=document.createElement('div'); buttons.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:16px';
  const add=(label,action)=>{
    const button=document.createElement('button'); button.className='btn btn-outline'; button.textContent=label;
    button.style.whiteSpace='normal';
    button.onclick=action; buttons.append(button); return button;
  };
  add('Descargar local',()=>_gdriveDownloadCopy(D,'aercom-copia-local.json'));
  add('Descargar Drive',()=>_gdriveDownloadCopy(_gdriveConflict.remote.data,'aercom-copia-drive.json'));
  const choose=choice=>async()=>{
    for(const button of buttons.querySelectorAll('button')) button.disabled=true;
    try{ await _gdriveResolveConflict(choice); }
    finally{ if(_gdriveDialog===dialog) for(const button of buttons.querySelectorAll('button')) button.disabled=false; }
  };
  const local=add('Conservar local',choose('local'));
  const drive=add('Usar Drive',choose('drive'));
  local.disabled=drive.disabled=!!_gdriveConflict.backupError;
  if(_gdriveConflict.backupError) add('Reintentar respaldo',async()=>{
    try{ await _gdriveShowConflict(_gdriveConflict.remote,_gdriveConflict.session); }
    catch(error){ if(!error.cancelled) toast('⚠ No se pudo preparar el respaldo.'); }
  });
  add('Decidir después',()=>{ dialog.remove(); _gdriveDialog=null; });
  dialog.append(buttons);
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.remove();_gdriveDialog=null;});
  document.body.append(dialog); _gdriveDialog=dialog;
  if(dialog.showModal) dialog.showModal(); else dialog.setAttribute('open','');
}

function _gdriveAcceptRemote(remote, session){
  _gdriveAssertSession(session);
  _applyImportedData(remote.data,()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(D)));
  _gdriveRememberBase(remote,remote.signature,session);
  markSaved();
}

// Transporte: actualizar exige la revisión observada; crear usa un único multipart.
async function _gdriveWriteSnapshot(snapshot, remote, session){
  const signature=await _gdriveSignature(snapshot);
  _gdriveAssertSession(session);
  const current=JSON.stringify(D);
  const currentSignature=await _gdriveSignature(D);
  _gdriveAssertSession(session);
  if(currentSignature!==signature || JSON.stringify(D)!==current){
    if(_gdriveSyncJob) _gdriveSyncJob.queued=true;
    return false;
  }
  _gdriveAssertSession(session);
  if(remote && !remote.etag) throw new Error('Drive no ofrece una revisión verificable; no se sobrescribió el backup.');
  let localSaved=false;
  try{
    snapshot.lastSaved=today(); D.lastSaved=snapshot.lastSaved;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(D)); localSaved=true;
    const body=JSON.stringify(snapshot,null,2);
    let saved=remote;
    if(remote){
      await _driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${remote.fileId}?uploadType=media`,{
        method:'PATCH',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'application/json','If-Match':remote.etag},body});
    }else{
      const boundary='aercom-'+crypto.randomUUID();
      const metadata=JSON.stringify({name:'aercom-data.json',parents:[_folderRootId]});
      const multipart=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
      const res=await _driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{
        method:'POST',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'multipart/related; boundary='+boundary},body:multipart});
      saved={fileId:_driveFileId(await res.json())};
    }
    _gdriveAssertSession(session);
    _gdriveRememberBase(saved,signature,session);
    const latestText=JSON.stringify(D);
    const latestSignature=await _gdriveSignature(D);
    _gdriveAssertSession(session);
    const pending=latestSignature!==signature || JSON.stringify(D)!==latestText;
    if(pending){markUnsaved();document.getElementById('sb-saved').textContent='✓ Copia enviada a Drive; hay cambios pendientes';}
    else{markSaved();document.getElementById('sb-saved').textContent='✓ Guardado en Drive '+new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});}
    return true;
  }catch(error){ error.localSaved=localSaved; throw error; }
}

async function _gdriveSyncOnce(session){
  const localText=JSON.stringify(D);
  const local=_parseImportedData(localText);
  const signature=await _gdriveSignature(local);
  _gdriveAssertSession(session);
  const remote=await _gdriveReadRemote(session);
  _gdriveAssertSession(session);
  if(JSON.stringify(D)!==localText){_gdriveSyncJob.queued=true;return false;}
  if(!remote){
    if(_gdriveBase?.folderId===_folderRootId) throw new Error('El backup conocido desapareció. Revisá Drive antes de crear otro.');
    return _gdriveWriteSnapshot(local,null,session);
  }
  if(remote.signature===signature){
    _gdriveRememberBase(remote,signature,session); markSaved();
    document.getElementById('sb-saved').textContent='✓ Copia local y Drive sincronizadas';
    return true;
  }
  const base=_gdriveBase?.folderId===_folderRootId && _gdriveBase.fileId===remote.fileId ? _gdriveBase.signature : null;
  if(base===signature){_gdriveAcceptRemote(remote,session);return true;}
  if(base===remote.signature) return _gdriveWriteSnapshot(local,remote,session);
  await _gdriveShowConflict(remote,session);
  return false;
}

async function _gdriveSync(){
  if(!_gdriveReady || !_gdriveToken || !_folderRootId || _gdriveConflict) return false;
  const session=_gdriveSession;
  if(_gdriveSyncJob?.session===session){_gdriveSyncJob.queued=true;return _gdriveSyncJob.promise;}
  const job={session,queued:false,promise:null}; _gdriveSyncJob=job;
  job.promise=(async()=>{
    let result=false;
    do{
      job.queued=false;
      try{ result=await _gdriveSyncOnce(session); }
      catch(error){
        if(error.cancelled) return false;
        markUnsaved();
        document.getElementById('sb-saved').textContent=error.localSaved===true
          ? '⚠ Sin confirmar en Drive; copia local conservada'
          : error.localSaved===false ? '⚠ No se pudo guardar la copia local ni confirmar Drive' : '⚠ Sincronización pendiente; copia local sin reemplazar';
        toast('⚠ No se pudo sincronizar Drive: '+error.message);
        if(error.status===412){
          try{const remote=await _gdriveReadRemote(session);if(remote)await _gdriveShowConflict(remote,session);}catch{/* no sobrescribir si tampoco se puede releer */}
        }
        return false;
      }
    }while(job.queued && !_gdriveConflict && session===_gdriveSession && _gdriveReady);
    return result;
  })().finally(()=>{if(_gdriveSyncJob===job)_gdriveSyncJob=null;});
  return job.promise;
}

async function _gdriveResolveConflict(choice){
  const conflict=_gdriveConflict;
  if(!conflict || !['local','drive'].includes(choice)) return false;
  const session=conflict.session;
  try{
    _gdriveAssertSession(session);
    const remote=await _gdriveReadRemote(session);
    if(!remote || remote.fileId!==conflict.remote.fileId || remote.signature!==conflict.remote.signature){
      if(remote) await _gdriveShowConflict(remote,session);
      else toast('⚠ El backup remoto cambió o desapareció; no se reemplazaron datos.');
      return false;
    }
    const localText=JSON.stringify(D);
    const local=_parseImportedData(localText);
    _gdriveRecovery(local,remote);
    if(choice==='drive') _gdriveAcceptRemote(remote,session);
    else if(!await _gdriveWriteSnapshot(local,remote,session)) return false;
    _gdriveConflict=null;_gdriveCloseConflict();
    if(JSON.stringify(D)!==localText && choice==='local') _scheduleDriveSave();
    return true;
  }catch(error){
    if(!error.cancelled){
      toast('⚠ No se resolvió el conflicto: '+error.message);
      if(error.status===412){try{const remote=await _gdriveReadRemote(session);if(remote)await _gdriveShowConflict(remote,session);}catch{/* conservar ambas copias */}}
    }
    return false;
  }
}

function _gdriveLoadData(){return _gdriveSync();}
function _gdriveSaveData(){return _gdriveSync();}

function _scheduleDriveSave(){
  if(!_gdriveReady || _gdriveConflict) return;
  if(_gdriveSaveTimer) clearTimeout(_gdriveSaveTimer);
  _gdriveSaveTimer=setTimeout(()=>_gdriveSaveData(),5000);
}

// ── Subir archivo a Drive (reportes) ──
async function _gdriveUploadFile(name, content, mimeType, folderId){
  if(!_gdriveReady||!_gdriveToken||!folderId) return false;
  const session=_gdriveSession;
  try{
    // Buscar si ya existe para actualizar
    const q=`name='${name}' and '${folderId}' in parents and trashed=false`;
    const res=await _driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
      {headers:{Authorization:'Bearer '+_gdriveToken}});
    const data=await res.json();
    _gdriveAssertSession(session);
    const file=_driveSingleFile(data);
    let fileId=file?file.id:null;
    if(fileId){
      await _driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,{
        method:'PATCH',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':mimeType},body:content});
    } else {
      const meta={name,parents:[folderId]};
      const r=await _driveRequest('https://www.googleapis.com/drive/v3/files',{
        method:'POST',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'application/json'},
        body:JSON.stringify(meta)});
      const d=await r.json();
      _gdriveAssertSession(session);
      fileId=_driveFileId(d);
      await _driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,{
        method:'PATCH',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':mimeType},body:content});
    }
    _gdriveAssertSession(session);
    return true;
  }catch(e){console.error('Drive upload',e);return false;}
}

// ─── GOOGLE DRIVE PERSISTENCIA TOKEN ────────────────────────────────────────
// Intento de auto-reconexión silenciosa al cargar
async function _tryAutoConnectDrive(){
  // Google OAuth2 token no se puede persistir por seguridad, pero podemos
  // intentar reconectar silenciosamente (prompt=none) si el usuario ya autorizó
  try{
    await _loadGIS();
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: GDRIVE_CLIENT_ID,
      scope: GDRIVE_SCOPES,
      prompt: '',  // sin popup si ya hay sesión
      callback: async(resp)=>{
        if(resp.error) return; // fallo silencioso
        const session=_gdriveStartSession(resp.access_token);
        try{
          await _gdriveEnsureFolders();
          _gdriveAssertSession(session);
          _gdriveReady = true;
          _updateDriveUI();
          await _gdriveLoadData();
        }catch(e){
          if(e.cancelled) return;
          _gdriveReady = false;
          _resetDriveUI();
          toast('⚠ No se pudo preparar Drive: '+e.message);
        }
      }
    });
    tc.requestAccessToken();
  } catch(e){ /* fallo silencioso */ }
}
