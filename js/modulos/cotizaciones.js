/**
 * ============================================================
 * AERCOM CRM v2
 * Cotizaciones Module (Pipeline)
 * Migrado tal cual desde index.html (Sprint 8)
 * ============================================================
 *
 * Responsabilidad: pantalla "Cotizaciones" (kanban Pipeline) —
 * render de columnas/tarjetas, drag&drop entre estados, filtros,
 * alta/edición/eliminación de cotizaciones, y la confirmación de
 * facturación (transición de estado a "Facturada"), que pertenece
 * acá porque muta D.cotizaciones y refresca renderPipeline() — no
 * toca D.facturacion_estados (dominio de js/modules/facturacion.js).
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, ESTADOS, E_COLOR*, persist(), toast(), closeModal(), confirmDel(),
 *   toggleClear(), renderModule(), clientName()*, toTitleCase(),
 *   openPedidoModal()**, today(), fmtMoney(), fmtDate(), daysDiff(),
 *   _esc() (js/utils.js — PR-014.1, hardening XSS)
 *
 *   (*) ESTADOS/E_COLOR/clientName() siguen en index.html: ESTADOS y
 *   E_COLOR los usan también Dashboard (gráficos) y Clientes (ficha,
 *   pestaña Cotizaciones); clientName() es helper de dominio compartido.
 *   (**) openPedidoModal() pertenece a Pedidos, aún no migrado.
 */

/* =========================
   ESTADO DEL MÓDULO
========================= */

let editingQuoteId = null;

/* =========================
   KANBAN — render y drag&drop
========================= */

function renderPipeline(){
  const activas=D.cotizaciones.filter(c=>
    !['Facturada','Ejecutada','Rechazada'].includes(c.estado)).length;
  const aFact=D.cotizaciones.filter(c=>c.estado==='A facturar').length;
  document.getElementById('pipeline-sub').textContent=
    `${activas} activas · ${aFact} a facturar`;

  const wrap=document.getElementById('pipeline-kanban');
  wrap.innerHTML='';
  ESTADOS.forEach(est=>{
    const cards=D.cotizaciones.filter(c=>c.estado===est);
    const col=document.createElement('div');
    col.className='k-col';
    col.dataset.estadoCol=est;
    const totalMonto=cards.reduce((s,c)=>s+(c.monto||0),0);
    col.innerHTML=`
      <div class="k-col-head" style="color:${E_COLOR[est]}">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>${est}</span><span class="k-count">${cards.length}</span>
        </div>
        ${totalMonto>0?`<div class="k-col-total">${fmtMoney(totalMonto)}</div>`:''}
      </div>
      <div class="k-body" data-estado="${est}">
        ${cards.length===0?'<div class="k-empty">Sin cotizaciones</div>':''}
        ${cards.map(c=>buildCard(c,est)).join('')}
      </div>`;
    wrap.appendChild(col);
  });
  setupDrag();
}

