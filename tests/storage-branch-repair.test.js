// node --test tests/storage-branch-repair.test.js — planes y datos ficticios en memoria.
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash,webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../js/storage.js'),'utf8');
function fixture(change=data=>data){
 const data=change({clientes:[{id:'C',nombre:'Sucursal norte',extra:{conservar:true}},{id:'C',nombre:'Sucursal sur'},{id:'OTRO',nombre:'Otro cliente'}],equipos:[{id:'E1',clienteId:'C',ubicacion:'Norte'},{id:'E2',clienteId:'C',ubicacion:'Sur'}],cotizaciones:[],pedidos:[],recordatorios:[],eventos:[],facturacion_estados:{},extra:{noTocar:[false,0,null]}}),raw=JSON.stringify(data);
 const memory=new Map([['aercom-data',raw]]),sessionMemory=new Map(),nodes=new Map(),control={writes:0,reloads:0,confirms:0,confirmed:true,quota:false,session:false,reloadFailure:false};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{checked:true,value:'',textContent:''});return nodes.get(id);};
 const c=vm.createContext({D:{},crypto:webcrypto,TextEncoder,document:{getElementById:node,createElement:()=>({click(){}})},Blob,URL:{createObjectURL:()=> 'blob:prueba',revokeObjectURL(){}},setTimeout(){},
  localStorage:{getItem:key=>memory.get(key)??null,setItem(key,value){if(control.quota)throw Error('Cuota agotada');memory.set(key,value);control.writes++;}},
  sessionStorage:{setItem(key,value){if(control.session)throw Error('Sesión bloqueada');sessionMemory.set(key,value);}},
  window:{confirm(){control.confirms++;return control.confirmed;}},location:{reload(){if(control.reloadFailure)throw Error('Recarga bloqueada');control.reloads++;}}
 });vm.runInContext(source,c);c.loadData();
 const plan={sha256:createHash('sha256').update(raw).digest('hex'),clientes:[[0,'C-NORTE'],[1,'C-SUR']],referencias:[['equipos',0,0],['equipos',1,1]]};
 return{c,data,raw,plan,memory,sessionMemory,node,control,prepare:()=>c._prepareStorageBranchRepair(raw,plan),apply:async()=>{node('storage-recovery-plan').value=JSON.stringify(plan);await c._applyStorageBranchRepair();},backup:()=>c._downloadStorageOriginal(),status:()=>node('storage-recovery-status').textContent};
}
test('Plan revisado cambia solo códigos y asignaciones explícitos, sin escribir durante preparación',async()=>{
 const f=fixture(),p=await f.prepare(),actual=JSON.parse(p.text),expected=JSON.parse(f.raw);expected.clientes[0].id='C-NORTE';expected.clientes[1].id='C-SUR';expected.equipos[0].clienteId='C-NORTE';expected.equipos[1].clienteId='C-SUR';assert.deepEqual(actual,expected);assert.equal(p.clients,2);assert.equal(p.references,2);assert.equal(f.memory.get('aercom-data'),f.raw);assert.equal(f.control.writes,0);
});
for(const [name,mutate] of [
 ['hash diferente',p=>p.sha256='0'.repeat(64)],['hash ausente',p=>delete p.sha256],['campo inesperado',p=>p.eliminar=true],
 ['código inválido',p=>p.clientes[0][1]='<img>'],['índice negativo',p=>p.clientes[0][0]=-1],['sucursal repetida',p=>p.clientes.push(p.clientes[0])],
 ['código igual al previo',p=>p.clientes[0][1]='C'],['código final duplicado',p=>p.clientes[1][1]='C-NORTE'],['colisión con otro cliente',p=>p.clientes[0][1]='OTRO'],
 ['sucursal del grupo omitida',p=>p.clientes.pop()],['cliente sin duplicado',p=>p.clientes.push([2,'OTRO-NUEVO'])],
 ['referencia omitida',p=>p.referencias.pop()],['referencia repetida',p=>p.referencias.push(p.referencias[0])],
 ['destino inexistente',p=>p.referencias[0][2]=2],['registro inexistente',p=>p.referencias[0][1]=999],['colección no permitida',p=>p.referencias[0][0]='clientes']
])test(`Rechazar ${name} no escribe ni modifica el original`,async()=>{
 const f=fixture();mutate(f.plan);await assert.rejects(f.prepare());assert.equal(f.memory.get('aercom-data'),f.raw);assert.equal(f.control.writes,0);
});
for(const [name,mutate] of [
 ['facturación mensual',d=>{d.facturacion_estados={'2026-10':{C:'Cobrado'}};return d;}],
 ['facturación heredada',d=>{d.facturacion_clientes=[{id:'F1',nombre:'Sucursal norte'}];return d;}],
 ['referencia ajena al grupo',d=>{d.equipos[0].clienteId='OTRO';return d;}],
 ['registro adicional sin asignar',d=>{d.recordatorios=[{id:'R1',titulo:'Llamar',clienteId:'C'}];return d;}]
])test(`Revisión adicional requerida para ${name}`,async()=>{
 const f=fixture(mutate);await assert.rejects(f.prepare());assert.equal(f.control.writes,0);assert.equal(f.memory.get('aercom-data'),f.raw);
});
test('Aplicar exige copia original guardada y confirmación antes de escribir',async()=>{
 const f=fixture();await f.apply();assert.equal(f.control.writes,0);assert.equal(f.control.confirms,0);f.backup();f.node('storage-recovery-backed-up').checked=false;await f.apply();assert.equal(f.control.writes,0);f.node('storage-recovery-backed-up').checked=true;f.control.confirmed=false;await f.apply();assert.equal(f.control.confirms,1);assert.equal(f.control.writes,0);f.control.confirmed=true;await f.apply();assert.equal(f.control.writes,1);assert.equal(f.control.reloads,1);assert.equal(f.sessionMemory.get('aercom-recovery-pause-drive'),'1');assert.equal(JSON.parse(f.memory.get('aercom-data')).clientes[0].extra.conservar,true);
});
test('Copia cambiada durante preparación se rechaza sin sobrescribirla',async()=>{
 const f=fixture();f.backup();f.memory.set('aercom-data','otra copia');await f.apply();assert.equal(f.memory.get('aercom-data'),'otra copia');assert.equal(f.control.writes,0);assert.match(f.status(),/otra pestaña/);
});
test('Cambio de sesión mientras se calcula el hash impide aplicar el plan',async()=>{
 const f=fixture();f.backup();f.node('storage-recovery-plan').value=JSON.stringify(f.plan);const pending=f.c._applyStorageBranchRepair();f.c.loadData();await pending;assert.equal(f.control.writes,0);assert.match(f.status(),/ya no corresponde/);
});
test('Doble aplicación concurrente solo confirma y escribe una vez',async()=>{
 const f=fixture();f.backup();await Promise.all([f.apply(),f.apply()]);assert.equal(f.control.confirms,1);assert.equal(f.control.writes,1);assert.equal(f.control.reloads,1);
});
for(const error of ['quota','session'])test(`Fallo ${error} conserva original y permite reintento`,async()=>{
 const f=fixture();f.backup();f.control[error]=true;await f.apply();assert.equal(f.memory.get('aercom-data'),f.raw);assert.equal(f.control.writes,0);assert.equal(f.control.reloads,0);f.control[error]=false;await f.apply();assert.equal(f.control.writes,1);assert.equal(f.control.reloads,1);
});
test('JSON de plan inválido o hash no disponible no habilita ni modifica datos',async()=>{
 const f=fixture();f.backup();f.node('storage-recovery-plan').value='{';await f.c._applyStorageBranchRepair();assert.equal(f.control.writes,0);f.c.crypto={};await f.apply();assert.equal(f.control.writes,0);assert.equal(f.memory.get('aercom-data'),f.raw);assert.equal(f.control.reloads,0);
});
test('Recarga impedida informa la escritura exitosa y conserva pausa de Drive',async()=>{
 const f=fixture();f.backup();f.control.reloadFailure=true;await f.apply();assert.equal(f.control.writes,1);assert.match(f.status(),/La corrección se guardó/);assert.match(f.status(),/manualmente/);assert.equal(f.sessionMemory.get('aercom-recovery-pause-drive'),'1');
});
