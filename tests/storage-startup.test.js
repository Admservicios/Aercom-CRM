// node --test tests/storage-startup.test.js — sin almacenamiento ni cuentas reales.
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const valid=()=>({clientes:[{id:'C1',nombre:'Original',extra:{conservar:true}}],equipos:[],cotizaciones:[]});
function fixture(raw=JSON.stringify(valid()),blocked=false){
 const memory=new Map(raw===null?[]:[['aercom-data',raw]]),control={blocked,writes:0};
 const c=vm.createContext({D:{},DEFAULT:valid(),localStorage:{getItem(key){if(control.blocked)throw Error('SecurityError');return memory.get(key)??null;},setItem(){control.writes++;throw Error('No debe escribir al iniciar');},removeItem(){control.writes++;throw Error('No debe eliminar al iniciar');}}});
 vm.runInContext(read('js/storage.js'),c);
 return{c,memory,control,state:()=>vm.runInContext('({error:_storageLoadError,snapshot:_lastSavedSnapshot})',c)};
}
for(const [name,raw] of [
 ['JSON truncado','{"clientes":'],['cadena vacía',''],['espacios','  '],['raíz null','null'],['raíz lista','[]'],['raíz número','42'],
 ['colección ausente','{}'],['colección incompatible',JSON.stringify({...valid(),equipos:{}})],
 ['registro null',JSON.stringify({...valid(),clientes:[null]})],['ID duplicado',JSON.stringify({...valid(),clientes:[{id:'C1',nombre:'A'},{id:'C1',nombre:'B'}]})],
 ['opcional incompatible',JSON.stringify({...valid(),pedidos:{}})],['fecha imposible',JSON.stringify({...valid(),lastSaved:'2026-02-30'})]
])test(`Inicio bloquea ${name} y conserva el original exacto`,()=>{
 const f=fixture(raw);assert.equal(f.c.loadData(),false);assert.equal(f.memory.get('aercom-data'),raw);assert.equal(JSON.stringify(f.c.D),'{}');assert.equal(f.control.writes,0);assert.equal(f.state().snapshot,null);assert.equal(f.state().error.raw,raw);
});
test('Lectura bloqueada no inicia con semillas ni intenta escribir',()=>{
 const f=fixture(JSON.stringify(valid()),true);assert.equal(f.c.loadData(),false);assert.equal(JSON.stringify(f.c.D),'{}');assert.equal(f.state().error.raw,null);assert.equal(f.control.writes,0);
});
test('Primera apertura sin clave usa semillas sin escribir',()=>{
 const f=fixture(null);assert.equal(f.c.loadData(),true);assert.equal(f.c.D.clientes[0].id,'C1');assert.equal(f.memory.has('aercom-data'),false);assert.equal(f.state().error,null);assert.equal(f.state().snapshot,JSON.stringify(f.c.D));assert.equal(f.control.writes,0);
});
test('Copia válida normaliza solo en memoria y conserva campos adicionales',()=>{
 const raw=JSON.stringify(valid()),f=fixture(raw);assert.equal(f.c.loadData(),true);assert.equal(f.c.D.clientes[0].prioridad,'Normal');assert.equal(f.c.D.clientes[0].extra.conservar,true);assert.equal(f.memory.get('aercom-data'),raw);assert.equal(f.state().snapshot,JSON.stringify(f.c.D));assert.equal(f.control.writes,0);
});
test('Migración heredada no escribe ni necesita cuota disponible al iniciar',()=>{
 const data={...valid(),facturacion_clientes:[{id:'F1',nombre:'Original',ajuste:'Dólar divisa'}],facturacion_estados:{'2026-10':{F1:'Cobrado'}},cotizaciones:[{id:'Q1',estado:'Borrador'}]},raw=JSON.stringify(data),f=fixture(raw);
 assert.equal(f.c.loadData(),true);assert.equal(f.c.D.facturacion_clientes,undefined);assert.equal(f.c.D.facturacion_estados['2026-10'].C1,'Cobrado');assert.equal(f.c.D.cotizaciones[0].estado,'Solicitud');assert.equal(f.memory.get('aercom-data'),raw);assert.equal(f.control.writes,0);
});
test('Un nuevo intento válido libera el bloqueo y establece el checkpoint',()=>{
 const f=fixture('null');assert.equal(f.c.loadData(),false);f.memory.set('aercom-data',JSON.stringify(valid()));assert.equal(f.c.loadData(),true);assert.equal(f.state().error,null);assert.equal(f.c.D.clientes[0].nombre,'Original');assert.equal(f.state().snapshot,JSON.stringify(f.c.D));assert.equal(f.control.writes,0);
});
test('Error de acceso al propio localStorage también queda contenido',()=>{
 const f=fixture();Object.defineProperty(f.c,'localStorage',{get(){throw Error('SecurityError');}});assert.equal(f.c.loadData(),false);assert.equal(f.state().error.raw,null);assert.equal(f.control.writes,0);
});
test('Inicio bloqueado impide persistencia base, aplicación de backups y reset',()=>{
 const f=fixture('null');assert.equal(f.c.loadData(),false);
 for(const attempt of [()=>f.c._persistBase(),()=>f.c._applyImportedData(valid(),()=>assert.fail('No guardar')),()=>f.c.resetStorage(),()=>f.c.exportData(),()=>f.c._applyTableImport(()=>assert.fail('No importar'))])assert.throws(attempt,/inicio|copia local/);
 assert.equal(JSON.stringify(f.c.D),'{}');assert.equal(f.memory.get('aercom-data'),'null');assert.equal(f.control.writes,0);
});
test('Descargar el original conserva texto inválido, bloqueo y almacenamiento',async()=>{
 const raw=' {"clientes": <img src=x> áé\n',f=fixture(raw),status={},link={click(){this.clicked=true;}};
 let blob,cleanup;
 f.c.Blob=Blob;f.c.document={getElementById:()=>status,createElement:()=>link};
 f.c.URL={createObjectURL(value){blob=value;return 'blob:prueba';},revokeObjectURL(value){assert.equal(value,'blob:prueba');}};
 f.c.setTimeout=fn=>{cleanup=fn;};
 assert.equal(f.c.loadData(),false);f.c._downloadStorageOriginal();assert.equal(await blob.text(),raw);assert.equal(link.download,'aercom-data-original.txt');assert.equal(link.clicked,true);assert.match(status.textContent,/Descarga solicitada/);cleanup();assert.equal(f.state().error.raw,raw);assert.equal(f.memory.get('aercom-data'),raw);assert.equal(f.control.writes,0);
});
test('Fallo al iniciar descarga no confirma éxito ni toca el original',()=>{
 const f=fixture('null'),status={};f.c.Blob=Blob;f.c.document={getElementById:()=>status};f.c.URL={createObjectURL(){throw Error('Descarga denegada');}};
 f.c.loadData();f.c._downloadStorageOriginal();assert.match(status.textContent,/No se pudo iniciar/);assert.equal(f.memory.get('aercom-data'),'null');assert.equal(f.state().error.raw,'null');assert.equal(f.control.writes,0);
});
