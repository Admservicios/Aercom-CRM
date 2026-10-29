const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const data=id=>({clientes:[{id,nombre:id}],equipos:[],cotizaciones:[],pedidos:[],recordatorios:[],eventos:[],facturacion_estados:{},lastSaved:'2026-10-29'});

function fixture(existing){
  const original=JSON.stringify(data('LOCAL')),memory=new Map([['aercom-data',original]]),nodes=new Map(),files=new Map();
  const ctl={answer:true,permission:false,writeError:false,closeError:false,quota:false,closed:0,aborts:0,active:0,max:0,marked:0,prompts:0,hold:null};
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',style:{}});return nodes.get(id);};
  function makeFile(name,raw){
    return {name,raw,
      async getFile(){return{size:Buffer.byteLength(this.raw),text:async()=>this.raw};},
      async createWritable(){
        if(ctl.permission)throw new DOMException('Permiso denegado','NotAllowedError');
        ctl.active++;ctl.max=Math.max(ctl.max,ctl.active);let pending='',done=false;const file=this;
        return {async write(raw){if(ctl.writeError)throw Error('Sin espacio');pending=raw;},
          async close(){if(ctl.hold)await ctl.hold;if(ctl.closeError)throw Error('Error de cierre');file.raw=pending;ctl.closed++;done=true;ctl.active--;},
          async abort(){ctl.aborts++;if(!done){done=true;ctl.active--;}}};
      }};
  }
  const dir={name:'Datos prueba',async getFileHandle(name,options){
    if(!files.has(name)){if(!options?.create)throw new DOMException('Ausente','NotFoundError');files.set(name,makeFile(name,''));}
    return files.get(name);
  }};
  if(existing!==undefined)files.set('aercom-data.json',makeFile('aercom-data.json',existing));
  const c=vm.createContext({D:data('LOCAL'),DEFAULT:data('LOCAL'),document:{getElementById:node},
    localStorage:{getItem:key=>memory.get(key)??null,setItem(key,val){if(ctl.quota)throw Error('Cuota');memory.set(key,val);}},
    window:{isSecureContext:true,showDirectoryPicker:async()=>dir,confirm(){ctl.prompts++;return ctl.answer;}},
    crypto:{randomUUID:()=>String(ctl.prompts)+'-prueba'},queueMicrotask,toast(){},markUnsaved(){},markSaved(){ctl.marked++;},updateSidebarBadges(){},renderModule(){}});
  for(const file of ['js/utils.js','js/storage.js','js/local-folder.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  c.loadData();c.persist=()=>{c._persistBase();return true;};
  return {c,ctl,files,dir,node,memory,original,set(raw){memory.set('aercom-data',raw);},async flush(){for(let i=0;i<8;i++)await tick();}};
}

test('carpeta nueva: crea copia válida y confirma solo al terminar el cierre',async()=>{
  const f=fixture();await f.c.connectLocalFolder();await f.flush();
  assert.equal(f.files.get('aercom-data.json').raw,f.original);assert.equal(f.ctl.closed,1);assert.equal(f.ctl.marked,1);
  assert.match(f.node('folder-status').textContent,/actualizado/);
});
test('archivo igual: conecta sin reemplazar ni pedir cargar datos',async()=>{
  const f=fixture(JSON.stringify(data('LOCAL')));await f.c.connectLocalFolder();await f.flush();
  assert.equal(f.ctl.closed,0);assert.equal(f.ctl.prompts,0);assert.equal(f.memory.get('aercom-data'),f.original);
});
test('archivo diferente: conserva copia del navegador antes de cargar el archivo',async()=>{
  const f=fixture(JSON.stringify(data('CARPETA')));await f.c.connectLocalFolder();await f.flush();
  assert.equal(f.c.D.clientes[0].id,'CARPETA');
  const backups=[...f.files].filter(([name])=>name.startsWith('aercom-respaldo-navegador-'));
  assert.equal(backups.length,1);assert.equal(backups[0][1].raw,f.original);
  assert.equal(JSON.parse(f.files.get('aercom-data.json').raw).clientes[0].id,'CARPETA');
});
test('cancelar carga o creación no cambia datos ni escribe archivos',async()=>{
  for(const raw of [undefined,JSON.stringify(data('OTRA'))]){
    const f=fixture(raw);f.ctl.answer=false;await f.c.connectLocalFolder();await f.flush();
    assert.equal(f.memory.get('aercom-data'),f.original);assert.equal(f.ctl.closed,0);
    assert.equal(f.files.size,raw===undefined?0:1);
  }
});
test('archivo vacío/dañado se conserva sin reemplazo',async()=>{
  for(const raw of ['', '{mal']){
    const f=fixture(raw);await f.c.connectLocalFolder();await f.flush();
    assert.equal(f.files.get('aercom-data.json').raw,raw);assert.equal(f.ctl.closed,0);assert.equal(f.memory.get('aercom-data'),f.original);
  }
});
for(const error of ['writeError','closeError','permission'])test(`fallo ${error}: pausa y conserva datos del navegador`,async()=>{
  const f=fixture(JSON.stringify(data('LOCAL')));await f.c.connectLocalFolder();await f.flush();const initial=f.files.get('aercom-data.json').raw;
  f.ctl[error]=true;f.set(JSON.stringify(data('NUEVO')));f.c.scheduleLocalFolderSave();await f.flush();
  assert.equal(f.files.get('aercom-data.json').raw,initial);assert.equal(JSON.parse(f.memory.get('aercom-data')).clientes[0].id,'NUEVO');
  assert.match(f.node('folder-status').textContent,/pausado/);
});
test('serializa cambios rápidos y conserva la versión más reciente sin escritores paralelos',async()=>{
  const f=fixture();await f.c.connectLocalFolder();await f.flush();let release;
  f.ctl.hold=new Promise(resolve=>{release=resolve;});f.set(JSON.stringify(data('PRIMERO')));f.c.scheduleLocalFolderSave();await tick();
  assert.equal(f.ctl.active,1);f.set(JSON.stringify(data('ULTIMO')));f.c.scheduleLocalFolderSave();f.ctl.hold=null;release();await f.flush();
  assert.equal(JSON.parse(f.files.get('aercom-data.json').raw).clientes[0].id,'ULTIMO');assert.equal(f.ctl.max,1);
});
test('cambio externo pausa sin sobrescribir ninguna copia',async()=>{
  const f=fixture();await f.c.connectLocalFolder();await f.flush();f.files.get('aercom-data.json').raw=JSON.stringify(data('EXTERNO'));
  const local=JSON.stringify(data('LOCAL_NUEVO'));f.set(local);f.c.scheduleLocalFolderSave();await f.flush();
  assert.equal(JSON.parse(f.files.get('aercom-data.json').raw).clientes[0].id,'EXTERNO');assert.equal(f.memory.get('aercom-data'),local);
  assert.match(f.node('folder-status').textContent,/cambió fuera/);
});
test('si falla el respaldo previo no se cargan ni reemplazan los datos',async()=>{
  const raw=JSON.stringify(data('CARPETA')),f=fixture(raw);f.ctl.writeError=true;await f.c.connectLocalFolder();await f.flush();
  assert.equal(f.files.get('aercom-data.json').raw,raw);assert.equal(f.memory.get('aercom-data'),f.original);assert.equal(f.c.D.clientes[0].id,'LOCAL');
});
test('cuota del navegador al cargar conserva el archivo y la copia local',async()=>{
  const raw=JSON.stringify(data('CARPETA')),f=fixture(raw);f.ctl.quota=true;await f.c.connectLocalFolder();await f.flush();
  assert.equal(f.files.get('aercom-data.json').raw,raw);assert.equal(f.memory.get('aercom-data'),f.original);assert.equal(f.c.D.clientes[0].id,'LOCAL');
});
test('microtarea lee el estado estable tras una recuperación, no una mutación revertida',async()=>{
  const f=fixture();await f.c.connectLocalFolder();await f.flush();const before=f.files.get('aercom-data.json').raw;
  f.set(JSON.stringify(data('TRANSITORIO')));f.c.scheduleLocalFolderSave();f.set(before);await f.flush();
  assert.equal(f.files.get('aercom-data.json').raw,before);
});
test('desconectar detiene escrituras posteriores',async()=>{
  const f=fixture();await f.c.connectLocalFolder();await f.flush();const before=f.files.get('aercom-data.json').raw;
  assert.equal(f.c.disconnectLocalFolder(),true);f.set(JSON.stringify(data('OTRO')));f.c.scheduleLocalFolderSave();await f.flush();
  assert.equal(f.files.get('aercom-data.json').raw,before);
});
test('sin API o con selector cancelado no escribe ni altera los datos',async()=>{
  for(const supported of [false,true]){
    const f=fixture();if(supported)f.c.window.showDirectoryPicker=async()=>{throw new DOMException('Cancelado','AbortError');};else delete f.c.window.showDirectoryPicker;
    await f.c.connectLocalFolder();await f.flush();assert.equal(f.files.size,0);assert.equal(f.memory.get('aercom-data'),f.original);
  }
});
test('cambios del navegador mientras se elige carpeta no se reemplazan',async()=>{
  const raw=JSON.stringify(data('CARPETA')),f=fixture(raw),latest=JSON.stringify(data('MAS_RECIENTE'));
  f.c.window.showDirectoryPicker=async()=>{f.set(latest);return f.dir;};
  await f.c.connectLocalFolder();await f.flush();assert.equal(f.memory.get('aercom-data'),latest);assert.equal(f.files.get('aercom-data.json').raw,raw);
});
test('cambio del archivo durante la confirmación impide cargar una versión vieja',async()=>{
  const f=fixture(JSON.stringify(data('CARPETA'))),latest=JSON.stringify(data('EXTERNO'));
  f.c.window.confirm=()=>{f.files.get('aercom-data.json').raw=latest;return true;};
  await f.c.connectLocalFolder();await f.flush();assert.equal(f.memory.get('aercom-data'),f.original);assert.equal(f.files.get('aercom-data.json').raw,latest);
});
test('no desconecta ni confirma el guardado mientras el cierre está pendiente',async()=>{
  const f=fixture();await f.c.connectLocalFolder();await f.flush();const marked=f.ctl.marked;let release;
  f.ctl.hold=new Promise(resolve=>{release=resolve;});f.set(JSON.stringify(data('CAMBIO')));f.c.scheduleLocalFolderSave();await tick();
  assert.equal(f.c.disconnectLocalFolder(),false);assert.equal(f.ctl.marked,marked);assert.equal(f.c.isLocalFolderPending(),true);
  f.ctl.hold=null;release();await f.flush();assert.equal(f.ctl.marked,marked+1);assert.equal(f.c.isLocalFolderPending(),false);
});
test('no carga datos de carpeta sobre un formulario abierto',async()=>{
  const f=fixture(JSON.stringify(data('CARPETA')));f.node('ficha-overlay').classList={contains:()=>true};
  await f.c.connectLocalFolder();await f.flush();assert.equal(f.ctl.prompts,0);assert.equal(f.memory.get('aercom-data'),f.original);
});
