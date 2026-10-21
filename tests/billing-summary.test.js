const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const D = {clientes: [
    {id:'JAN', nombre:'Solo enero', mesesFacturacion:['Enero']},
    {id:'FACT', nombre:'Fábrica', mesesFacturacion:['Octubre'], tipo:'Industrial', ajuste:'IPC'},
    {id:'NOV', nombre:'Solo noviembre', mesesFacturacion:['Noviembre']},
    {id:'COBR', nombre:'Clínica', mesesFacturacion:['Octubre'], tipo:'Clínica', facturacion:'Automática'},
    {id:'EXCL', nombre:'Excluido', mesesFacturacion:[]},
    {id:'PEND', nombre:'Pendiente', tipo:'Industrial'}
  ], equipos:[], cotizaciones:[], pedidos:[], recordatorios:[], facturacion_estados:{
    '2026-10':{FACT:'Facturado', NOV:'Cobrado', COBR:'Cobrado', EXCL:'Excluido', ORPHAN:'Facturado'},
    '2026-11':{NOV:'Facturado', EXCL:'Cobrado'}
  }};
  const nodes = new Map(), charts = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id,{value:'', textContent:'', innerHTML:'', style:{}});
    return nodes.get(id);
  };
  let rows = [], saves = 0;
  const c = vm.createContext({D, curMonth:'2026-10', ESTADOS:[],
    document:{getElementById:node, querySelectorAll:()=>rows, body:{classList:{contains:()=>false}}},
    Chart:class {constructor(el,config){charts.push({el,config});} destroy(){}},
    persist(){saves++;}, toast(){}, toggleClear(){}, updateSidebarBadges(){}
  });
  for (const file of ['js/utils.js','js/modules/facturacion.js','js/modules/dashboard.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  return {c, node, charts, saves:()=>saves, setRows(ids){rows=ids.map(clientId=>({dataset:{clientId},style:{}}));return rows;}};
}
test('resumen mensual comparte el universo de la lista y excluye estados ajenos', () => {
  const {c,node} = fixture(); c.renderFacturacion();
  assert.equal(node('facturacion-sub').textContent,'3 clientes incluidos · 2 facturados o cobrados');
  assert.match(node('fact-prog-txt').textContent,/2 de 3 clientes \(67%\)/);
  assert.equal(node('fact-prog-bar').style.width,'67%');
  assert.match(node('fact-stats').innerHTML,/Pendientes: 1/);
  assert.match(node('fact-stats').innerHTML,/Excluidos: 1/);
  assert.match(node('fact-month-info').textContent,/2 no aplican/);
});
test('Dashboard y gráfico respetan los meses de facturación y muestran el período', () => {
  const {c,node,charts} = fixture(); c.renderDashboard();
  assert.match(node('dash-main').innerHTML,/>2\/3<\/div>/);
  assert.match(node('dash-main').innerHTML,/Facturados o cobrados · Octubre 2026/);
  assert.equal(node('dash-fact-title').textContent,'Estado de facturación · Octubre 2026');
  assert.match(node('dash-fact-scope').textContent,/1 excluido del progreso/);
  assert.deepEqual(Array.from(charts.at(-1).config.data.datasets[0].data),[1,1,1,1]);
});
test('filtrar filas usa el ID aunque haya clientes no aplicables antes y entre ellas', () => {
  const f=fixture(), rows=f.setRows(['FACT','COBR','EXCL','PEND']);
  f.node('fact-q').value='clínica'; f.c.applyFactFilter();
  assert.deepEqual(rows.map(r=>r.style.display),['none','','none','none']);
  assert.equal(f.node('fact-count').textContent,'Mostrando 1 de 4 clientes del mes');
});
test('combina estado, tipo, ajuste y modalidad sin perder la identidad de la fila', () => {
  const f=fixture(), rows=f.setRows(['FACT','COBR','EXCL','PEND']);
  for(const [id,value] of Object.entries({'fact-f-est':'Facturado','fact-f-tipo':'Industrial','fact-f-ajuste':'IPC','fact-f-modo':'Manual'}))f.node(id).value=value;
  f.c.applyFactFilter();assert.deepEqual(rows.map(r=>r.style.display),['','none','none','none']);
  f.c.clearFactFilter();assert.ok(rows.every(r=>r.style.display===''));assert.equal(f.node('fact-count').textContent,'');
});
test('cambio de mes conserva el historial y recalcula ambos resúmenes', () => {
  const f=fixture(), original=JSON.stringify(f.c.D); f.c.changeMonth(1);f.c.renderDashboard();
  assert.match(f.node('facturacion-sub').textContent,/3 clientes incluidos · 2 facturados o cobrados/);
  assert.equal(f.node('dash-fact-title').textContent,'Estado de facturación · Noviembre 2026');
  assert.match(f.node('dash-main').innerHTML,/>2\/3<\/div>/);
  assert.equal(JSON.stringify(f.c.D),original);assert.equal(f.saves(),0);
});
test('mes sin clientes aplicables no contabiliza estados históricos guardados', () => {
  const f=fixture();f.c.D.clientes.forEach(c=>c.mesesFacturacion=['Enero']);f.c.renderFacturacion();f.c.renderDashboard();
  assert.match(f.node('facturacion-sub').textContent,/0 clientes incluidos · 0 facturados o cobrados/);
  assert.equal(f.node('fact-prog-bar').style.width,'0%');
  assert.match(f.node('fact-list').innerHTML,/Ningún cliente factura/);
  assert.match(f.node('dash-main').innerHTML,/>0\/0<\/div>/);assert.match(f.node('chart-fact-wrap').innerHTML,/Sin datos/);
});
test('todos excluidos y base vacía evitan porcentajes inválidos y limpian resultados', () => {
  const f=fixture(); f.c.D.clientes=[{id:'EXCL',nombre:'Excluido'}];f.c.renderFacturacion();
  assert.equal(f.node('fact-prog-bar').style.width,'0%');assert.match(f.node('facturacion-sub').textContent,/0 clientes incluidos/);
  f.node('fact-count').textContent='resultado viejo';f.c.D.clientes=[];f.c.renderFacturacion();
  assert.equal(f.node('fact-prog-txt').textContent,'Sin clientes');assert.equal(f.node('fact-count').textContent,'');
});
test('renderizar o buscar no altera estados ni persiste datos', () => {
  const f=fixture(), original=JSON.stringify(f.c.D);f.c.renderFacturacion();f.c.renderDashboard();
  f.setRows(['EXCL','FACT']);f.node('fact-f-est').value='Excluido';f.c.applyFactFilter();f.c.clearFactFilter();
  assert.equal(JSON.stringify(f.c.D),original);assert.equal(f.saves(),0);
});
test('el ID de la fila se escapa como atributo y se busca como texto literal', () => {
  const f=fixture(), id='C"<&'; f.c.D.clientes=[{id,nombre:'Literal'}];
  f.c.renderFacturacion();assert.ok(f.node('fact-list').innerHTML.includes('data-client-id="C&quot;&lt;&amp;"'));
  const rows=f.setRows([id]);f.node('fact-q').value='literal';f.c.applyFactFilter();
  assert.equal(rows[0].style.display,'');
});