function buildCard(c, estado){
  const diff = c.fechaFollowup ? daysDiff(c.fechaFollowup) : 9999;
  const overdue  = diff < 0  && !['A facturar','Facturada','Ejecutada','Rechazada'].includes(c.estado);
  const dueToday = diff === 0 && !['A facturar','Facturada','Ejecutada','Rechazada'].includes(c.estado);
  const cls = overdue ? 'ov-due' : dueToday ? 'ov-today' : '';

  const pedExist = c.estado === 'Aprobada'
    ? (D.pedidos||[]).find(p => p.cotizacionId === c.id)
    : null;

  const pedBtn = c.estado === 'Aprobada'
    ? (pedExist
      ? `<div class="k-ped-wrap">
           <span class="k-ped-tag k-ped-ok"
                 data-pedid="${_esc(pedExist.id)}"
                 onclick="event.stopPropagation();openPedidoModal(this.dataset.pedid,null,null)">
             ✓ ${_esc(pedExist.id)}
           </span>
         </div>`
      : `<div class="k-ped-wrap">
           <button class="k-ped-btn" draggable="false"
                   data-cotid="${_esc(c.id)}"
                   onclick="event.stopPropagation();openPedidoModal(null,this.dataset.cotid,null)">
             📋 Generar pedido
           </button>
         </div>`)
    : '';

  const followUpHtml = c.fechaFollowup
    ? `<div class="k-followup ${overdue?'k-followup-err':dueToday?'k-followup-warn':''}">
         ${overdue ? '⚠ ' : dueToday ? '⏰ ' : ''}${fmtDate(c.fechaFollowup)}
       </div>`
    : '';

  const accentColor = E_COLOR[estado] || E_COLOR[c.estado] || '#9b9b97';
  const monto = fmtMoney(c.monto);
  const cliente = toTitleCase(clientName(c.clienteId));
  const desc = c.descripcion
    ? (c.descripcion.length > 60 ? c.descripcion.slice(0,60)+'…' : c.descripcion)
    : '—';

  return `
  <div class="k-card ${cls}" draggable="true" data-id="${_esc(c.id)}"
       ondblclick="openQuoteModal(this.dataset.id,null)"
       title="Doble clic para editar">

    <div class="k-card-accent" style="background:${accentColor}"></div>

    <div class="k-card-inner">

      <div class="k-card-top">
        <span class="k-id">${_esc(c.id)}</span>
        <button class="k-del-btn" draggable="false"
                data-id="${_esc(c.id)}"
                onclick="event.stopPropagation();delQuoteConfirm(this.dataset.id)"
                title="Eliminar">✕</button>
      </div>

      <div class="k-client">${_esc(cliente)}</div>

      <div class="k-desc">${_esc(desc)}</div>

      <div class="k-card-footer">
        <div class="k-amount">${monto}</div>
        <div class="k-meta">
          ${followUpHtml}
          ${c.responsable
            ? `<div class="k-resp">${_esc(c.responsable.split(' ')[0])}</div>`
            : ''}
        </div>
      </div>

      ${pedBtn}

    </div>
  </div>`;
}

function setupDrag(){
  let dragId=null;
  const wrap=document.getElementById('pipeline-kanban');

  wrap.addEventListener('dragstart',e=>{
    const card=e.target.closest('.k-card');
    if(!card) return;
    dragId=card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';
  });

  document.addEventListener('dragend',()=>{
    document.querySelectorAll('.k-card.dragging').forEach(c=>c.classList.remove('dragging'));
  },{once:false});

  wrap.querySelectorAll('.k-body').forEach(body=>{
    body.addEventListener('dragover',e=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      wrap.querySelectorAll('.k-body').forEach(b=>b.classList.remove('drag-over'));
      body.classList.add('drag-over');
    });
    body.addEventListener('dragleave',e=>{
      if(!body.contains(e.relatedTarget)) body.classList.remove('drag-over');
    });
    body.addEventListener('drop',e=>{
      e.preventDefault();
      body.classList.remove('drag-over');
      if(!dragId) return;
      const cot=D.cotizaciones.find(c=>c.id===dragId);
      const newEst=body.dataset.estado;
      if(cot){
        if(newEst==='Facturada') confirmFacturacion(cot.id);
        else { cot.estado=newEst; persist(); renderPipeline(); }
      }
      dragId=null;
    });
  });
}

/* =========================
   TRANSICIÓN A "FACTURADA"
========================= */

function confirmFacturacion(cotId){
  const cot=D.cotizaciones.find(c=>c.id===cotId);
  if(!cot) return;
  document.getElementById('modal-title').textContent=`Confirmar facturación — ${cotId}`;
  document.getElementById('modal-body').innerHTML=`
    <p style="color:var(--t2);margin:0 0 16px;font-size:13.5px">¿Confirmar que la cotización <strong>${cotId}</strong> fue facturada?</p>
    <div class="form-row">
      <div class="fg"><label class="fl">N° de factura <span style="color:var(--t3);font-weight:400">(opcional)</span></label><input class="fc" id="fact-nro" placeholder="Ej: A-0001-00012345" value="${cot.nroFactura||''}"></div>
      <div class="fg"><label class="fl">Fecha de factura</label><input class="fc" type="date" id="fact-fecha" value="${cot.fechaFactura||today()}"></div>
    </div>`;
  document.getElementById('modal-foot').innerHTML=`
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" style="background:#8b5cf6;border-color:#8b5cf6" data-id="${_esc(cotId)}" onclick="doFacturar(this.dataset.id)">Confirmar facturación</button>`;
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('fact-nro')?.focus(),80);
}
function doFacturar(cotId){
  const cot=D.cotizaciones.find(c=>c.id===cotId);
  if(!cot) return;
  cot.estado='Facturada';
  cot.nroFactura=(document.getElementById('fact-nro')||{}).value.trim()||'';
  cot.fechaFactura=(document.getElementById('fact-fecha')||{}).value||today();
  persist();
  closeModal();
  renderPipeline();
  toast(`${cotId} marcada como Facturada`);
}

