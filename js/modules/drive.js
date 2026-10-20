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
 * (verificación al conectar + guardado con debounce), subida de
 * archivos (usada por reportes/exportaciones), y el intento de
 * reconexión silenciosa al arrancar la app.
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, toast(), today(), markSaved() (index.html)
 *   _parseImportedData(), STORAGE_KEY (js/storage.js)
 *
 * Relación con persist() (NO migrada, sigue en index.html):
 *   `persist()` es quien LLAMA a `_scheduleDriveSave()` (migrada
 *   acá) después de cada guardado exitoso — la relación es
 *   unidireccional (persist → Drive), Drive no llama a persist()
 *   ni a `_origPersist()`/`_history`/`_future` (undo/redo). No se
 *   tocó `persist()` ni `js/storage.js`, conforme al alcance de
 *   este PR.
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
// Autenticación no implica que el backup haya sido revisado.
let _gdriveSyncChecked = false;
let _gdriveSession = 0;
let _gdriveCheckRun = 0;
let _gdriveReview = null;
// Folder IDs
let _folderRootId    = null;
let _folderReportId  = null;
let _folderImportId  = null;
let _gdriveDataFileId = null;

function _gdriveBeginSession(token){
  _gdriveSession++;
  _gdriveSyncChecked=false;
  _gdriveReady=false;
  _gdriveReview=null;
  _gdriveToken=token;
  _folderRootId=_folderReportId=_folderImportId=_gdriveDataFileId=null;
  if(_gdriveSaveTimer){clearTimeout(_gdriveSaveTimer);_gdriveSaveTimer=null;}
  _gdriveReviewVisible(false);
  document.getElementById('drive-review-dialog')?.close?.();
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
      const session=_gdriveBeginSession(resp.access_token);
      try{
        await _gdriveEnsureFolders(session);
        if(session!==_gdriveSession) return;
        _gdriveReady=true;
        localStorage.setItem('aercom-drive-connected','1'); // recordar que conectó
        _updateDriveUI();
        toast('✓ Conectado a Google Drive');
        await _gdriveLoadData();
      }catch(e){
        if(session!==_gdriveSession) return;
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
  _gdriveSyncChecked=false;
  _gdriveReview=null;
  _gdriveReviewVisible(false);
  document.getElementById('drive-review-dialog')?.close?.();
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
  toast('Drive desconectado');
}

// Comprobar HTTP sin incluir tokens ni cuerpos de respuesta en los mensajes.
async function _driveRequest(url, options){
  const response=await fetch(url, options);
  if(!response.ok) throw new Error(`Drive respondió HTTP ${response.status}.`);
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

// ── Crear estructura de carpetas ──
async function _gdriveEnsureFolders(session=_gdriveSession){
  const check=()=>{if(session!==_gdriveSession) throw new Error('La sesión de Drive cambió.');};
  const root=await _gdriveGetOrCreateFolder('Aercom Gestion', null);check();
  const reports=await _gdriveGetOrCreateFolder('Reportes', root);check();
  const imports=await _gdriveGetOrCreateFolder('Importaciones', root);check();
  _folderRootId=root;_folderReportId=reports;_folderImportId=imports;
}

async function _gdriveGetOrCreateFolder(name, parentId){
  let q=`mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if(parentId) q+=` and '${parentId}' in parents`;
  const res=await _driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name),nextPageToken`,
    {headers:{Authorization:'Bearer '+_gdriveToken}});
  const data=await res.json();
  const files=_driveFileList(data);
  if(files.length>1 || data.nextPageToken) throw new Error('Hay carpetas duplicadas o más resultados; revisá Drive antes de sincronizar.');
  if(files.length>0) return files[0].id;
  // Crear
  const body={name,mimeType:'application/vnd.google-apps.folder'};
  if(parentId) body.parents=[parentId];
  const res2=await _driveRequest('https://www.googleapis.com/drive/v3/files',{
    method:'POST',
    headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const d2=await res2.json();
  return _driveFileId(d2);
}

// ── Cargar datos JSON desde Drive ──
// Comparación estructural sobre copias normalizadas; lastSaved no es una revisión.
function _gdriveComparable(data){
  const copy=_parseImportedData(JSON.stringify(data));
  delete copy.lastSaved;
  const stable=value=>Array.isArray(value) ? '['+value.map(stable).join(',')+']'
    : value && typeof value==='object'
      ? '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}'
      : JSON.stringify(value);
  return stable(copy);
}

function _gdriveReviewVisible(visible){
  const button=document.getElementById('btn-drive-review');
  if(button){button.hidden=!visible;if(button.style)button.style.display=visible?'':'none';}
}

function _gdriveShowReview(){
  const dialog=document.getElementById('drive-review-dialog');
  if(!_gdriveReview || !dialog?.showModal) return;
  document.getElementById('drive-review-message').textContent=_gdriveReview.message;
  document.getElementById('drive-review-remote').disabled=typeof _gdriveReview.remoteText!=='string';
  if(!dialog.open) dialog.showModal();
}

function _gdrivePauseSync(message,remoteText,showReview){
  _gdriveSyncChecked=false;
  if(_gdriveSaveTimer){clearTimeout(_gdriveSaveTimer);_gdriveSaveTimer=null;}
  _gdriveReview={message,remoteText};
  const text=document.getElementById('btn-drive-text');
  if(text) text.textContent='Drive: sincronización pausada';
  const status=document.getElementById('sb-saved');
  if(status) status.textContent='⚠ Sincronización con Drive pausada; datos locales sin reemplazar';
  const excel=document.getElementById('excel-drive-msg');
  if(excel) excel.textContent='Sincronización del CRM pausada: '+message+' Los reportes son archivos independientes.';
  _gdriveReviewVisible(true);
  toast('⚠ Sincronización pausada: '+message);
  if(showReview) _gdriveShowReview();
  return false;
}

function _gdriveDownloadReview(which){
  if(!_gdriveReview) return;
  let url;
  try{
    const text=which==='local' ? JSON.stringify(D,null,2) : _gdriveReview.remoteText;
    if(typeof text!=='string') throw new Error('No se obtuvo una copia remota descargable.');
    url=URL.createObjectURL(new Blob([text],{type:which==='local'?'application/json':'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;
    link.download=which==='local'?'aercom-local-actual.json':'aercom-drive-revisar.txt';
    link.click();
  }catch{toast('⚠ No se pudo iniciar la descarga. No se modificaron los datos.');}
  finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

async function _gdriveLoadData(showReview=true){
  _gdriveSyncChecked=false;
  _gdriveReview=null;
  _gdriveReviewVisible(false);
  _gdriveDataFileId=null;
  if(_gdriveSaveTimer){clearTimeout(_gdriveSaveTimer);_gdriveSaveTimer=null;}
  const session=_gdriveSession,run=++_gdriveCheckRun,token=_gdriveToken,root=_folderRootId;
  const local=JSON.stringify(D);
  let remoteText;
  const current=()=>session===_gdriveSession && run===_gdriveCheckRun && token===_gdriveToken && root===_folderRootId;
  try{
    if(!root) return false;
    const q=`name='aercom-data.json' and '${root}' in parents and trashed=false`;
    const res=await _driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name),nextPageToken`,
      {headers:{Authorization:'Bearer '+token}});
    if(!current()) return false;
    const data=await res.json();
    if(!current()) return false;
    const files=_driveFileList(data);
    if(files.length>1 || data.nextPageToken) throw new Error('Hay varios backups con el mismo nombre o más resultados. No se eligió uno automáticamente.');
    if(files.length===1){
      const fileId=files[0].id;
      const media=await _driveRequest(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {headers:{Authorization:'Bearer '+token}});
      if(!current()) return false;
      remoteText=await media.text();
      if(!current()) return false;
      const parsed=_parseImportedData(remoteText);
      if(JSON.stringify(D)!==local) throw new Error('Los datos locales cambiaron durante la revisión. Reintentá antes de sincronizar.');
      if(_gdriveComparable(parsed)!==_gdriveComparable(D)){
        return _gdrivePauseSync('La copia local y la de Drive son distintas. Se conservan ambas hasta revisar cuál usar.',remoteText,showReview);
      }
      _gdriveDataFileId=fileId;
    }else{
      if(JSON.stringify(D)!==local) throw new Error('Los datos locales cambiaron durante la revisión.');
      _parseImportedData(local);
    }
    _gdriveSyncChecked=true;
    _gdriveReviewVisible(false);
    _updateDriveUI();
    if(!files.length) return await _gdriveSaveData();
    document.getElementById('sb-saved').textContent='✓ Copias local y Drive verificadas; no se reemplazaron datos';
    return true;
  }catch(e){
    if(!current()) return false;
    return _gdrivePauseSync('No se pudo verificar el backup de Drive: '+e.message,remoteText,showReview);
  }
}

// ── Guardar JSON en Drive ──
async function _gdriveSaveData(){
  if(!_gdriveReady||!_gdriveToken||!_folderRootId||!_gdriveSyncChecked) return false;
  const session=_gdriveSession;
  let localSaved=false;
  try{
    D.lastSaved=today();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(D));
    localSaved=true;
    const body=JSON.stringify(D,null,2);
    if(_gdriveDataFileId){
      await _driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${_gdriveDataFileId}?uploadType=media`,{
        method:'PATCH',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'application/json'},body});
    } else {
      const meta={name:'aercom-data.json',parents:[_folderRootId]};
      const res=await _driveRequest('https://www.googleapis.com/drive/v3/files',{
        method:'POST',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'application/json'},
        body:JSON.stringify(meta)});
      if(session!==_gdriveSession) return false;
      const d=await res.json();
      if(session!==_gdriveSession) return false;
      _gdriveDataFileId=_driveFileId(d);
      await _driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${_gdriveDataFileId}?uploadType=media`,{
        method:'PATCH',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'application/json'},body});
    }
    if(session!==_gdriveSession) return false;
    // El PATCH confirma el snapshot enviado, no las ediciones hechas mientras esperaba.
    if(JSON.stringify(D,null,2)===body){
      document.getElementById('sb-saved').textContent='✓ Guardado en Drive '+new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
      markSaved();
    } else {
      markUnsaved();
      document.getElementById('sb-saved').textContent='✓ Copia enviada a Drive; hay cambios pendientes';
    }
    return true;
  }catch(e){
    if(session!==_gdriveSession) return false;
    console.error('Drive save',e);
    markUnsaved();
    document.getElementById('sb-saved').textContent=localSaved
      ? '⚠ Sin confirmar en Drive; copia local conservada'
      : '⚠ No se pudo guardar la copia local ni confirmar Drive';
    toast('⚠ No se pudo guardar en Drive: '+e.message);
    return false;
  }
}

function _scheduleDriveSave(){
  if(!_gdriveReady||!_gdriveSyncChecked) return;
  if(_gdriveSaveTimer) clearTimeout(_gdriveSaveTimer);
  _gdriveSaveTimer=setTimeout(()=>_gdriveSaveData(),5000);
}

// ── Subir archivo a Drive (reportes) ──
async function _gdriveUploadFile(name, content, mimeType, folderId){
  if(!_gdriveReady||!_gdriveToken||!folderId) return false;
  try{
    // Buscar si ya existe para actualizar
    const q=`name='${name}' and '${folderId}' in parents and trashed=false`;
    const res=await _driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
      {headers:{Authorization:'Bearer '+_gdriveToken}});
    const data=await res.json();
    const files=_driveFileList(data);
    let fileId=files.length>0?files[0].id:null;
    if(fileId){
      await _driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,{
        method:'PATCH',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':mimeType},body:content});
    } else {
      const meta={name,parents:[folderId]};
      const r=await _driveRequest('https://www.googleapis.com/drive/v3/files',{
        method:'POST',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'application/json'},
        body:JSON.stringify(meta)});
      const d=await r.json(); fileId=_driveFileId(d);
      await _driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,{
        method:'PATCH',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':mimeType},body:content});
    }
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
        const session=_gdriveBeginSession(resp.access_token);
        try{
          await _gdriveEnsureFolders(session);
          if(session!==_gdriveSession) return;
          _gdriveReady = true;
          _updateDriveUI();
          // La revisión solo lee; nunca descarga sobre D una copia diferente.
          await _gdriveLoadData(false);
        }catch(e){
          if(session!==_gdriveSession) return;
          _gdriveReady = false;
          _resetDriveUI();
          toast('⚠ No se pudo preparar Drive: '+e.message);
        }
      }
    });
    tc.requestAccessToken();
  } catch(e){ /* fallo silencioso */ }
}
