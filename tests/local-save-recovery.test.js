// node --test tests/local-save-recovery.test.js — almacenamiento y formularios en memoria.
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function fixture(stored=true){
 const data={clientes:[{id:'C1',nombre:'Inicial',facturacion:'Manual'}],equipos:[{id:'E1',clienteId:'C1',tipo:'Motobomba',observaciones:'Original'}],cotizaciones:[{id:'Q1',clienteId:'C1',equipoId:'E1',descripcion:'Servicio',estado:'Aprobada',monto:100}],pedidos:[{id:'P1',clienteId:'C1',equipoId:'E1',cotizacionId:'Q1',estado:'Pendiente'}],recordatorios:[{id:'R1',titulo:'Original',clienteId:'C1',fechaHora:'2026-10-19T09:00',estado:'Pendiente'}],eventos:[{id:'EV1',titulo:'Original',fecha:'2026-10-19',clienteId:'C1'}],facturacion_estados:{'2026-10':{C1:'Pendiente'}},lastSaved:'2026-10-01'};
 const memory=new Map(stored?[['aercom-data',JSON.stringify(data)]]:[]),nodes=new Map(),messages=[];
 const control={read:false,quota:false,badge:false,restore:false,writes:0,schedules:0,closed:0,unsaved:false};
 let original;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,style:{},textContent:'',innerHTML:'',focus(){},classList:{add(){},remove(){}}});return nodes.get(id);};
 const c=vm.createContext({D:data,DEFAULT:JSON.parse(JSON.stringify(data)),ESTADOS:['Solicitud','Aprobada','Facturada'],curModule:'equipos',curMonth:'2026-10',
  document:{getElementById:node},localStorage:{getItem(key){if(control.read)throw Error('SecurityError');return memory.get(key)??null;},setItem(key,value){if(control.quota || (control.restore&&control.writes))throw Error('QuotaExceededError');control.writes++;memory.set(key,value);},removeItem:key=>memory.delete(key)},
  renderModule(){},updateSidebarBadges(){if(control.badge && memory.get('aercom-data')!==original)throw Error('Badge roto');},markUnsaved(){control.unsaved=true;},markSaved(){control.unsaved=false;},toast:message=>messages.push(message),confirmDel(label,callback){control.confirm=callback;},closeModal(){control.closed++;},_scheduleDriveSave(){control.schedules++;}
 });
 for(const file of ['js/utils.js','js/storage.js',...['clientes','equipos','cotizaciones','pedidos','recordatorios','calendario','facturacion'].map(n=>`js/modules/${n}.js`)])vm.runInContext(read(file),c);
 c.loadData();original=memory.get('aercom-data');
 const html=read('index.html');vm.runInContext(html.slice(html.indexOf('const _origPersist='),html.indexOf('// _tryAutoConnectDrive() migrada')),c);
 vm.runInContext('_initialSnapshot=JSON.stringify(D)',c);
 for(const name of ['renderClientes','renderEquipos','renderPipeline','renderPedidos','renderRecordatorios','renderCalendario','renderFacturacion'])c[name]=()=>{};
 const values={'cli-id-edit':'C9','cli-nombre':'Nuevo','cli-facturacion':'Manual','e-id':'E1','e-cli':'C1','e-tipo':'Motobomba','e-obs':'Nuevo','f-id':'Q1','f-cli':'C1','f-eq':'E1','f-desc':'Nuevo','f-est':'Aprobada','fact-nro':'Nueva factura','fact-fecha':'2026-10-19','ped-m-cli':'C1','ped-m-cot':'Q1','ped-m-equip':'E1','ped-m-det':'Nuevo','ped-m-est':'Realizado','rem-titulo':'Nuevo','rem-fechaHora':'2026-10-19T10:00','rem-clienteId':'C1','rem-estado':'Pendiente','cal-ev-titulo':'Nuevo','cal-ev-fecha':'2026-10-20'};
 for(const[id,value]of Object.entries(values))node(id).value=value;
 const snapshot=()=>JSON.stringify([c.D,memory.get('aercom-data'),vm.runInContext('[_history,_future]',c),control.schedules]);
 return{c,node,memory,control,messages,snapshot};
}
for(const stored of [true,false])test(`Cuota: recupera D/historial/storage sin sincronizar, copia previa=${stored}`,()=>{
 const f=fixture(stored),before=f.snapshot();f.control.quota=true;f.c.D.clientes[0].nombre='No guardar';assert.equal(f.c.persist(),false);assert.equal(f.snapshot(),before);assert.match(f.messages.at(-1),/No se guardó/);
});
test('Lectura bloqueada recupera la última copia de esta pestaña y pide verificar/exportar',()=>{
 const f=fixture();f.c.D.clientes[0].nombre='Primer cambio';assert.equal(f.c.persist(),true);const before=f.snapshot();f.control.read=true;f.c.D.clientes[0].nombre='Segundo cambio';assert.equal(f.c.persist(),false);assert.equal(f.snapshot(),before);assert.match(f.messages.at(-1),/Exportá/);
});
test('Error tras escribir recupera la copia anterior, historial y datos',()=>{
 const f=fixture(),before=f.snapshot();f.control.badge=true;f.c.D.clientes[0].nombre='No confirmar';assert.equal(f.c.persist(),false);assert.equal(f.snapshot(),before);assert.match(f.messages.at(-1),/No se guardó/);
});
test('Si restaurar storage falla conserva D recuperado y advierte exportar antes de recargar',()=>{
 const f=fixture(),before=JSON.stringify(f.c.D);f.control.badge=true;f.control.restore=true;f.c.D.clientes[0].nombre='Escritura parcial';assert.equal(f.c.persist(),false);assert.equal(JSON.stringify(f.c.D),before);assert.equal(JSON.parse(f.memory.get('aercom-data')).clientes[0].nombre,'Escritura parcial');assert.equal(f.control.schedules,0);assert.match(f.messages.at(-1),/Exportá los datos recuperados/);
});
test('Reintentar tras cuota guarda una vez y mantiene el borrador del formulario',()=>{
 const f=fixture(),draft=f.node('e-obs').value;f.control.quota=true;f.c.saveEquip();assert.equal(f.control.closed,0);assert.equal(f.node('e-obs').value,draft);assert.equal(f.c.D.equipos[0].observaciones,'Original');
 f.control.quota=false;f.c.saveEquip();assert.equal(f.control.closed,1);assert.equal(f.c.D.equipos[0].observaciones,'Nuevo');assert.equal(f.control.schedules,1);assert.equal(vm.runInContext('_history.length',f.c),1);
});
const forms=[['Cliente y referencias',c=>c.saveClient('C1','C2')],['Equipo',c=>c.saveEquip()],['Cotización',c=>{vm.runInContext("editingQuoteId='Q1'",c);c.saveQuote();}],['Confirmación de factura',c=>c.doFacturar('Q1')],['Pedido y estado de cotización',c=>c.savePedido('P1','P2')],['Recordatorio',c=>c.saveRem('R1')],['Evento',c=>c.saveCalEvento('EV1')],['Estado mensual de facturación',c=>c.setFactEst('C1','Cobrado')]];
for(const [label,save] of forms)test(`${label}: fallo no cierra ni confirma y recupera todos los dominios`,()=>{
 const f=fixture(),before=f.snapshot();f.control.quota=true;save(f.c);assert.equal(f.snapshot(),before);assert.equal(f.control.closed,0);assert.match(f.messages.at(-1),/No se guardó/);
});
test('Un registro recién agregado se descarta si falla la escritura',()=>{
 const f=fixture(),before=f.snapshot();f.node('e-id').value='E2';f.control.quota=true;f.c.saveEquip();assert.equal(f.snapshot(),before);assert.equal(f.node('e-id').value,'E2');assert.equal(f.control.closed,0);
});
test('JSON local incompatible durante sesión no se sobrescribe ni impide recuperar D',()=>{
 const f=fixture(),before=JSON.stringify(f.c.D);f.memory.set('aercom-data','null');f.c.D.clientes[0].nombre='No guardar';assert.equal(f.c.persist(),false);assert.equal(JSON.stringify(f.c.D),before);assert.equal(f.memory.get('aercom-data'),'null');assert.equal(f.control.writes,0);
});
test('Una falla conserva rehacer y libera el guard de reentrada para el próximo intento',()=>{
 const f=fixture();vm.runInContext("_future.push(JSON.stringify(D))",f.c);const future=vm.runInContext('JSON.stringify(_future)',f.c);f.control.quota=true;f.c.D.clientes[0].nombre='No guardar';assert.equal(f.c.persist(),false);assert.equal(vm.runInContext('JSON.stringify(_future)',f.c),future);assert.equal(vm.runInContext('_inPersist',f.c),false);
 f.control.quota=false;f.c.D.clientes[0].nombre='Guardado';assert.equal(f.c.persist(),true);assert.equal(vm.runInContext('_future.length',f.c),0);
});
test('Checkpoint se actualiza después de importación y de undo/redo exitosos',()=>{
 const f=fixture(),candidate=JSON.parse(JSON.stringify(f.c.D));candidate.clientes[0].nombre='Importado';f.c._applyImportedData(candidate,()=>f.c.localStorage.setItem('aercom-data',JSON.stringify(f.c.D)));const before=f.snapshot();f.control.read=true;f.c.D.clientes[0].nombre='No guardar';assert.equal(f.c.persist(),false);assert.equal(f.snapshot(),before);
 f.control.read=false;f.c.D.clientes[0].nombre='Editado';assert.equal(f.c.persist(),true);f.c.undoAction();assert.equal(f.c.D.clientes[0].nombre,'Importado');f.c.redoAction();assert.equal(f.c.D.clientes[0].nombre,'Editado');
 const after=f.snapshot();f.control.read=true;f.c.D.clientes[0].nombre='No guardar';assert.equal(f.c.persist(),false);assert.equal(f.snapshot(),after);
});

test('Borrado fallido recupera el registro sin cerrar ni anunciar eliminación',()=>{
 const f=fixture(),before=f.snapshot();f.control.quota=true;f.c.delPedidoConfirm('P1');f.control.confirm();assert.equal(f.snapshot(),before);assert.equal(f.control.closed,0);assert.match(f.messages.at(-1),/No se guardó/);
});
test('Reset no elimina la copia existente antes de confirmar su reemplazo',()=>{
 const f=fixture();f.c.D.clientes[0].nombre='Dato guardado';assert.equal(f.c.persist(),true);const before=f.snapshot();f.control.quota=true;assert.equal(f.c.resetStorage(),false);assert.equal(f.snapshot(),before);
});