/* =========================
   FILTROS
========================= */

function refreshPipeRespOpts(){
  const sel=document.getElementById('pipe-f-resp');
  if(!sel)return;
  const opts=[...new Set(D.cotizaciones.map(c=>c.responsable).filter(Boolean))].sort();
  sel.innerHTML='<option value="">Responsable: Todos</option>'+opts.map(r=>`<option>${_esc(r)}</option>`).join('');
}
function applyPipeFilter(){
  const q=(document.getElementById('pipe-q')||{value:''}).value.trim().toLowerCase();
  const est=(document.getElementById('pipe-f-est')||{value:''}).value;
  const resp=(document.getElementById('pipe-f-resp')||{value:''}).value;
  document.querySelectorAll('.k-col').forEach(col=>{
    const colEst=col.querySelector('.k-body')?.dataset.estado||'';
    col.style.display=(!est||colEst===est)?'':'none';
  });
  let n=0;
  document.querySelectorAll('.k-card').forEach(card=>{
    const col=card.closest('.k-col');
    if(col&&col.style.display==='none'){card.style.display='none';return;}
    const idT=(card.querySelector('.k-id')?.textContent||'').toLowerCase();
    const cliT=(card.querySelector('.k-client')?.textContent||'').toLowerCase();
    const descT=(card.querySelector('.k-desc')?.textContent||'').toLowerCase();
    const respT=(card.lastElementChild?.textContent||'').trim();
    const ok=(!q||idT.includes(q)||cliT.includes(q)||descT.includes(q))&&(!resp||respT===resp);
    card.style.display=ok?'':'none';
    if(ok)n++;
  });
  document.querySelectorAll('.k-col').forEach(col=>{
    if(col.style.display==='none')return;
    const vis=[...col.querySelectorAll('.k-card')].filter(c=>c.style.display!=='none').length;
    const cEl=col.querySelector('.k-count');
    if(cEl)cEl.textContent=vis;
  });
  const el=document.getElementById('pipe-count');
  const anyF=q||est||resp;
  if(el)el.textContent=anyF?(n?`${n} cotizaciones encontradas`:'Sin resultados'):'';
  toggleClear('pipe',anyF);
}
function clearPipeFilter(){
  ['pipe-q','pipe-f-est','pipe-f-resp'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  applyPipeFilter();
}

/* =========================
   MODAL ALTA / EDICIÓN
========================= */

function updateEquipSel(preselect){
  const cliId=document.getElementById('f-cli').value;
  const sel=document.getElementById('f-eq');
  if(!cliId){
    sel.disabled=true;
    sel.innerHTML='<option value="">Seleccioná un cliente primero</option>';
    return;
  }
  sel.disabled=false;
  const eqs=D.equipos.filter(e=>e.clienteId===cliId);
  const p=preselect||'';
  sel.innerHTML='<option value="">— Sin equipo —</option>'+
    eqs.map(e=>`<option value="${e.id}" ${p===e.id?'selected':''}>${_esc(e.id)} — ${e.tipo}</option>`).join('');
}

function openQuoteModal(qid,prefillEquip){
  editingQuoteId=qid||null;
  const q=qid?D.cotizaciones.find(c=>c.id===qid):null;
  document.getElementById('modal-title').textContent=q?`Editar — ${qid}`:'Nueva Cotización';

  const clientOpts=D.clientes.map(c=>`<option value="${c.id}" ${(q?.clienteId===c.id||prefillEquip?.clienteId===c.id)?'selected':''}>${_esc(c.nombre)}</option>`).join('');
  const stOpts=ESTADOS.map(s=>`<option value="${s}" ${(q?.estado===s)||(s==='Solicitud'&&!q)?'selected':''}>${s}</option>`).join('');
  const nextId=`COT-${new Date().getFullYear()}-${String(D.cotizaciones.length+1).padStart(3,'0')}`;

  document.getElementById('modal-body').innerHTML=`
    <div class="form-row">
      <div class="fg"><label class="fl">N° Cotización</label><input class="fc" id="f-id" value="${_esc(q?.id)||nextId}" ${q?'readonly':''}></div>
      <div class="fg"><label class="fl">Estado</label><select class="fc" id="f-est">${stOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Cliente</label><select class="fc" id="f-cli" onchange="updateEquipSel()">${clientOpts}</select></div>
      <div class="fg"><label class="fl">Equipo</label><select class="fc" id="f-eq" disabled><option value="">Seleccioná un cliente primero</option></select></div>
    </div>
    <div class="fg"><label class="fl">Descripción *</label><textarea class="fc" id="f-desc">${_esc(q?.descripcion)||(prefillEquip?`Mantenimiento preventivo — ${_esc(prefillEquip.id)} — ${prefillEquip.tipo}`:'')}</textarea></div>
    <div class="form-row">
      <div class="fg"><label class="fl">Monto ($)</label><input class="fc" type="number" id="f-monto" value="${q?.monto||''}"></div>
      <div class="fg"><label class="fl">Responsable</label><input class="fc" id="f-resp" value="${_esc(q?.responsable)}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Fecha envío</label><input class="fc" type="date" id="f-env" value="${q?.fechaEnvio||today()}"></div>
      <div class="fg"><label class="fl">Fecha follow-up</label><input class="fc" type="date" id="f-fup" value="${q?.fechaFollowup||''}"></div>
    </div>
    <div class="fg"><label class="fl">Notas</label><textarea class="fc" id="f-notas">${_esc(q?.notas)}</textarea></div>
  `;
  document.getElementById('modal-foot').innerHTML=`
    ${q?`<button class="btn" style="background:#fef2f2;color:var(--err);border:1px solid #fecaca" data-id="${_esc(qid)}" onclick="deleteQuote(this.dataset.id)">Eliminar</button>`:''}
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveQuote()">Guardar cotización</button>
  `;
  document.getElementById('modal-overlay').classList.add('open');
  updateEquipSel(q?.equipoId||prefillEquip?.id||'');
}

function saveQuote(){
  const id=document.getElementById('f-id').value.trim();
  const est=document.getElementById('f-est').value;
  const cliId=document.getElementById('f-cli').value;
  const eqId=document.getElementById('f-eq').value;
  const desc=document.getElementById('f-desc').value.trim();
  const monto=parseFloat(document.getElementById('f-monto').value)||0;
  const resp=document.getElementById('f-resp').value.trim();
  const env=document.getElementById('f-env').value;
  const fup=document.getElementById('f-fup').value;
  const notas=document.getElementById('f-notas').value.trim();
  if(!id||!cliId||!desc){toast('⚠ Completá N° cotización, cliente y descripción');return;}
  const existing=editingQuoteId?D.cotizaciones.find(c=>c.id===editingQuoteId):null;
  const obj={id,clienteId:cliId,equipoId:eqId,descripcion:desc,monto,fechaEnvio:env,fechaFollowup:fup,responsable:resp,estado:est,notas,nroFactura:existing?.nroFactura||'',fechaFactura:existing?.fechaFactura||''};
  if(editingQuoteId){
    const i=D.cotizaciones.findIndex(c=>c.id===editingQuoteId);
    if(i>-1) D.cotizaciones[i]=obj;
  } else {
    if(D.cotizaciones.find(c=>c.id===id)){toast('⚠ Ya existe una cotización con ese número');return;}
    D.cotizaciones.push(obj);
  }
  persist(); closeModal(); renderModule();
  toast(`Cotización ${id} guardada`);
}

function deleteQuote(id){
  confirmDel(`Cotización ${_esc(id)}`,()=>{
    D.cotizaciones=D.cotizaciones.filter(c=>c.id!==id);
    persist(); closeModal(); renderModule();
    toast(`Cotización ${id} eliminada`);
  });
}

function delQuoteConfirm(qid){
  const c=D.cotizaciones.find(x=>x.id===qid);
  confirmDel(c?`${_esc(c.id)} — ${_esc(clientName(c.clienteId))}`:_esc(qid),()=>{
    D.cotizaciones=D.cotizaciones.filter(x=>x.id!==qid);
    persist();renderPipeline();toast(`Cotización ${qid} eliminada`);
  });
}
