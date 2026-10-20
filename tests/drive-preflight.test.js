// node --test tests/drive-preflight.test.js — OAuth/HTTP/DOM ficticios, sin cuentas reales.
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const seed=()=>({clientes:[{id:'C-1',nombre:'Sucursal norte'},{id:'C-2',nombre:'Sucursal sur'}],equipos:[{id:'E1',clienteId:'C-1'}],cotizaciones:[],lastSaved:'2026-10-20'});
function fixture(){
 const memory=new Map([['aercom-data',JSON.stringify(seed())]]),nodes=new Map(),calls=[],responses=[],messages=[],timers=[],downloads=[];
 const control={writes:0,saved:0,pending:false,callback:null};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},textContent:'',hidden:true,disabled:false,open:false,querySelector:()=>null,showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
 const c=vm.createContext({D:seed(),DEFAULT:seed(),today:()=> '2026-10-20',console:{error(){}},Blob,
  document:{getElementById:node,createElement:()=>({click(){downloads.push(this);}})},URL:{createObjectURL:blob=>{control.blob=blob;return 'blob:prueba';},revokeObjectURL(){}},
  localStorage:{getItem:key=>memory.get(key)??null,setItem(key,value){control.writes++;memory.set(key,value);},removeItem:key=>memory.delete(key)},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},markSaved(){control.saved++;},markUnsaved(){control.pending=true;},toast:message=>messages.push(message),
  fetch:async(url,options)=>{calls.push({url,...options});assert.ok(responses.length,'HTTP inesperado');const response=responses.shift();if(response instanceof Error)throw response;return typeof response==='function'?response():response;}
 });
 vm.runInContext(read('js/storage.js'),c);c.loadData();vm.runInContext(read('js/modules/drive.js'),c);
 vm.runInContext("_gdriveToken='test';_gdriveReady=true;_folderRootId='root';_gdriveDataFileId='old-id'",c);
 const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data,text:async()=>typeof data==='string'?data:JSON.stringify(data)});
 const remote=data=>{responses.push(response(200,{files:[{id:'file'}]}),response(200,data));};
 const snap=()=>JSON.stringify([c.D,memory.get('aercom-data')]);
 function oauth(){c.window={google:{accounts:{}}};c._loadGIS=async()=>{};c.google={accounts:{oauth2:{initTokenClient(options){control.callback=options.callback;return{requestAccessToken(){}};}},revoke(){}}};}
 return{c,memory,node,calls,responses,messages,timers,downloads,control,response,remote,snap,oauth,checked:()=>vm.runInContext('_gdriveSyncChecked',c)};
}
for(const [name,text] of [
 ['JSON truncado','{'],['backup sin colecciones','{}'],['código de sucursal repetido',JSON.stringify({...seed(),clientes:[{id:'C',nombre:'Norte'},{id:'C',nombre:'Sur'}]})]
])test(`Backup rechazado (${name}) bloquea subidas posteriores sin crear otro archivo`,async()=>{
 const f=fixture(),before=f.snap();f.remote(text);assert.equal(await f.c._gdriveLoadData(),false);assert.equal(f.snap(),before);assert.equal(f.checked(),false);assert.equal(await f.c._gdriveSaveData(),false);f.c._scheduleDriveSave();assert.equal(f.calls.length,2);assert.equal(f.control.writes,0);assert.equal(f.node('drive-review-dialog').open,true);assert.equal(f.node('drive-review-remote').disabled,false);
});
for(const lastSaved of ['1900-01-01','2026-10-20','2099-01-01'])test(`Copia distinta con fecha ${lastSaved} no reemplaza ninguna versión`,async()=>{
 const f=fixture(),before=f.snap();f.remote({...seed(),lastSaved,clientes:[{id:'OTRO',nombre:'Otro'}]});assert.equal(await f.c._gdriveLoadData(),false);assert.equal(f.snap(),before);assert.equal(f.calls.filter(r=>r.method==='PATCH'||r.method==='POST').length,0);assert.equal(await f.c._gdriveSaveData(),false);assert.equal(f.node('btn-drive-review').hidden,false);assert.match(f.node('btn-drive-text').textContent,/pausada/);
});
test('Igual contenido normalizado con orden de propiedades y fecha distintos verifica sin escribir',async()=>{
 const f=fixture(),before=f.snap();f.remote({lastSaved:'2099-01-01',cotizaciones:[],equipos:[{clienteId:'C-1',id:'E1'}],clientes:[{nombre:'Sucursal norte',id:'C-1'},{nombre:'Sucursal sur',id:'C-2'}]});assert.equal(await f.c._gdriveLoadData(),true);assert.equal(f.checked(),true);assert.equal(f.snap(),before);assert.equal(f.control.writes,0);assert.equal(f.control.saved,0);assert.equal(f.node('btn-drive-review').hidden,true);assert.equal(vm.runInContext('_gdriveDataFileId',f.c),'file');
 f.responses.push(f.response(204));assert.equal(await f.c._gdriveSaveData(),true);assert.equal(f.calls.at(-1).method,'PATCH');assert.equal(f.control.saved,1);
});
for(const files of [[{id:'a'},{id:'b'}],[{}]])test('Lista duplicada/incompatible no descarga ni crea archivos',async()=>{
 const f=fixture(),before=f.snap();f.responses.push(f.response(200,{files}));assert.equal(await f.c._gdriveLoadData(),false);assert.equal(f.calls.length,1);assert.equal(f.snap(),before);assert.equal(await f.c._gdriveSaveData(),false);assert.equal(f.node('drive-review-remote').disabled,true);
});
test('Resultados paginados requieren revisión, sin elegir la primera página',async()=>{
 const f=fixture();f.responses.push(f.response(200,{files:[{id:'file'}],nextPageToken:'more'}));await f.c._gdriveLoadData();assert.equal(f.checked(),false);assert.equal(f.calls.length,1);
});
for(const stage of ['búsqueda','descarga'])test(`HTTP fallido en ${stage} impide la creación como alternativa`,async()=>{
 const f=fixture(),before=f.snap();if(stage==='descarga')f.responses.push(f.response(200,{files:[{id:'file'}]}));f.responses.push(f.response(403));await f.c._gdriveLoadData();assert.equal(f.snap(),before);assert.equal(f.checked(),false);assert.equal(await f.c._gdriveSaveData(),false);assert.equal(f.control.writes,0);
});
test('Ausencia verificada permite crear el primer backup sin afirmar que existía',async()=>{
 const f=fixture();f.responses.push(f.response(200,{files:[]}),f.response(201,{id:'created'}),f.response(204));assert.equal(await f.c._gdriveLoadData(),true);assert.equal(f.checked(),true);assert.deepEqual(f.calls.map(c=>c.method||'GET'),['GET','POST','PATCH']);
});
test('Cambio local durante lectura pausa sin descartar la edición',async()=>{
 const f=fixture();f.responses.push(f.response(200,{files:[{id:'file'}]}),()=>{f.c.D.clientes[0].nombre='Edición durante lectura';return f.response(200,seed());});await f.c._gdriveLoadData();assert.equal(f.c.D.clientes[0].nombre,'Edición durante lectura');assert.equal(f.checked(),false);assert.equal(f.control.writes,0);
});
test('Desconexión durante lectura ignora la respuesta y no muestra conflicto tardío',async()=>{
 const f=fixture();let finish;f.responses.push(f.response(200,{files:[{id:'file'}]}),()=>new Promise(r=>finish=r));const job=f.c._gdriveLoadData();while(!finish)await Promise.resolve();f.c.window={};f.c.gdriveDisconnect();finish(f.response(200,seed()));assert.equal(await job,false);assert.equal(f.checked(),false);assert.equal(f.node('drive-review-dialog').open,false);assert.equal(vm.runInContext('_gdriveReady',f.c),false);
});
test('Una revisión posterior invalida una respuesta anterior pendiente',async()=>{
 const f=fixture();let finish;f.responses.push(f.response(200,{files:[{id:'first'}]}),()=>new Promise(r=>finish=r));const first=f.c._gdriveLoadData();while(!finish)await Promise.resolve();f.remote(seed());assert.equal(await f.c._gdriveLoadData(),true);finish(f.response(200,{...seed(),clientes:[{id:'CAMBIO',nombre:'Anterior'}]}));assert.equal(await first,false);assert.equal(f.checked(),true);assert.equal(vm.runInContext('_gdriveDataFileId',f.c),'file');
});
for(const method of ['gdriveAuth','_tryAutoConnectDrive'])test(`${method} verifica antes de permitir el guardado`,async()=>{
 const f=fixture();f.oauth();f.c._gdriveEnsureFolders=async()=>{vm.runInContext("_folderRootId='root'",f.c);};await f.c[method]();f.remote({...seed(),clientes:[{id:'OTRA',nombre:'Otra versión'}]});await f.control.callback({access_token:'test-new'});assert.equal(f.checked(),false);assert.equal(await f.c._gdriveSaveData(),false);assert.equal(f.control.writes,method==='gdriveAuth'?1:0);assert.equal(f.node('drive-review-dialog').open,method==='gdriveAuth');assert.equal(f.calls.length,2);
});
test('Preflight silencioso permite reabrir revisión sin bloquear automáticamente la pantalla',async()=>{
 const f=fixture();f.remote('{');await f.c._gdriveLoadData(false);assert.equal(f.node('drive-review-dialog').open,false);assert.equal(f.node('btn-drive-review').hidden,false);f.c._gdriveShowReview();assert.equal(f.node('drive-review-dialog').open,true);
});
test('Descargar remoto inválido conserva el texto y descargar local toma las ediciones actuales',async()=>{
 const f=fixture(),raw=' { <img src=x onerror=alert(1)>\n';f.remote(raw);await f.c._gdriveLoadData();f.c._gdriveDownloadReview('remote');assert.equal(await f.control.blob.text(),raw);assert.equal(f.downloads[0].download,'aercom-drive-revisar.txt');f.c.D.clientes[0].nombre='Edición posterior';f.c._gdriveDownloadReview('local');assert.equal(JSON.parse(await f.control.blob.text()).clientes[0].nombre,'Edición posterior');assert.equal(f.control.writes,0);
});
test('Carpetas duplicadas bloquean la preparación sin crear ni elegir una',async()=>{
 const f=fixture();f.responses.push(f.response(200,{files:[{id:'a'},{id:'b'}]}));await assert.rejects(f.c._gdriveGetOrCreateFolder('Aercom Gestion',null),/duplicadas/);assert.equal(f.calls.length,1);
});
test('Sin revisión previa ni siquiera un guardado directo inicia HTTP',async()=>{
 const f=fixture();assert.equal(await f.c._gdriveSaveData(),false);f.c._scheduleDriveSave();assert.equal(f.calls.length,0);assert.equal(f.control.writes,0);assert.equal(f.timers.length,0);
});
test('Desconexión durante preparación de carpetas no publica IDs ni inicia las siguientes',async()=>{
 const f=fixture();let finish;f.responses.push(()=>new Promise(r=>finish=r));const job=f.c._gdriveEnsureFolders();while(!finish)await Promise.resolve();f.c.window={};f.c.gdriveDisconnect();finish(f.response(200,{files:[{id:'old-root'}]}));await assert.rejects(job,/sesión/);assert.equal(f.calls.length,1);assert.equal(vm.runInContext('_folderRootId',f.c),null);
});
for(const creation of [false,true])test(`Una subida iniciada antes de desconectar no confirma otra sesión; creación=${creation}`,async()=>{
 const f=fixture();vm.runInContext(`_gdriveSyncChecked=true;_gdriveDataFileId=${creation?'null':"'file'"}`,f.c);let finish;f.responses.push(()=>new Promise(r=>finish=r));const job=f.c._gdriveSaveData();while(!finish)await Promise.resolve();f.c.window={};f.c.gdriveDisconnect();finish(f.response(creation?201:204,creation?{id:'old-file'}:undefined));assert.equal(await job,false);assert.equal(f.control.saved,0);assert.equal(vm.runInContext('_gdriveDataFileId',f.c),null);assert.equal(f.calls.length,1);
});
