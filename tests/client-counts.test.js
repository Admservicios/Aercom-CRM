// node --test tests/client-counts.test.js — contadores y recorridos sin DOM externo.
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
 const nodes=new Map(),visits={equipos:0,pedidos:0,filters:0};
 const observed=(rows,key)=>new Proxy(rows,{get(target,property){
  if(property===Symbol.iterator)return function*(){for(let i=0;i<target.length;i++){visits[key]++;yield target[i];}};
  if(property==='filter')return (...args)=>{visits.filters++;return target.filter(...args);};
  return Reflect.get(target,property);
 }});
 const c=vm.createContext({D:{clientes:[{id:'C1',nombre:'Uno',estadoCliente:'Activo'},{id:'C2',nombre:'Dos',estadoCliente:'Inactivo'}],equipos:[],pedidos:[]},
 document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',style:{}});return nodes.get(id);}},updateSidebarBadges(){}});
 for(const file of ['js/utils.js','js/modules/clientes.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
 return {c,nodes,visits,observed,html:()=>nodes.get('cli-tbody').innerHTML};
}
test('Contadores incluyen todos los equipos y solo pedidos activos del cliente correspondiente',()=>{
 const f=fixture();f.c.D.equipos=[{clienteId:'C1'},{clienteId:'C1'},{clienteId:'C2'},{clienteId:'ausente'}];
 f.c.D.pedidos=[{clienteId:'C1',estado:'Pendiente'},{clienteId:'C1',estado:'En ejecución'},{clienteId:'C1',estado:'Realizado'},{clienteId:'C2',estado:'Realizado'},{clienteId:'ausente',estado:'Pendiente'}];f.c.renderClientes();
 assert.match(f.html(),/2 equipos · <span[^>]*>2 pedidos activos/);assert.match(f.html(),/1 equipo<\/div>/);
 assert.equal(f.nodes.get('clientes-sub').textContent,'2 clientes · 1 activos');
});
test('Agregar/eliminar o cambiar estado recalcula sin cachés obsoletas',()=>{
 const f=fixture();f.c.D.equipos=[{clienteId:'C1'}];f.c.D.pedidos=[{clienteId:'C1',estado:'Pendiente'}];f.c.renderClientes();assert.match(f.html(),/1 pedido activo/);
 f.c.D.equipos=[];f.c.D.pedidos[0].estado='Realizado';f.c.renderClientes();assert.ok(!f.html().includes('pedido activo'));assert.match(f.html(),/0 equipos/);
});
test('Un render recorre equipos/pedidos una sola vez con miles de clientes',()=>{
 const f=fixture();f.c.D.clientes=Array.from({length:1000},(_,i)=>({id:`C${i}`,nombre:`Cliente ${i}`}));
 f.c.D.equipos=f.observed(Array.from({length:10000},(_,i)=>({clienteId:`C${i%1000}`})),'equipos');
 f.c.D.pedidos=f.observed(Array.from({length:10000},(_,i)=>({clienteId:`C${i%1000}`,estado:i%2?'Realizado':'Pendiente'})),'pedidos');
 const before=JSON.stringify(f.c.D);f.c.renderClientes();assert.deepEqual(f.visits,{equipos:10000,pedidos:10000,filters:0});assert.equal(JSON.stringify(f.c.D),before);
});
test('Colección de pedidos ausente y clientes vacíos conservan sus salidas',()=>{
 const f=fixture();delete f.c.D.pedidos;f.c.renderClientes();assert.match(f.html(),/0 equipos/);
 f.c.D.clientes=[];f.c.renderClientes();assert.match(f.html(),/No hay clientes registrados/);
});
