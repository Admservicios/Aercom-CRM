// Ejecutar: node --test tests/drive-save.test.js
// HTTP, OAuth, DOM y almacenamiento simulados. No conecta cuentas reales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function fixture() {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', style: {}, querySelector: () => null, remove() {} });
    return nodes.get(id);
  };
  const memory = new Map();
  const calls = [];
  const messages = [];
  const state = { saved: 0, pending: false };
  const responses = [];
  const c = vm.createContext({
    crypto: webcrypto, TextEncoder,
    _parseImportedData: text => JSON.parse(text),
    D: { clientes: [{ id: 'C1', nombre: 'Prueba' }], equipos: [], cotizaciones: [] },
    STORAGE_KEY: 'aercom-data', today: () => '2026-10-16',
    document: { getElementById: node },
    localStorage: { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) },
    markSaved() { state.saved++; state.pending = false; },
    markUnsaved() { state.pending = true; },
    toast: text => messages.push(text), console: { error() {} },
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      assert.ok(responses.length, 'Petición HTTP inesperada');
      const response = responses.shift();
      if (response instanceof Error) throw response;
      if (typeof response === 'function') return response();
      return response;
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/modules/drive.js'), 'utf8'), c);
  vm.runInContext("_gdriveReady=true; _gdriveToken='test-only'; _folderRootId='root'; _gdriveDataFileId='data-file'", c);
  // Aislar transporte del preflight; drive-sync.test.js ejercita el flujo completo.
  c._gdriveSyncOnce = session => c._gdriveWriteSnapshot(JSON.parse(JSON.stringify(c.D)),
    vm.runInContext('_gdriveDataFileId', c) ? { fileId: 'data-file', etag: '"revision"' } : null, session);
  const response = (status, data) => ({ ok: status >= 200 && status < 300, status,
    json: async () => data });
  return { c, node, memory, calls, messages, state, responses, response };
}

for (const status of [401, 403, 429, 500]) {
  test(`Backup: HTTP ${status} no anuncia éxito y conserva la copia local`, async () => {
    const { c, node, memory, state, responses, response } = fixture();
    responses.push(response(status));
    assert.equal(await c._gdriveSaveData(), false);
    assert.equal(state.saved, 0);
    assert.equal(state.pending, true);
    assert.equal(JSON.parse(memory.get('aercom-data')).clientes[0].nombre, 'Prueba');
    assert.match(node('sb-saved').textContent, /Sin confirmar.*copia local conservada/);
  });
}

test('Backup: un PATCH 204 confirma el snapshot y limpia el estado pendiente', async () => {
  const { c, node, state, responses, response, calls } = fixture();
  state.pending = true;
  responses.push(response(204));
  assert.equal(await c._gdriveSaveData(), true);
  assert.equal(state.saved, 1);
  assert.equal(state.pending, false);
  assert.match(node('sb-saved').textContent, /Guardado en Drive/);
  assert.equal(JSON.parse(calls[0].body).clientes[0].id, 'C1');
});

test('Backup: un error de red conserva los cambios como pendientes', async () => {
  const { c, state, responses } = fixture();
  responses.push(new Error('Sin red'));
  assert.equal(await c._gdriveSaveData(), false);
  assert.equal(state.saved, 0);
  assert.equal(state.pending, true);
});

test('Backup: si falla la copia local no se sube ni se afirma que está conservada', async () => {
  const { c, node, calls } = fixture();
  c.localStorage.setItem = () => { throw new Error('Cuota agotada'); };
  assert.equal(await c._gdriveSaveData(), false);
  assert.equal(calls.length, 0);
  assert.match(node('sb-saved').textContent, /No se pudo guardar la copia local/);
});

test('Backup: las ediciones durante una subida no quedan marcadas como guardadas', async () => {
  const { c, state, node, responses, response } = fixture();
  let complete;
  responses.push(() => new Promise(resolve => { complete = resolve; }));
  const upload = c._gdriveSaveData();
  while (!complete) await new Promise(resolve => setImmediate(resolve));
  c.D.clientes[0].nombre = 'Edición posterior';
  complete(response(200));
  assert.equal(await upload, true);
  assert.equal(state.saved, 0);
  assert.equal(state.pending, true);
  assert.match(node('sb-saved').textContent, /hay cambios pendientes/);
});

test('Backup nuevo: no se hace PATCH si falla la creación', async () => {
  const { c, calls, state, responses, response } = fixture();
  vm.runInContext('_gdriveDataFileId=null', c);
  responses.push(response(403));
  assert.equal(await c._gdriveSaveData(), false);
  assert.equal(calls.length, 1);
  assert.equal(state.saved, 0);
  assert.equal(vm.runInContext('_gdriveDataFileId', c), null);
});

