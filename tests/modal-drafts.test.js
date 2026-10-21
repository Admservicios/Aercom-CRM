const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function fixture(fields=[]){
  let open=true,closed=0,prompts=0,answer=false;
  const body={querySelectorAll:()=>fields};
  const c=vm.createContext({document:{getElementById:id=>id==='modal-body'?body:{classList:{contains:()=>open}}},
    window:{confirm(){prompts++;return answer;}},closeModal(){closed++;open=false;}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js/modal.js'),'utf8'),c);
  vm.runInContext('_modalSession={baseline:_modalSnapshot(document.getElementById("modal-body"))}',c);
  return {c,fields,body,answer(value){answer=value;},counts:()=>({closed,prompts}),closed(){open=false;}};
}
for(const type of ['text','date','number','textarea','select-one'])test(`Cambios ${type}: cancelar descarte conserva el formulario`,()=>{
  const field={id:'campo',type,value:'original'},f=fixture([field]);field.value='nuevo';
  assert.equal(f.c.requestCloseModal(),false);assert.deepEqual(f.counts(),{closed:0,prompts:1});assert.equal(field.value,'nuevo');
});
test('Aceptar descarte cierra una vez; un diálogo cerrado no vuelve a preguntar',()=>{
  const field={id:'campo',value:'antes'},f=fixture([field]);field.value='después';f.answer(true);
  assert.equal(f.c.requestCloseModal(),true);f.c.requestCloseModal();assert.deepEqual(f.counts(),{closed:1,prompts:1});
});
test('Sin cambios y al restaurar el valor original no pregunta',()=>{
  for(const revert of [false,true]){
    const field={id:'campo',value:'antes'},f=fixture([field]);
    if(revert){field.value='después';field.value='antes';}
    assert.equal(f.c.requestCloseModal(),true);assert.deepEqual(f.counts(),{closed:1,prompts:0});
  }
});
for(const type of ['checkbox','radio'])test(`Detecta cambios de ${type}`,()=>{
  const field={id:'campo',type,checked:false},f=fixture([field]);field.checked=true;
  assert.equal(f.c.requestCloseModal(),false);assert.equal(field.checked,true);
});
test('Detecta selecciones múltiples sin modificar opciones',()=>{
  const field={id:'campo',multiple:true,selectedOptions:[{value:'A'}]},f=fixture([field]);field.selectedOptions.push({value:'B'});
  assert.equal(f.c.requestCloseModal(),false);assert.equal(field.selectedOptions.length,2);
});
test('Detecta archivos seleccionados por sus metadatos, sin leer su contenido',()=>{
  const field={id:'archivo',type:'file',files:[]},f=fixture([field]);field.files.push({name:'prueba.csv',size:10,lastModified:12});
  assert.equal(f.c.requestCloseModal(),false);assert.equal(field.files.length,1);
});
test('Detecta campos incorporados y no muta valores al tomar la copia inicial',()=>{
  const f=fixture([{id:'primero',value:'A'}]),before=JSON.stringify(f.fields);
  f.c._modalSnapshot(f.body);assert.equal(JSON.stringify(f.fields),before);
  f.fields.push({id:'segundo',value:'B'});assert.equal(f.c.requestCloseModal(),false);
});
test('No trata como editables controles ocultos, deshabilitados o con tabindex negativo',()=>{
  const control=(extra={})=>({tabIndex:0,matches:()=>false,getClientRects:()=>[{}],closest:()=>null,...extra});
  const good=control(),root={querySelectorAll:()=>[good,control({tabIndex:-1}),control({matches:()=>true}),control({getClientRects:()=>[]}),control({closest:()=>({})})]};
  const f=fixture();assert.deepEqual(Array.from(f.c._modalFocusable(root)),[good]);
});
test('Conecta etiquetas existentes solo cuando el contenedor tiene un único campo con ID',()=>{
  const label={htmlFor:'',querySelector:()=>null,parentElement:{querySelectorAll:()=>[{id:'nombre'}]}};
  const ambiguous={htmlFor:'',querySelector:()=>null,parentElement:{querySelectorAll:()=>[{id:'a'},{id:'b'}]}};
  const f=fixture();f.c._labelModalFields({querySelectorAll:()=>[label,ambiguous]});
  assert.equal(label.htmlFor,'nombre');assert.equal(ambiguous.htmlFor,'');
});
test('Cerrar tras guardar conserva la API existente sin pedir descarte',()=>{
  const field={id:'campo',value:'original'},f=fixture([field]);field.value='guardado';f.c.closeModal();
  assert.deepEqual(f.counts(),{closed:1,prompts:0});
});
