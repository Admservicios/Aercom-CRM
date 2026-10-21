const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

function fixture(){
  const data={clientes:[{id:'C1',nombre:'Uno',codigoServicio:'Original',facturacion:'Manual'},{id:'C2',nombre:'Dos'}],
    equipos:[],cotizaciones:[],pedidos:[],recordatorios:[],eventos:[],facturacion_estados:{'2026-10':{C1:'Cobrado'}},lastSaved:'2026-10-21'};
  const nodes=new Map(),memory=new Map([['aercom-data',JSON.stringify(data)]]),control={answer:false,prompts:0,writes:0,quota:false};
  const node=id=>{
    if(!nodes.has(id)){
      const classes=new Set();nodes.set(id,{id,value:'',checked:false,type:'text',style:{},innerHTML:'',textContent:'',
        classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)},
        querySelectorAll:()=>id==='ficha-body'?[...nodes.values()].filter(n=>n.id.startsWith('ff-')):[]});
    }return nodes.get(id);
  };
  const c=vm.createContext({D:data,DEFAULT:data,curMonth:'2026-10',
    document:{getElementById:node,querySelector:()=>({value:'Abono'}),querySelectorAll:()=>[...nodes.values()].filter(n=>n.id.startsWith('ftab-'))},
    window:{confirm(){control.prompts++;return control.answer;}},
    localStorage:{getItem:key=>memory.get(key)??null,setItem(key,value){if(control.quota)throw Error('QuotaExceededError');control.writes++;memory.set(key,value);}},
    toast(){},markUnsaved(){},markSaved(){},renderModule(){},updateSidebarBadges(){},equipStatus:()=>({st:'verde'}),E_COLOR:{}});
  for(const file of ['js/utils.js','js/storage.js','js/modal.js','js/modules/clientes.js'])vm.runInContext(read(file),c);
  c.loadData();const html=read('index.html');vm.runInContext(html.slice(html.indexOf('const _origPersist='),html.indexOf('// ─── INIT')),c);
  vm.runInContext('_initialSnapshot=JSON.stringify(D);fichaClientId="C1"',c);
  for(const id of ['ff-codSrv','ff-moneda','ff-descSrv','ff-precio','ff-cant','ff-descPct','ff-vigDesde','ff-vigHasta','ff-nroOC','ff-nroPres','ff-otraRef','ff-textoFact','ff-adjOtros','ff-inc-otro'])node(id);
  for(const id of ['ff-reqHJS','ff-reqPeriodo','ff-envEmail','ff-adjPres','ff-adjOC','ff-adjHJS','ff-inc-ns','ff-inc-prev','ff-inc-comb','ff-inc-plat','ff-inc-bat',...['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m=>'ff-mes-'+m)])node(id).type='checkbox';
  node('ff-codSrv').value='Original';node('ff-moneda').value='Pesos';node('ff-descSrv').value='Manual';node('ff-cant').value='1';
  node('ficha-overlay').classList.add('open');node('ftab-facturacion').classList.add('active');node('ftab-general');
  c.fichaFacturacionEditMode();
  return {c,node,control,memory,snapshot:()=>JSON.stringify([c.D,memory.get('aercom-data'),vm.runInContext('[_history,_future]',c)])};
}
for(const action of ['close','tab','render','client','edit'])test(`Rechazar descarte al ${action} conserva cliente, pestaña y campos`,()=>{
  const f=fixture(),before=f.snapshot(),body=f.node('ficha-body').innerHTML;f.node('ff-codSrv').value='Borrador';
  const run={close:()=>f.c.closeFicha(),tab:()=>f.c.fichaTab('general'),render:()=>f.c.fichaRenderTab('general'),client:()=>f.c.openFicha('C2'),edit:()=>f.c.fichaFacturacionEditMode()};
  assert.equal(run[action](),false);assert.equal(f.control.prompts,1);assert.equal(f.node('ff-codSrv').value,'Borrador');
  assert.equal(f.node('ficha-body').innerHTML,body);assert.equal(f.node('ftab-facturacion').classList.contains('active'),true);
  assert.equal(vm.runInContext('fichaClientId',f.c),'C1');assert.equal(f.snapshot(),before);assert.equal(f.control.writes,0);
});
test('Aceptar descarte cambia la pestaña y limpia el estado de edición sin persistir',()=>{
  const f=fixture(),before=f.snapshot();f.node('ff-codSrv').value='Borrador';f.control.answer=true;
  assert.equal(f.c.fichaTab('general'),true);assert.equal(f.node('ftab-general').classList.contains('active'),true);
  assert.equal(vm.runInContext('_fichaDraft',f.c),null);f.c.closeFicha();assert.equal(f.control.prompts,1);assert.equal(f.snapshot(),before);
});
test('Sin cambios o volviendo a los valores iniciales no pregunta',()=>{
  for(const revert of [false,true]){
    const f=fixture();if(revert){f.node('ff-codSrv').value='Otro';f.node('ff-codSrv').value='Original';}
    assert.equal(f.c.closeFicha(),true);assert.equal(f.control.prompts,0);assert.equal(f.control.writes,0);
  }
});
test('Checks de meses e inclusiones también requieren confirmación',()=>{
  for(const id of ['ff-mes-Octubre','ff-inc-ns']){
    const f=fixture();f.node(id).checked=true;assert.equal(f.c.fichaTab('general'),false);assert.equal(f.control.prompts,1);
  }
});
test('Guardar correctamente no pide descartar y conserva datos ajenos',()=>{
  const f=fixture(),states=JSON.stringify(f.c.D.facturacion_estados);f.node('ff-codSrv').value='Guardado';f.c.saveFichaFacturacion();
  assert.equal(f.c.D.clientes[0].codigoServicio,'Guardado');assert.equal(f.control.writes,1);assert.equal(f.control.prompts,0);
  assert.equal(vm.runInContext('_fichaDraft',f.c),null);assert.equal(JSON.stringify(f.c.D.facturacion_estados),states);
  f.c.closeFicha();assert.equal(f.control.prompts,0);
});
test('Cuota fallida recupera datos/historial y conserva el borrador y su protección',()=>{
  const f=fixture(),before=f.snapshot();f.node('ff-codSrv').value='Borrador';f.control.quota=true;f.c.saveFichaFacturacion();
  assert.equal(f.snapshot(),before);assert.equal(f.node('ff-codSrv').value,'Borrador');assert.equal(f.control.writes,0);
  assert.equal(f.c.closeFicha(),false);assert.equal(f.control.prompts,1);
  f.control.quota=false;f.c.saveFichaFacturacion();assert.equal(f.control.prompts,1);assert.equal(f.control.writes,1);
  assert.equal(f.c.D.clientes[0].codigoServicio,'Borrador');assert.equal(vm.runInContext('_fichaDraft',f.c),null);
});
test('Un cliente inexistente no descarta la edición actual ni cambia su identidad',()=>{
  const f=fixture();f.node('ff-codSrv').value='Borrador';assert.equal(f.c.openFicha('inexistente'),false);
  assert.equal(f.control.prompts,0);assert.equal(vm.runInContext('fichaClientId',f.c),'C1');assert.notEqual(vm.runInContext('_fichaDraft',f.c),null);
});
test('Una pestaña inexistente no elimina la protección ni cambia la pestaña activa',()=>{
  const f=fixture();f.node('ff-codSrv').value='Borrador';assert.equal(f.c.fichaTab('inexistente'),false);
  assert.equal(f.control.prompts,0);assert.notEqual(vm.runInContext('_fichaDraft',f.c),null);
  assert.equal(f.node('ftab-facturacion').classList.contains('active'),true);
});
