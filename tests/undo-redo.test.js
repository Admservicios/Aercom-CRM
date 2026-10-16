// Ejecutar: node --test tests/undo-redo.test.js (sin datos externos).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function fixture(stored = true) {
 const data = { clientes: [{ id: 'C1', nombre: 'Inicial' }], equipos: [], cotizaciones: [],
  pedidos: [], recordatorios: [], eventos: [], facturacion_estados: {}, lastSaved: '2026-10-16' };
 const memory = new Map(stored ? [['aercom-data', JSON.stringify(data)]] : []);
 const control = { schedules: 0, renderFailure: false, quotaFailure: false, postWriteFailure: false };
 const nodes = new Map(), messages = [];
 const c = vm.createContext({ D: data, Date, document: { getElementById(id) {
  if (!nodes.has(id)) nodes.set(id, { style: {}, textContent: '' }); return nodes.get(id);
 } }, localStorage: { getItem: key => memory.get(key) ?? null,
  setItem(key,value) { if(control.quotaFailure) throw Error('Cuota agotada'); memory.set(key,value); },
  removeItem: key => memory.delete(key) },
 renderModule() { if(control.renderFailure) throw Error('Error de render'); },
 updateSidebarBadges() { if(control.postWriteFailure) throw Error('Error posterior'); },
 markUnsaved() {}, toast: message => messages.push(message),
 _scheduleDriveSave() { control.schedules++; }
 });
 vm.runInContext(read('js/utils.js'), c);
 vm.runInContext(read('js/storage.js'), c);
 const html = read('index.html');
 vm.runInContext(html.slice(html.indexOf('const _origPersist='), html.indexOf('// _tryAutoConnectDrive() migrada')), c);
 vm.runInContext('_initialSnapshot=JSON.stringify(D)', c);
 return { c, memory, control, nodes, messages,
  history: () => vm.runInContext('JSON.stringify([_history,_future])',c),
  sizes: () => JSON.parse(vm.runInContext('JSON.stringify([_history.length,_future.length])',c)) };
}
function edit(f, name) { f.c.D.clientes[0].nombre=name; f.c.persist(); }
for (const stored of [true,false]) test(`Primera edición reversible y rehacible, con copia local=${stored}`, () => {
 const f=fixture(stored);edit(f,'Editado');
 f.c.undoAction();assert.equal(f.c.D.clientes[0].nombre,'Inicial');
 assert.equal(JSON.parse(f.memory.get('aercom-data')).clientes[0].nombre,'Inicial');
 f.c.redoAction();assert.equal(f.c.D.clientes[0].nombre,'Editado');
 assert.equal(JSON.parse(f.memory.get('aercom-data')).clientes[0].nombre,'Editado');
 assert.deepEqual(f.sizes(),[1,0]);assert.equal(f.control.schedules,3);
});
test('Nueva edición tras deshacer descarta rehacer y mantiene orden de acciones', () => {
 const f=fixture();edit(f,'A');edit(f,'B');f.c.undoAction();edit(f,'C');
 assert.deepEqual(f.sizes(),[2,0]);f.c.undoAction();assert.equal(f.c.D.clientes[0].nombre,'A');
 f.c.undoAction();assert.equal(f.c.D.clientes[0].nombre,'Inicial');
});
for (const direction of ['undoAction','redoAction']) {
 for (const failure of ['renderFailure','quotaFailure','postWriteFailure']) {
  test(`${direction}: ${failure} conserva memoria, almacenamiento e historial sin sincronizar`, () => {
   const f=fixture();edit(f,'A');if(direction==='redoAction')f.c.undoAction();
   const before=[JSON.stringify(f.c.D),f.memory.get('aercom-data'),f.history(),f.control.schedules];
   f.control[failure]=true;f.c[direction]();
   assert.deepEqual([JSON.stringify(f.c.D),f.memory.get('aercom-data'),f.history(),f.control.schedules],before);
   assert.match(f.messages.at(-1),/No se pudo restaurar/);
   f.control[failure]=false;f.c[direction]();
   assert.equal(f.c.D.clientes[0].nombre,direction==='undoAction'?'Inicial':'A');
  });
 }
}
test('Historial corrupto no altera datos ni consume la acción', () => {
 const f=fixture();vm.runInContext("_history.push('invalido')",f.c);
 const before=[JSON.stringify(f.c.D),f.history(),f.memory.get('aercom-data')];f.c.undoAction();
 assert.deepEqual([JSON.stringify(f.c.D),f.history(),f.memory.get('aercom-data')],before);
 assert.equal(f.control.schedules,0);
});
test('Límite de 30 acciones y botones reflejan deshacer/rehacer', () => {
 const f=fixture();for(let i=0;i<35;i++)edit(f,String(i));assert.deepEqual(f.sizes(),[30,0]);
 for(let i=0;i<30;i++)f.c.undoAction();assert.equal(f.c.D.clientes[0].nombre,'4');
 assert.equal(f.nodes.get('btn-undo').disabled,true);assert.equal(f.nodes.get('btn-redo').disabled,false);
 for(let i=0;i<30;i++)f.c.redoAction();assert.equal(f.c.D.clientes[0].nombre,'34');assert.deepEqual(f.sizes(),[30,0]);
});
test('Sin acciones no se guarda ni se programa Drive', () => {
 const f=fixture();f.c.undoAction();f.c.redoAction();assert.equal(f.control.schedules,0);
 assert.deepEqual(f.sizes(),[0,0]);
});
test('Guardado fallido no agrega historial ni descarta rehacer', () => {
 const f=fixture();edit(f,'A');f.c.undoAction();const before=f.history();f.control.quotaFailure=true;
 assert.throws(()=>edit(f,'Fallido'),/Cuota/);assert.equal(f.history(),before);
});
function keyboard(f) {
 let handler;
 f.c.document.addEventListener=(event,callback)=>{handler=callback;};
 vm.runInContext(read('index.html').match(/document.addEventListener\('keydown', e => \{[\s\S]*?\n\}\);/)[0],f.c);
 return handler;
}
test('Ctrl+Z en input/textarea/select/contenteditable conserva el historial y el comportamiento nativo', () => {
 const f=fixture();edit(f,'A');const keydown=keyboard(f),before=f.history();
 for(const target of [{tagName:'INPUT'},{tagName:'TEXTAREA'},{tagName:'SELECT'},{tagName:'DIV',isContentEditable:true}]) {
  keydown({key:'z',ctrlKey:true,target,preventDefault(){assert.fail('Debe conservar deshacer nativo');}});
 }
 assert.equal(f.history(),before);assert.equal(f.c.D.clientes[0].nombre,'A');
});
test('Atajos Ctrl/Meta+Z y Ctrl/Meta+Shift+Z aceptan Z mayúscula fuera de formularios', () => {
 for(const modifier of ['ctrlKey','metaKey']){
  const f=fixture();edit(f,'A');const keydown=keyboard(f);let prevented=0;
  const base={target:{tagName:'BODY'},[modifier]:true,preventDefault(){prevented++;}};
  keydown({...base,key:'z'});assert.equal(f.c.D.clientes[0].nombre,'Inicial');
  keydown({...base,key:'Z',shiftKey:true});assert.equal(f.c.D.clientes[0].nombre,'A');assert.equal(prevented,2);
 }
});
