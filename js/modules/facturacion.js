/**
 * ============================================================
 * AERCOM CRM v2
 * Facturación Module
 * Migrado tal cual desde index.html (Sprint 7)
 * ============================================================
 *
 * Responsabilidad: pantalla "Facturación Mensual" — listado de
 * clientes con su estado de facturación del mes (Pendiente/
 * Facturado/Cobrado/Excluido), navegación entre meses y filtros.
 * Expone getFactMonthSummary() al Dashboard como consulta sin escritura.
 * Trabaja sobre D.facturacion_estados (estado por mes y por
 * cliente), un dominio de datos propio y distinto al de Pipeline.
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, curMonth, persist(), toast(), toggleClear(), confirmDel(), canDeleteRecord(),
 *   monthLabel(), nowMonthStr(), addMonths(), _esc() (js/utils.js —
 *   PR-014.1, hardening XSS)
 *
 * Decisiones de límite de módulo:
 *   - confirmFacturacion()/doFacturar() (index.html) NO se migraron
 *     acá: mutan D.cotizaciones y llaman a renderPipeline() — son
 *     una acción de Pipeline/Cotizaciones ("marcar cotización como
 *     facturada"), no de esta pantalla. Quedan pendientes para el
 *     sprint de Pipeline.
 *   - delFactConfirm() SÍ se migró acá (ver más abajo) aunque elimina
 *     un cliente (D.clientes): se invoca desde la vista de Facturación
 *     y refresca renderFacturacion(), igual criterio que fichaPedidos()
 *     en Clientes (Sprint 5) — la pertenencia se define por dónde se
 *     dispara y qué refresca, no por qué colección toca.
 */

const MESES_FACTURACION=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getFactMonthSummary(mStr){
  const estados=D.facturacion_estados[mStr]||{};
  const mes=MESES_FACTURACION[Number(mStr.split('-')[1])-1];
  const clientes=D.clientes.filter(c=>{
    const meses=c.mesesFacturacion;
    return !Array.isArray(meses)||!meses.length||meses.includes(mes);
  });
  let pendientes=0,facturados=0,cobrados=0,excluidos=0;
  clientes.forEach(c=>{
    const st=estados[c.id]||'Pendiente';
    if(st==='Excluido')excluidos++;
    else if(st==='Facturado')facturados++;
    else if(st==='Cobrado')cobrados++;
    else pendientes++;
  });
  const total=clientes.length-excluidos;
  const completados=facturados+cobrados;
  return {clientes,estados,total,pendientes,facturados,cobrados,excluidos,completados,
    noAplican:D.clientes.length-clientes.length,
    porcentaje:total?Math.round(completados/total*100):0};
}

