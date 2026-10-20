const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
function fixture() {
  const D = {clientes: [{id: 'CLI', nombre: 'Clínica Central'}], cotizaciones: [
    {id: 'COT-1', clienteId: 'CLI', estado: 'Solicitud', responsable: 'Ana Pérez', descripcion: 'Mantenimiento '.repeat(8) + 'válvula especial'},
    {id: 'COT-2', clienteId: 'CLI', estado: 'A facturar', responsable: 'Ana Gómez', descripcion: 'Tablero'},
    {id: 'COT-3', clienteId: 'CLI', estado: 'A facturar', responsable: 'Ana Pérez', descripcion: 'Válvula especial'},
    {id: 'COT-4', clienteId: 'CLI', estado: 'Solicitud', responsable: null, descripcion: null}
  ]};
  const nodes = Object.fromEntries(['pipe-q', 'pipe-f-est', 'pipe-f-resp', 'pipe-count'].map(id => [id, {value: '', textContent: ''}]));
  const columns = ['Solicitud', 'A facturar'].map(estado => ({
    estado, style: {}, count: {textContent: ''}, cards: [],
    querySelector(selector) { return selector === '.k-body' ? {dataset: {estado}} : this.count; },
    querySelectorAll() { return this.cards; }
  }));
  const cards = D.cotizaciones.map(q => {
    const col = columns.find(c => c.estado === q.estado);
    const card = {dataset: {id: q.id}, style: {}, closest: () => col,
      lastElementChild: {textContent: `${q.id} Clínica Central ${q.descripcion || ''} ${q.responsable || ''}`},
      querySelector: selector => ({textContent: selector === '.k-id' ? q.id : selector === '.k-client' ? 'Clínica Central' : (q.descripcion || '').slice(0, 60)})};
    col.cards.push(card);
    return card;
  });
  const context = vm.createContext({D, document: {getElementById: id => nodes[id], querySelectorAll: selector => selector === '.k-col' ? columns : cards}, toggleClear: (prefix, active) => { nodes.clearActive = !!active; }});
  vm.runInContext(fs.readFileSync(path.join(root, 'js/modules/cotizaciones.js'), 'utf8'), context);
  return {D, nodes, columns, cards, apply: () => context.applyPipeFilter(), clear: () => context.clearPipeFilter(), visible: () => cards.filter(c => c.style.display !== 'none').map(c => c.dataset.id)};
}

test('filtra por nombre completo sin confundir responsables con el mismo nombre', () => {
  const f = fixture(); f.nodes['pipe-f-resp'].value = 'Ana Pérez'; f.apply();
  assert.deepEqual(f.visible(), ['COT-1', 'COT-3']);
  assert.equal(f.nodes['pipe-count'].textContent, '2 cotizaciones encontradas');
});
test('busca texto que queda fuera de la descripción recortada', () => {
  const f = fixture(); f.nodes['pipe-q'].value = '  VÁLVULA ESPECIAL  '; f.apply();
  assert.deepEqual(f.visible(), ['COT-1', 'COT-3']);
});
test('busca cliente e identificador sin distinguir mayúsculas', () => {
  const f = fixture(); f.nodes['pipe-q'].value = 'clínica central'; f.apply();
  assert.equal(f.visible().length, 4);
  f.nodes['pipe-q'].value = 'cot-2'; f.apply(); assert.deepEqual(f.visible(), ['COT-2']);
});
test('combina estado, responsable y búsqueda y actualiza contadores', () => {
  const f = fixture(); f.nodes['pipe-f-est'].value = 'A facturar'; f.nodes['pipe-f-resp'].value = 'Ana Pérez'; f.nodes['pipe-q'].value = 'válvula'; f.apply();
  assert.deepEqual(f.visible(), ['COT-3']); assert.equal(f.columns[0].style.display, 'none'); assert.equal(f.columns[1].count.textContent, 1);
});
test('limpiar restaura todas las columnas, tarjetas y contadores', () => {
  const f = fixture(); f.nodes['pipe-f-est'].value = 'A facturar'; f.nodes['pipe-q'].value = 'inexistente'; f.apply();
  assert.equal(f.nodes['pipe-count'].textContent, 'Sin resultados');
  f.clear(); assert.equal(f.visible().length, 4); assert.ok(f.columns.every(c => c.style.display === '' && c.count.textContent === 2));
  assert.equal(f.nodes['pipe-count'].textContent, ''); assert.equal(f.nodes.clearActive, false);
});
test('campos opcionales vacíos y cliente ausente no impiden buscar', () => {
  const f = fixture(); f.D.clientes = []; f.nodes['pipe-q'].value = 'cot-4'; f.apply(); assert.deepEqual(f.visible(), ['COT-4']);
});
test('filtrar y limpiar no muta los datos', () => {
  const f = fixture(); const original = JSON.stringify(f.D);
  f.nodes['pipe-f-resp'].value = 'Ana Pérez'; f.apply(); f.clear(); assert.equal(JSON.stringify(f.D), original);
});
test('el selector permite elegir todos los estados del tablero, incluido A facturar', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const select = html.match(/<select[^>]+id="pipe-f-est"[\s\S]*?<\/select>/)[0];
  const states = JSON.parse(html.match(/const ESTADOS=(\[[^;]+\])/)[1].replaceAll("'", '"'));
  for (const state of states) assert.ok(select.includes(`<option>${state}</option>`), state);
});