test('Backup nuevo: un ID inválido no produce una subida a undefined', async () => {
  const { c, calls, responses, response } = fixture();
  vm.runInContext('_gdriveDataFileId=null', c);
  responses.push(response(201, {}));
  assert.equal(await c._gdriveSaveData(), false);
  assert.equal(calls.length, 1);
  assert.equal(vm.runInContext('_gdriveDataFileId', c), null);
});

test('Backup nuevo: crear metadata y contenido en una sola petición, sin archivo vacío', async () => {
  const { c, calls, state, responses, response } = fixture();
  vm.runInContext('_gdriveDataFileId=null', c);
  responses.push(response(201, { id: 'created' }));
  assert.equal(await c._gdriveSaveData(), true);
  assert.equal(state.saved, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.match(calls[0].url, /uploadType=multipart/);
  assert.match(calls[0].body, /aercom-data.json/);
  assert.match(calls[0].body, /Prueba/);
});

for (const status of [401, 403, 429, 500]) {
  test(`Reporte: PATCH ${status} devuelve false`, async () => {
    const { c, responses, response } = fixture();
    responses.push(response(200, { files: [{ id: 'report' }] }), response(status));
    assert.equal(await c._gdriveUploadFile('Reporte.xlsx', 'contenido', 'application/test', 'reports'), false);
  });
}

test('Reporte: un fallo de búsqueda no se interpreta como archivo ausente', async () => {
  const { c, responses, response, calls } = fixture();
  responses.push(response(403));
  assert.equal(await c._gdriveUploadFile('R.xlsx', 'data', 'application/test', 'reports'), false);
  assert.equal(calls.length, 1);
});

test('Reporte: creación y subida exitosas devuelven true solo después del PATCH', async () => {
  const { c, responses, response, calls } = fixture();
  responses.push(response(200, { files: [] }), response(201, { id: 'report' }), response(204));
  assert.equal(await c._gdriveUploadFile('R.xlsx', 'data', 'application/test', 'reports'), true);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'POST', 'PATCH']);
});

for (const result of [{ files: null }, { files: [{}] }]) {
  test(`Una respuesta de búsqueda incompatible no crea archivos: ${JSON.stringify(result)}`, async () => {
    const { c, responses, response, calls } = fixture();
    responses.push(response(200, result));
    assert.equal(await c._gdriveUploadFile('R.xlsx', 'data', 'application/test', 'reports'), false);
    assert.equal(calls.length, 1);
  });
}

test('Carpetas: una búsqueda fallida no inicia una creación', async () => {
  const { c, calls, responses, response } = fixture();
  responses.push(response(403));
  await assert.rejects(c._gdriveGetOrCreateFolder('Aercom Gestion', null), /HTTP 403/);
  assert.equal(calls.length, 1);
});

test('Carpetas: creación fallida o sin ID se rechaza', async () => {
  for (const result of [{ status: 500 }, { status: 201, data: {} }]) {
    const { c, responses, response } = fixture();
    responses.push(response(200, { files: [] }), response(result.status, result.data));
    await assert.rejects(c._gdriveGetOrCreateFolder('Aercom Gestion', null));
  }
});

test('Carpetas: reutilizar una existente o crear una válida devuelve su ID', async () => {
  const { c, responses, response } = fixture();
  responses.push(response(200, { files: [{ id: 'existing' }] }));
  assert.equal(await c._gdriveGetOrCreateFolder('Aercom Gestion', null), 'existing');
  responses.push(response(200, { files: [] }), response(201, { id: 'created' }));
  assert.equal(await c._gdriveGetOrCreateFolder('Reportes', 'existing'), 'created');
});

for (const method of ['gdriveAuth', '_tryAutoConnectDrive']) {
  test(`${method}: una preparación fallida no deja Drive listo ni rechazos sin manejar`, async () => {
    const { c, state, responses, response, messages } = fixture();
    let callback;
    c._loadGIS = async () => {};
    c.google = { accounts: { oauth2: { initTokenClient(options) {
      callback = options.callback;
      return { requestAccessToken() {} };
    } } } };
    vm.runInContext('_gdriveReady=false', c);
    responses.push(response(403));
    await c[method]();
    await callback({ access_token: 'test-only' });
    assert.equal(vm.runInContext('_gdriveReady', c), false);
    assert.equal(state.saved, 0);
    assert.ok(!messages.includes('✓ Conectado a Google Drive'));
    assert.match(messages.at(-1), /No se pudo preparar Drive/);
  });
}
