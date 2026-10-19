// node --test tests/invoice-confirmation.test.js — sin DOM/persistencia externos.
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
 const nodes=new Map(),messages=[],calls={saves:0,renders:0,closed:0};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',classList:{add(){}},focus(){}});return nodes.get(id);};
 const c=vm.createContext({D:{cotizaciones:[{id:'Q1',estado:'Aprobada',nroFactura:'A-0001',fechaFactura:'2026-10-19',extra:{conservar:true}}]},document:{getElementById:node},setTimeout(){},toast:message=>messages.push(message),persist(){calls.saves++;},closeModal(){calls.closed++;}});
 for(const file of ['js/utils.js','js/modules/cotizaciones.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
 c.renderPipeline=()=>{calls.renders++;};return{c,node,calls,messages};
}
test('ID con etiquetas se muestra como texto y el botón conserva el data-id escapado',()=>{
 const {c,node}=fixture(),id='Q-<img src=x onerror="globalThis.injected=1"> & "texto"';c.D.cotizaciones[0].id=id;
 c.confirmFacturacion(id);assert.equal(node('modal-title').textContent,`Confirmar facturación — ${id}`);
 assert.ok(node('modal-body').innerHTML.includes(`<strong>${c._esc(id)}</strong>`));assert.ok(!node('modal-body').innerHTML.includes('<img'));
 assert.ok(node('modal-foot').innerHTML.includes(`data-id="${c._esc(id)}"`));assert.ok(node('modal-foot').innerHTML.includes('doFacturar(this.dataset.id)'));
});
test('Número de factura con comillas y etiquetas no sale del atributo value',()=>{
 const {c,node}=fixture(),value='A-" autofocus onfocus="globalThis.injected=1"><img src=x onerror="globalThis.injected=1"> & á';c.D.cotizaciones[0].nroFactura=value;
 c.confirmFacturacion('Q1');assert.ok(node('modal-body').innerHTML.includes(`value="${c._esc(value)}"`));assert.ok(!node('modal-body').innerHTML.includes('<img'));
});
test('Fecha fuera del formato esperado se escapa sin construir atributos nuevos',()=>{
 const {c,node}=fixture();c.D.cotizaciones[0].fechaFactura='2026-10-19" autofocus onfocus="globalThis.injected=1';c.confirmFacturacion('Q1');
 assert.ok(node('modal-body').innerHTML.includes(`value="${c._esc(c.D.cotizaciones[0].fechaFactura)}"`));
});
test('Abrir no muta la cotización ni guarda; valores vacíos muestran sus predeterminados',()=>{
 const {c,node,calls}=fixture();c.D.cotizaciones[0].nroFactura='';c.D.cotizaciones[0].fechaFactura='';const before=JSON.stringify(c.D);
 c.confirmFacturacion('Q1');assert.equal(JSON.stringify(c.D),before);assert.equal(calls.saves,0);assert.ok(node('modal-body').innerHTML.includes(`value="${c.today()}"`));assert.ok(node('modal-body').innerHTML.includes('value=""'));
});
test('Confirmar conserva datos literales y campos adicionales, estado y persistencia habituales',()=>{
 const {c,node,calls}=fixture(),value='A-" & <texto> á';node('fact-nro').value=' '+value+' ';node('fact-fecha').value='2026-10-20';c.doFacturar('Q1');
 assert.equal(c.D.cotizaciones[0].nroFactura,value);assert.equal(c.D.cotizaciones[0].fechaFactura,'2026-10-20');assert.equal(c.D.cotizaciones[0].estado,'Facturada');assert.equal(c.D.cotizaciones[0].extra.conservar,true);assert.deepEqual(calls,{saves:1,renders:1,closed:1});
});
test('Una cotización inexistente no abre el formulario ni persiste datos',()=>{
 const {c,node,calls}=fixture();c.confirmFacturacion('NO_EXISTE');assert.equal(node('modal-title').textContent,'');assert.equal(node('modal-body').innerHTML,'');assert.equal(calls.saves,0);assert.equal(calls.closed,0);
});
