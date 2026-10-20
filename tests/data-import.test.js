// Ejecutar: node --test tests/data-import.test.js
// Datos, archivos, almacenamiento y HTTP simulados; no usa Drive ni escribe en disco.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const valid = () => ({ version: '1.0', lastSaved: '2099-01-01',
  clientes: [{ id: 'C1', nombre: 'Clínica & Sol', prioridad: 'Crítico',
    campoAdicional: { conservar: true } }], equipos: [], cotizaciones: [] });

function fixture() {
  const old = { clientes: [{ id: 'OLD', nombre: 'Anterior' }], equipos: [],
    cotizaciones: [], pedidos: [], eventos: [], recordatorios: [],
    facturacion_estados: {}, lastSaved: '2000-01-01' };
  const memory = new Map([['aercom-data', JSON.stringify(old)]]);
  const control = { writes: 0, renderFailure: false, quotaFailure: false,
    badgeFailure: false, requests: [] };
  const messages = [];
  const c = vm.createContext({ D: old, DEFAULT: valid(), _history: ['previo'],
    _future: ['futuro'], _inPersist: false, MAX_HIST: 30,
    console: { error() {} },
    localStorage: {
      getItem: key => memory.has(key) ? memory.get(key) : null,
      setItem(key, value) {
        if (control.quotaFailure) throw new Error('Cuota agotada');
        control.writes++;
        memory.set(key, value);
      },
      removeItem(key) { memory.delete(key); control.writes++; }
    },
    document: { getElementById: () => ({ textContent: '' }) },
    renderModule() { if (control.renderFailure && c.D !== old) throw new Error('Render incompatible'); },
    updateSidebarBadges() {
      if (control.badgeFailure && c.D !== old && memory.get('aercom-data') !== JSON.stringify(old)) {
        throw new Error('Error de interfaz tras guardar');
      }
    },
    markUnsaved() {}, _updateUndoBtn() {}, toast: text => messages.push(text),
    FileReader: class {
      readAsText(file) {
        if (file.error) this.onerror();
        else this.onload({ target: { result: file.text } });
      }
    },
    fetch: async url => { control.requests.push(url); throw new Error('HTTP no preparado'); }
  });
  for (const file of ['js/utils.js', 'js/storage.js']) {
    vm.runInContext(source(file), c, { filename: file });
  }
  c._origPersist = c._persistBase;
  // Ejercitar el decorador real, incluyendo su manejo de undo/redo.
  vm.runInContext(source('index.html').match(/function persist\(\)\{[\s\S]*?\n\}/)[0], c);
  const importFile = text => {
    const event = { target: { value: 'archivo', files: [{ text }] } };
    c.importData(event);
    assert.equal(event.target.value, '');
  };
  return { c, old, memory, control, messages, importFile };
}

const invalid = [
  ['sintaxis', '{'], ['null', 'null'], ['lista raíz', '[]'], ['sin colecciones', '{}'],
  ['colección incorrecta', JSON.stringify({ ...valid(), equipos: {} })],
  ['registro null', JSON.stringify({ ...valid(), clientes: [null] })],
  ['sin ID', JSON.stringify({ ...valid(), equipos: [{}] })],
  ['ID duplicado', JSON.stringify({ ...valid(), equipos: [{ id: 'EQ1' }, { id: 'EQ1' }] })],
  ['ID reservado', JSON.stringify({ ...valid(), equipos: [{ id: '__proto__' }] })],
  ['nombre incorrecto', JSON.stringify({ ...valid(), clientes: [{ id: 'C1', nombre: 7 }] })],
  ['texto incorrecto', JSON.stringify({ ...valid(), equipos: [{ id: 'EQ1', tipo: {} }] })],
  ['número incorrecto', JSON.stringify({ ...valid(), clientes: [{ id: 'C1', nombre: 'A', presupuesto: '100' }] })],
  ['booleano incorrecto', JSON.stringify({ ...valid(), clientes: [{ id: 'C1', nombre: 'A', requiereOC: 'sí' }] })],
  ['meses incorrectos', JSON.stringify({ ...valid(), clientes: [{ id: 'C1', nombre: 'A', mesesFacturacion: {} }] })],
  ['facturación incorrecta', JSON.stringify({ ...valid(), facturacion_estados: [] })],
  ['estado mensual incorrecto', JSON.stringify({ ...valid(), facturacion_estados: { '2026-10': { C1: {} } } })],
  ['colección opcional incorrecta', JSON.stringify({ ...valid(), pedidos: {} })],
  ['fecha de mantenimiento imposible', JSON.stringify({ ...valid(), equipos: [{ id: 'EQ1', proximoPreventivo: '2026-02-30' }] })],
  ['fecha de pedido incorrecta', JSON.stringify({ ...valid(), pedidos: [{ id: 'P1', fechaARealizar: 7 }] })],
  ['fecha y hora incorrectas', JSON.stringify({ ...valid(), recordatorios: [{ id: 'R1', titulo: 'Llamar', fechaHora: 'mañana' }] })],
  ['fecha de guardado imposible', JSON.stringify({ ...valid(), lastSaved: '2026-02-30' })]
];

