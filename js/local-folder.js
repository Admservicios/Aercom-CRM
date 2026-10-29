/* Copia física opcional mediante File System Access (Chrome/Edge).
 * El guardado sincrónico existente conserva su contrato y copia del navegador.
 * Solo se confirma archivo guardado después de cerrar la escritura nativa.
 */
let _folderFile=null, _folderExpected=null, _folderName='';
let _folderBusy=false, _folderWriting=false, _folderQueued=false, _folderPaused=false;

function isLocalFolderPending(){
  return _folderBusy||Boolean(_folderFile&&(_folderWriting||_folderQueued||_folderPaused));
}

function _folderStatus(message,error=false){
  const el=document.getElementById('folder-status');
  if(el){el.textContent=message;el.style.color=error?'var(--err)':'var(--t2)';}
  const button=document.getElementById('folder-disconnect');
  if(button)button.style.display=_folderFile?'':'none';
}

function _folderEditorOpen(){
  return ['modal-overlay','ficha-overlay','conf-overlay'].some(id=>document.getElementById(id)?.classList?.contains('open'));
}

function _folderSnapshot(){
  _assertStorageReady();
  const raw=localStorage.getItem(STORAGE_KEY)??JSON.stringify(D);
  _parseImportedData(raw);
  return raw;
}

function scheduleLocalFolderSave(){
  if(!_folderFile||_folderPaused)return;
  _folderQueued=true;
  _folderStatus('Carpeta: cambios pendientes de guardar…');
  queueMicrotask(_flushLocalFolderSave);
}

async function _writeFolderFile(handle,raw){
  let stream;
  try{
    stream=await handle.createWritable();
    await stream.write(raw);
    await stream.close();
  }catch(error){
    try{await stream?.abort();}catch{}
    throw error;
  }
}

async function _flushLocalFolderSave(){
  if(_folderBusy||_folderWriting||_folderPaused||!_folderFile||!_folderQueued)return;
  _folderWriting=true;
  try{
    while(_folderQueued&&!_folderPaused){
      _folderQueued=false;
      const raw=_folderSnapshot();
      const current=await (await _folderFile.getFile()).text();
      if(current!==_folderExpected)throw new Error('El archivo cambió fuera del CRM. Se conservan ambas copias; reconectá y revisá cuál cargar.');
      if(raw!==_folderExpected){
        await _writeFolderFile(_folderFile,raw);
        _folderExpected=raw;
      }
      if(!_folderQueued&&_folderSnapshot()===raw){
        markSaved();
        _folderStatus('Archivo aercom-data.json actualizado en «'+_folderName+'».');
      }
    }
  }catch(error){
    _folderPaused=true;
    _folderStatus('Guardado en carpeta pausado: '+error.message+' La copia del navegador se conserva. Exportá un JSON antes de reconectar.',true);
  }finally{
    _folderWriting=false;
  }
}

async function _backupFolderBrowser(directory,raw){
  const name='aercom-respaldo-navegador-'+Date.now()+'-'+crypto.randomUUID()+'.json';
  // Un respaldo nunca reemplaza un archivo que ya exista.
  try{await directory.getFileHandle(name);throw new Error('Ya existe el nombre del respaldo. Reintentá.');}
  catch(error){if(error.name!=='NotFoundError')throw error;}
  const handle=await directory.getFileHandle(name,{create:true});
  if((await handle.getFile()).size!==0)throw new Error('El respaldo cambió durante la preparación.');
  await _writeFolderFile(handle,raw);
}

async function connectLocalFolder(){
  if(_folderBusy||_folderWriting){toast('Esperá a que termine el guardado actual.');return;}
  if(_folderEditorOpen()){toast('Guardá o cerrá el formulario antes de conectar una carpeta.');return;}
  if(typeof window.showDirectoryPicker!=='function'||!window.isSecureContext){
    _folderStatus('Este navegador no permite conectar carpetas. Usá Chrome o Edge actualizados; Exportar respaldo JSON sigue disponible.',true);
    return;
  }
  _folderBusy=true;
  try{
    const browserRaw=localStorage.getItem(STORAGE_KEY);
    const before=_folderSnapshot();
    const directory=await window.showDirectoryPicker({id:'aercom-datos',mode:'readwrite'});
    let handle,raw,candidate;
    try{
      handle=await directory.getFileHandle('aercom-data.json');
    }catch(error){if(error.name!=='NotFoundError')throw error;}
    if(handle){
      raw=await (await handle.getFile()).text();
      candidate=_parseImportedData(raw); // Un archivo vacío/dañado no se reemplaza.
    }
    if(!handle){
      if(!window.confirm(`Esta carpeta no tiene aercom-data.json. ¿Crear el archivo con los datos que ves en el CRM (${D.clientes.length} clientes y ${D.equipos.length} equipos)?`))return;
      handle=await directory.getFileHandle('aercom-data.json',{create:true});
      raw=await (await handle.getFile()).text();
      if(raw!=='')throw new Error('Apareció un archivo con datos en la carpeta. Reconectá para revisarlo.');
    }else if(raw!==before){
      if(!window.confirm(`La carpeta tiene ${candidate.clientes.length} clientes y ${candidate.equipos.length} equipos. ¿Cargar esos datos en el CRM?${browserRaw!==null?' Primero se conservará la copia actual del navegador como otro JSON en esa carpeta.':''}`))return;
      if(browserRaw!==null)await _backupFolderBrowser(directory,before);
    }
    if(_folderEditorOpen())throw new Error('Se abrió un formulario durante la conexión. Cerralo antes de reconectar.');
    if(localStorage.getItem(STORAGE_KEY)!==browserRaw||_folderSnapshot()!==before)throw new Error('Los datos del navegador cambiaron mientras se elegía la carpeta. Reconectá para revisar.');
    if(await (await handle.getFile()).text()!==raw)throw new Error('El archivo cambió durante la conexión. Reconectá para revisar.');
    if(candidate&&raw!==before)_applyImportedData(candidate,()=>persist());
    _folderFile=handle;
    _folderName=directory.name;
    _folderExpected=raw;
    _folderPaused=false;
    _folderStatus('Carpeta conectada. Preparando la copia…');
    scheduleLocalFolderSave();
  }catch(error){
    if(error.name!=='AbortError')_folderStatus('No se conectó la carpeta: '+error.message+' No se reemplazó el archivo de datos existente.'+(_folderFile&&!_folderPaused?' Sigue conectada «'+_folderName+'».':''),true);
  }finally{
    _folderBusy=false;
    if(_folderQueued)queueMicrotask(_flushLocalFolderSave);
  }
}

function disconnectLocalFolder(){
  if(_folderBusy||_folderWriting){toast('Esperá a que termine el guardado actual.');return false;}
  _folderFile=null;_folderExpected=null;_folderName='';_folderQueued=false;_folderPaused=false;
  _folderStatus('Carpeta desconectada. La copia del navegador se conserva.');
  return true;
}