function applyFactFilter(){
  const q=(document.getElementById('fact-q')||{value:''}).value.trim().toLowerCase();
  const ajuste=(document.getElementById('fact-f-ajuste')||{value:''}).value;
  const est=(document.getElementById('fact-f-est')||{value:''}).value;
  const tipo=(document.getElementById('fact-f-tipo')||{value:''}).value;
  const modo=(document.getElementById('fact-f-modo')||{value:''}).value;
  const mStr=curMonth||nowMonthStr();
  const {clientes,estados}=getFactMonthSummary(mStr);
  const clientsById=new Map(clientes.map(c=>[c.id,c]));
  let n=0;
  document.querySelectorAll('#fact-list .cl-item').forEach(div=>{
    const c=clientsById.get(div.dataset.clientId);
    if(!c){div.style.display='none';return;}
    const st=estados[c.id]||'Pendiente';
    const tOk=!tipo||(tipo==='Sanatorio/Clínica'?c.tipo==='Sanatorio'||c.tipo==='Clínica':c.tipo===tipo);
    const mOk=!modo||(c.facturacion||'Manual')===modo;
    const ok=(!q||(c.nombre||'').toLowerCase().includes(q))&&(!ajuste||c.ajuste===ajuste)&&(!est||st===est)&&tOk&&mOk;
    div.style.display=ok?'':'none';
    if(ok)n++;
  });
  const el=document.getElementById('fact-count');
  if(el)el.textContent=(q||ajuste||est||tipo||modo)&&n<clientes.length?`Mostrando ${n} de ${clientes.length} clientes del mes`:'';
  toggleClear('fact',q||ajuste||est||tipo||modo);
}
function clearFactFilter(){
  ['fact-q','fact-f-ajuste','fact-f-est','fact-f-tipo','fact-f-modo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  applyFactFilter();
}

function renderFacturacion(){
  if(!curMonth) curMonth=nowMonthStr();
  document.getElementById('fact-month-lbl').textContent=monthLabel(curMonth);

  const mStr=curMonth||nowMonthStr();
  const {clientes:cl,estados,total,pendientes:pend,facturados:fact,cobrados:cobr,
    excluidos:excl,noAplican,completados,porcentaje:pct}=getFactMonthSummary(mStr);
  document.getElementById('facturacion-sub').textContent=
    `${total} clientes incluidos · ${completados} facturados o cobrados`;

  const MESES=MESES_FACTURACION;
  const ABREV=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const infoEl=document.getElementById('fact-month-info');
  if(infoEl) infoEl.textContent=[
    excl?`${excl} excluido${excl===1?'':'s'} del progreso`:'',
    noAplican?`${noAplican} no aplica${noAplican===1?'':'n'} al mes`:''
  ].filter(Boolean).join(' · ');

  if(!D.clientes.length){
    document.getElementById('fact-prog-bar').style.width='0%';
    document.getElementById('fact-prog-txt').textContent='Sin clientes';
    document.getElementById('fact-stats').innerHTML='';
    document.getElementById('fact-list').innerHTML='<div class="empty">No hay clientes registrados</div>';
    applyFactFilter();
    return;
  }

  if(!cl.length){
    document.getElementById('fact-prog-bar').style.width='0%';
    document.getElementById('fact-prog-txt').textContent=`${noAplican} cliente${noAplican!==1?'s':''} no factura${noAplican===1?'':'n'} en este mes`;
    document.getElementById('fact-stats').innerHTML='';
    document.getElementById('fact-list').innerHTML='<div class="empty">Ningún cliente factura en este mes según su configuración</div>';
    applyFactFilter();
    return;
  }

  document.getElementById('fact-prog-bar').style.width=pct+'%';
  document.getElementById('fact-prog-txt').textContent=
    `${completados} de ${total} clientes (${pct}%)`;
  document.getElementById('fact-stats').innerHTML=`
    <span class="badge b-warn">Pendientes: ${pend}</span>
    <span class="badge b-info">Facturados: ${fact}</span>
    <span class="badge b-ok">Cobrados: ${cobr}</span>
    ${excl?`<span class="badge b-gray">Excluidos: ${excl}</span>`:''}
  `;

  document.getElementById('fact-list').innerHTML=cl.map(c=>{
    const st=estados[c.id]||'Pendiente';
    const excluded=st==='Excluido';
    const rowCls=excluded?'':st==='Facturado'?'st-fact':st==='Cobrado'?'st-cobr':'';
    const mesesBadge=(c.mesesFacturacion&&c.mesesFacturacion.length)
      ?`<div style="font-size:10px;color:var(--t3);margin-top:2px">${c.mesesFacturacion.map(m=>ABREV[MESES.indexOf(m)]||m).join(' · ')}</div>`
      :'';
    return `<div class="cl-item ${rowCls}" data-client-id="${_esc(c.id)}" style="${excluded?'opacity:.4;':''}">
      <div style="font-weight:500;${excluded?'text-decoration:line-through;color:var(--t3);':''}">
        ${_esc(c.nombre)}
        ${mesesBadge}
      </div>
      <div><span class="badge b-gray" style="font-size:10.5px">${c.ajuste||'—'}</span></div>
      <div style="text-align:center">${c.requiereOC?'<span class="badge b-info" style="font-size:10px">OC</span>':'<span style="color:var(--t3)">—</span>'}</div>
      <div style="text-align:center">${c.requiereHES?'<span class="badge b-purple" style="font-size:10px">HES</span>':'<span style="color:var(--t3)">—</span>'}</div>
      <div style="font-size:12px">
        ${(()=>{
          const f=c.facturacion||'Manual';
          const d=c.facturacionDia;
          if(f==='Por fecha'&&d){
            const hoy=new Date().getDate();
            const pasada=hoy>=d;
            return `<span style="font-size:11.5px;font-weight:600;color:var(--info)">📅 Día ${d}</span>
                    <div style="font-size:10.5px;color:var(--t3);margin-top:1px">${pasada?'Ya pasó este mes':'Pendiente este mes'}</div>`;
          }
          if(f==='Automática') return '<span style="font-size:11.5px;font-weight:600;color:var(--ok)">⚡ Automática</span>';
          return '<span style="font-size:11.5px;color:var(--t2)">Manual</span>';
        })()}
      </div>
      <div>
        ${excluded
          ?`<div style="text-align:center;font-size:11.5px;color:var(--t3);font-style:italic;padding:4px 0">Excluido este mes</div>`
          :`<div class="st-sel">
            <button data-id="${_esc(c.id)}" onclick="setFactEst(this.dataset.id,'Pendiente')" class="${st==='Pendiente'?'on-pend':''}">Pend.</button>
            <button data-id="${_esc(c.id)}" onclick="setFactEst(this.dataset.id,'Facturado')" class="${st==='Facturado'?'on-fact':''}">Fact.</button>
            <button data-id="${_esc(c.id)}" onclick="setFactEst(this.dataset.id,'Cobrado')" class="${st==='Cobrado'?'on-cobr':''}">Cobr.</button>
          </div>`}
      </div>
      <div style="display:flex;align-items:center;justify-content:center">
        ${excluded
          ?`<button class="btn btn-outline btn-sm" data-id="${_esc(c.id)}" onclick="restoreFactMonth(this.dataset.id)" title="Restablecer para este mes" style="font-size:13px;padding:2px 7px">↩</button>`
          :`<button class="btn-del" data-id="${_esc(c.id)}" onclick="excludeFactMonth(this.dataset.id)" title="Excluir del mes">🗑</button>`}
      </div>
    </div>`;
  }).join('');
  applyFactFilter();
}

function changeMonth(n){
  curMonth=addMonths(curMonth||nowMonthStr(),n);
  renderFacturacion();
}

function setFactEst(cid,st){
  if(!curMonth) curMonth=nowMonthStr();
  if(!D.facturacion_estados[curMonth]) D.facturacion_estados[curMonth]={};
  D.facturacion_estados[curMonth][cid]=st;
  if(persist()===false) return;
  renderFacturacion();
}

function excludeFactMonth(cid){
  if(!curMonth) curMonth=nowMonthStr();
  if(!D.facturacion_estados[curMonth]) D.facturacion_estados[curMonth]={};
  D.facturacion_estados[curMonth][cid]='Excluido';
  if(persist()===false) return;renderFacturacion();toast('Cliente excluido del mes');
}

function restoreFactMonth(cid){
  if(!curMonth) curMonth=nowMonthStr();
  if(D.facturacion_estados[curMonth]) delete D.facturacion_estados[curMonth][cid];
  if(persist()===false) return;renderFacturacion();toast('Cliente restablecido');
}

function delFactConfirm(cid){
  if(!canDeleteRecord('clientes',cid)) return;
  const c=D.clientes.find(x=>x.id===cid);
  confirmDel(c?_esc(c.nombre):_esc(cid),()=>{
    if(!canDeleteRecord('clientes',cid)) return;
    D.clientes=D.clientes.filter(x=>x.id!==cid);
    if(persist()===false) return;renderFacturacion();toast('Cliente eliminado');
  });
}
