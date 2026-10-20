// node --test tests/storage-recovery-import.test.js — datos ficticios, sin cuentas reales.
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/storage.js'),'utf8');
const valid=()=>({clientes:[{id:'C-ROS',nombre:'Sucursal Rosario',extra:{conservar:true}},{id:'C-SFE',nombre:'Sucursal Santa Fe'}],equipos:[{id:'E1',clienteId:'C-ROS'},{id:'E2',clienteId:'C-SFE'}],cotizaciones:[]});
function fixture(){
 const original=JSON.stringify({...valid(),clientes:[{id:'C',nombre:'Sucursal Rosario'},{id:'C',nombre:'Sucursal Santa Fe'}]});
 const memory=new Map([['aercom-data',original],['aercom-drive-connected','1']]),sessionMemory=new Map(),control={writes:0,reloads:0,confirms:0,confirmed:true,quota:false,read:false,session:false,defer:false,reloadFailure:false},nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{checked:true,textContent:'',value:'selección'});return nodes.get(id);};
 const c=vm.createContext({D:{},DEFAULT:valid(),Blob,document:{getElementById:node,createElement:()=>({click(){}})},URL:{createObjectURL:()=> 'blob:prueba',revokeObjectURL(){}},setTimeout(){},
  localStorage:{getItem(key){if(control.read)throw Error('Lectura denegada');return memory.get(key)??null;},setItem(key,value){if(control.quota)throw Error('Cuota agotada');control.writes++;memory.set(key,value);}},
  sessionStorage:{setItem(key,value){if(control.session)throw Error('Sesión bloqueada');sessionMemory.set(key,value);}},
  window:{confirm(){control.confirms++;return control.confirmed;}},location:{reload(){if(control.reloadFailure)throw Error('Recarga bloqueada');control.reloads++;}},
  FileReader:class{constructor(){control.reader=this;}readAsText(file){if(file.throw)throw Error('No leer');if(control.defer)return;if(file.error)this.onerror();else if(file.abort)this.onabort();else this.onload({target:{result:file.text}});}}
 });
 vm.runInContext(source,c);assert.equal(c.loadData(),false);
 const session=()=>vm.runInContext('_storageLoadError',c);
 function importText(text=JSON.stringify(valid()),options={}){const target={files:[{text,...options}],value:'selección'};c._importStorageRecovery({target});return target;}
 return{c,memory,sessionMemory,control,node,session,original,importText,exportOriginal:()=>c._downloadStorageOriginal(),status:()=>node('storage-recovery-status').textContent};
}
test('Restauración validada escribe una copia sin depender de sesión ni activar memoria ni editar otros datos',()=>{
 const f=fixture();f.c._restoreStorageBackup(JSON.stringify(valid()),f.session());const saved=JSON.parse(f.memory.get('aercom-data'));
 assert.equal(saved.clientes.length,2);assert.equal(saved.clientes[0].extra.conservar,true);assert.equal(saved.equipos[1].clienteId,'C-SFE');assert.equal(f.control.writes,1);assert.equal(f.memory.get('aercom-drive-connected'),'1');assert.equal(f.sessionMemory.size,0);assert.equal(JSON.stringify(f.c.D),'{}');assert.equal(f.session().raw,f.original);
});
for(const [name,text] of [['JSON truncado','{'],['IDs duplicados',JSON.stringify({...valid(),clientes:[{id:'C',nombre:'A'},{id:'C',nombre:'B'}]})],['fecha imposible',JSON.stringify({...valid(),lastSaved:'2026-02-30'})]])test(`Archivo rechazado (${name}) conserva original y no pide confirmación`,()=>{
 const f=fixture();f.exportOriginal();f.importText(text);assert.equal(f.memory.get('aercom-data'),f.original);assert.equal(f.control.writes,0);assert.equal(f.control.confirms,0);assert.equal(f.control.reloads,0);assert.match(f.status(),/No se restauró/);
});
for(const failure of ['quota','read'])test(`Restauración ante ${failure} conserva original y no recarga`,()=>{
 const f=fixture();f.exportOriginal();f.control[failure]=true;const target=f.importText();assert.equal(f.memory.get('aercom-data'),f.original);assert.equal(f.control.writes,0);assert.equal(f.control.reloads,0);assert.equal(target.value,'');assert.match(f.status(),/No se restauró/);
});
test('No sobrescribe si otra pestaña cambió o eliminó la copia local',()=>{
 for(const raw of [null,JSON.stringify(valid())]){const f=fixture();f.exportOriginal();if(raw===null)f.memory.delete('aercom-data');else f.memory.set('aercom-data',raw);f.importText();assert.equal(f.memory.get('aercom-data')??null,raw);assert.equal(f.control.writes,0);assert.match(f.status(),/otra pestaña/);}
});
test('Cancelar confirmación conserva datos y libera una nueva selección',()=>{
 const f=fixture();f.exportOriginal();f.control.confirmed=false;const target=f.importText();assert.equal(f.control.confirms,1);assert.equal(f.control.writes,0);assert.equal(f.control.reloads,0);assert.equal(target.value,'');f.control.confirmed=true;f.importText();assert.equal(f.control.writes,1);assert.equal(f.control.reloads,1);
});
test('Exige descarga y confirmación de copia guardada antes de leer el archivo',()=>{
 const f=fixture();f.importText();assert.equal(f.control.reader,undefined);assert.equal(f.control.writes,0);assert.match(f.status(),/descargá/);f.exportOriginal();f.node('storage-recovery-backed-up').checked=false;f.importText();assert.equal(f.control.reader,undefined);assert.equal(f.control.writes,0);
});
test('Cambio de sesión de recuperación rechaza un FileReader tardío',()=>{
 const f=fixture();f.exportOriginal();f.control.defer=true;const target=f.importText();f.c.loadData();f.control.reader.onload({target:{result:JSON.stringify(valid())}});assert.equal(f.memory.get('aercom-data'),f.original);assert.equal(f.control.writes,0);assert.equal(f.control.reloads,0);assert.equal(target.value,'');assert.match(f.status(),/ya no corresponde/);
});
test('Selecciones simultáneas no abren lectores adicionales',()=>{
 const f=fixture();f.exportOriginal();f.control.defer=true;f.importText();const reader=f.control.reader;const second=f.importText();assert.equal(f.control.reader,reader);assert.equal(second.value,'');reader.onload({target:{result:JSON.stringify(valid())}});assert.equal(f.control.writes,1);assert.equal(f.control.reloads,1);
});
for(const failure of ['error','abort','throw'])test(`Fallo de lectura ${failure} conserva original y permite reintentar`,()=>{
 const f=fixture();f.exportOriginal();const target=f.importText(undefined,{[failure]:true});assert.equal(f.memory.get('aercom-data'),f.original);assert.equal(f.control.writes,0);assert.equal(target.value,'');f.importText();assert.equal(f.control.writes,1);assert.equal(f.control.reloads,1);
});
test('Una recarga impedida no informa falsamente que la escritura falló',()=>{
 const f=fixture();f.exportOriginal();f.control.reloadFailure=true;f.importText();assert.equal(f.control.writes,1);assert.equal(JSON.parse(f.memory.get('aercom-data')).clientes[0].id,'C-ROS');assert.match(f.status(),/La copia se restauró/);assert.match(f.status(),/manualmente/);
});
test('Una copia inicialmente ilegible no puede reemplazarse desde esta recuperación',()=>{
 const f=fixture();f.control.read=true;f.c.loadData();assert.throws(()=>f.c._restoreStorageBackup(JSON.stringify(valid()),f.session()),/ya no corresponde/);assert.equal(f.control.writes,0);assert.equal(f.memory.get('aercom-data'),f.original);
});

test('Restauración local funciona aunque sessionStorage esté bloqueado',async()=>{
 const f=fixture();f.control.session=true;f.exportOriginal();f.importText();assert.equal(f.control.writes,1);assert.equal(f.control.reloads,1);assert.equal(f.sessionMemory.size,0);
});