for (const [name, text] of invalid) {
  test(`Rechazar ${name} conserva memoria, almacenamiento e historial sin subir datos`, () => {
    const { c, old, memory, control, messages, importFile } = fixture();
    const stored = memory.get('aercom-data');
    importFile(text);
    assert.equal(c.D, old);
    assert.equal(memory.get('aercom-data'), stored);
    assert.deepEqual(c._history, ['previo']);
    assert.deepEqual(c._future, ['futuro']);
    assert.equal(control.writes, 0);
    assert.match(messages.at(-1), /rechazada/);
  });
}

test('Importar backup válido normaliza arrays opcionales y conserva campos adicionales', () => {
  const { c, memory, control, importFile } = fixture();
  importFile(JSON.stringify(valid()));
  assert.equal(c.D.clientes[0].prioridad, 'Crítico');
  assert.deepEqual(copy(c.D.clientes[0].campoAdicional), { conservar: true });
  for (const field of ['pedidos', 'eventos', 'recordatorios']) assert.deepEqual(copy(c.D[field]), []);
  assert.equal(JSON.parse(memory.get('aercom-data')).clientes[0].id, 'C1');
  assert.equal(c._history.length, 2);
  assert.equal(c._future.length, 0);
});

test('Backups heredados mantienen migración de facturación y estados de cotización', () => {
  const { c, importFile } = fixture();
  const data = valid();
  data.facturacion_clientes = [{ id: 'F1', nombre: 'Clínica & Sol', ajuste: 'Dólar divisa' }];
  data.facturacion_estados = { '2026-10': { F1: 'Cobrado' } };
  data.cotizaciones = [{ id: 'Q1', estado: 'Borrador' }];
  importFile(JSON.stringify(data));
  assert.deepEqual(copy(c.D.facturacion_estados), { '2026-10': { C1: 'Cobrado' } });
  assert.equal(c.D.clientes[0].ajuste, 'Dólar divisa');
  assert.equal(c.D.cotizaciones[0].estado, 'Solicitud');
  assert.equal(c.D.facturacion_clientes, undefined);
});

for (const failure of ['renderFailure', 'quotaFailure', 'badgeFailure']) {
  test(`Recuperar estado e historial ante ${failure}`, () => {
    const { c, old, memory, control, messages, importFile } = fixture();
    const stored = memory.get('aercom-data');
    control[failure] = true;
    importFile(JSON.stringify(valid()));
    assert.equal(c.D, old);
    assert.equal(memory.get('aercom-data'), stored);
    assert.deepEqual(c._history, ['previo']);
    assert.deepEqual(c._future, ['futuro']);
    assert.match(messages.at(-1), /rechazada/);
  });
}

test('El error de lectura de archivo no altera los datos', () => {
  const { c, old, control, messages } = fixture();
  const event = { target: { value: 'archivo', files: [{ error: true }] } };
  c.importData(event);
  assert.equal(c.D, old);
  assert.equal(control.writes, 0);
  assert.equal(event.target.value, '');
  assert.match(messages.at(-1), /leer el archivo/);
});

test('Si antes no había copia local, un guardado parcial fallido no deja una nueva', () => {
  const { c, old, memory } = fixture();
  memory.delete('aercom-data');
  const candidate = c._parseImportedData(JSON.stringify(valid()));
  assert.throws(() => c._applyImportedData(candidate, () => {
    c.localStorage.setItem('aercom-data', JSON.stringify(c.D));
    throw new Error('Fallo posterior');
  }), /Fallo posterior/);
  assert.equal(c.D, old);
  assert.equal(memory.has('aercom-data'), false);
});

test('Si el almacenamiento impide restaurar, se conserva D y se pide exportar antes de recargar', () => {
  const { c, old, memory, importFile, control, messages } = fixture();
  control.badgeFailure = true;
  const stored = memory.get('aercom-data');
  const setItem = c.localStorage.setItem;
  c.localStorage.setItem = (key, value) => {
    if (value === stored) throw new Error('Restauración bloqueada');
    setItem(key, value);
  };
  importFile(JSON.stringify(valid()));
  assert.equal(c.D, old);
  assert.match(messages.at(-1), /exportá.*antes de recargar/);
});

test('El backup semilla del repositorio y su arranque siguen siendo compatibles', () => {
  const { c, memory } = fixture();
  const seed = source('index.html').match(/const DEFAULT = (.*);/)[1];
  const imported = c._parseImportedData(seed);
  memory.set('aercom-data', seed);
  c.loadData();
  assert.deepEqual(copy(c.D), copy(imported));
  assert.equal(c.D.clientes.length, 5);
});

test('Un backup producido por exportData se puede validar sin perder sus campos', async () => {
  const { c } = fixture();
  c.D = c._parseImportedData(JSON.stringify(valid()));
  c.Blob = Blob;
  let exported;
  c.URL = { createObjectURL(blob) { exported = blob; return 'blob:test'; }, revokeObjectURL() {} };
  c.document.createElement = () => ({ click() {} });
  c.exportData();
  assert.deepEqual(copy(c._parseImportedData(await exported.text())), copy(c.D));
});
