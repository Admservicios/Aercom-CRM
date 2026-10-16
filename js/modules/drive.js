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
 *   D, toast(), today(), markSaved() (index.html)
 *   _parseImportedData(), _applyImportedData(), STORAGE_KEY (js/storage.js)
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
// Folder IDs
let _folderRootId    = null;
let _folderReportId  = null;
let _folderImportId  = null;
let _gdriveDataFileId = null;

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
      _gdriveToken=resp.access_token;
      try{
        await _gdriveEnsureFolders();
        _gdriveReady=true;
        localStorage.setItem('aercom-drive-connected','1'); // recordar que conectó
        _updateDriveUI();
        toast('✓ Conectado a Google Drive');
        await _gdriveLoadData();
      }catch(e){
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
async function _gdriveEnsureFolders(){
  _folderRootId   = await _gdriveGetOrCreateFolder('Aercom Gestion', null);
  _folderReportId = await _gdriveGetOrCreateFolder('Reportes', _folderRootId);
  _folderImportId = await _gdriveGetOrCreateFolder('Importaciones', _folderRootId);
}

async function _gdriveGetOrCreateFolder(name, parentId){
  let q=`mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if(parentId) q+=` and '${parentId}' in parents`;
  const res=await _driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    {headers:{Authorization:'Bearer '+_gdriveToken}});
  const data=await res.json();
  const files=_driveFileList(data);
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
async function _gdriveLoadData(){
  try{
    if(!_folderRootId) return;
    const q=`name='aercom-data.json' and '${_folderRootId}' in parents and trashed=false`;
    const res=await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      {headers:{Authorization:'Bearer '+_gdriveToken}});
    if(!res.ok) throw new Error('No se pudo consultar el backup de Drive.');
    const data=await res.json();
    if(!Array.isArray(data.files)) throw new Error('Respuesta de Drive incompatible.');
    if(data.files.length>0){
      const fileId=data.files[0].id;
      const res2=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {headers:{Authorization:'Bearer '+_gdriveToken}});
      if(!res2.ok) throw new Error('No se pudo descargar el backup de Drive.');
      const parsed=_parseImportedData(await res2.text());
      const driveDate=parsed.lastSaved||'';
      const localDate=D.lastSaved||'';
      if(driveDate>localDate){
        _applyImportedData(parsed, () => localStorage.setItem(STORAGE_KEY,JSON.stringify(D)));
        _gdriveDataFileId=fileId;
        toast('✓ Datos sincronizados desde Drive');
      } else {
        _gdriveDataFileId=fileId;
        await _gdriveSaveData();
      }
    } else {
      await _gdriveSaveData();
    }
  }catch(e){console.error('Drive load',e);toast('⚠ No se cargaron los datos de Drive: '+e.message);}
}

// ── Guardar JSON en Drive ──
async function _gdriveSaveData(){
  if(!_gdriveReady||!_gdriveToken||!_folderRootId) return false;
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
      const d=await res.json(); _gdriveDataFileId=_driveFileId(d);
      await _driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${_gdriveDataFileId}?uploadType=media`,{
        method:'PATCH',headers:{Authorization:'Bearer '+_gdriveToken,'Content-Type':'application/json'},body});
    }
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
  if(!_gdriveReady) return;
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
        _gdriveToken = resp.access_token;
        try{
          await _gdriveEnsureFolders();
          _gdriveReady = true;
          _updateDriveUI();
          // NO llamar _gdriveLoadData acá para no sobreescribir datos locales al arrancar
          document.getElementById('sb-saved').textContent='✓ Drive reconectado automáticamente';
        }catch(e){
          _gdriveReady = false;
          _resetDriveUI();
          toast('⚠ No se pudo preparar Drive: '+e.message);
        }
      }
    });
    tc.requestAccessToken();
  } catch(e){ /* fallo silencioso */ }
}
