/**
 * ============================================================
 * AERCOM CRM v2
 * Equipos Module
 * Migrado tal cual desde index.html (Sprint 6)
 * ============================================================
 *
 * Responsabilidad: listado, filtros, alta/edición/eliminación de
 * equipos, edición inline de fechas (preventivo/aceite/batería/
 * visita) y los helpers de render de fecha (eqDateCell) que también
 * usa la ficha de Clientes.
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, persist(), toast(), closeModal(), confirmDel(), toggleClear(),
 *   equipStatus()*, clientCritical()*, clientName()*, fichaTab()**,
 *   fmtDate(), daysDiff(), addDays(), _esc() (js/utils.js — PR-014.1,
 *   hardening XSS)
 *
 *   (*) equipStatus()/clientCritical()/clientName() siguen en
 *   index.html porque las usan también Dashboard, Clientes y Pipeline
 *   — son helpers de dominio compartidos, no exclusivos de Equipos.
 *   (**) fichaTab() sigue en js/modules/clientes.js: equipInlineDate()
 *   la llama para refrescar la pestaña "Equipos" de la ficha cuando la
 *   edición inline de fecha ocurre ahí en vez de en la tabla principal.
 *
 * Nota: quoteFromEquip() se migró tal cual aunque no tiene ningún
 * punto de llamada en el proyecto actual (código muerto preexistente,
 * ver hallazgos del Sprint 6). No se eliminó para no alterar
 * funcionalidad ni generar una decisión de limpieza no solicitada.
 */

/* =========================
   ESTADO DEL MÓDULO
========================= */

let equipFilter = 'todos';

/* =========================
   HELPERS DE RENDER — fecha inline
========================= */

function equipInlineDate(el, equipId, fieldKey){
  const eq=D.equipos.find(e=>e.id===equipId);
  if(!eq) return;
  const origVal=eq[fieldKey]||'';
  const origHtml=el.outerHTML;
  const inMain=!!el.closest('#equip-tbody');
  const inp=document.createElement('input');
  inp.type='date';
  inp.value=origVal;
  inp.style.cssText='font-size:13px;border:0.5px solid var(--info);border-radius:4px;padding:2px 4px;background:var(--card);color:var(--t1);font-family:inherit;outline:none;max-width:140px';
  el.replaceWith(inp);
  inp.focus();
  let done=false;
  function commit(){
    if(done) return; done=true;
    const v=inp.value||null;
    eq[fieldKey]=v;
    const FD={'Semanal':7,'Quincenal':15,'Mensual':30,'Bimestral':60,'Trimestral':90,'Semestral':180,'Anual':365};
    if(fieldKey==='ultimoPreventivo') eq.proximoPreventivo=v?addDays(v,365):null;
    else if(fieldKey==='ultimoAceite') eq.proximoAceite=v?addDays(v,730):null;
    else if(fieldKey==='ultimoBateria') eq.proximoBateria=v?addDays(v,730):null;
    else if(fieldKey==='ultimaVisita'){
      const cli=D.clientes.find(c=>c.id===eq.clienteId);
      const d=FD[cli?.frecuenciaVisita||''];
      eq.proximaVisita=v&&d?addDays(v,d):null;
    }
    persist();
    toast('✓ Fecha actualizada');
    if(inMain) renderEquipos(); else fichaTab('equipos');
    setTimeout(()=>{
      const cell=document.querySelector(`[data-equip="${equipId}"][data-field="${fieldKey}"]`);
      if(cell){cell.classList.add('eid-flash');setTimeout(()=>cell.classList.remove('eid-flash'),950);}
    },30);
  }
  function restore(){
    if(done) return; done=true;
    inp.insertAdjacentHTML('beforebegin',origHtml);
    inp.remove();
  }
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',ev=>{
    if(ev.key==='Enter') inp.blur();
    if(ev.key==='Escape'){inp.removeEventListener('blur',commit);restore();}
  });
}

function eqDateCell(eid, lastField, lastVal, nextVal){
  const diff=nextVal?daysDiff(nextVal):null;
  const nc=diff===null?'color:var(--t3)':diff<0?'color:var(--err);font-weight:600':diff<=30?'color:#b45309;font-weight:600':'color:var(--ok)';
  const lastHtml=lastVal
    ?`<span class="equip-date-last" data-eid="${_esc(eid)}" data-field="${_esc(lastField)}" onclick="equipInlineDate(this,this.dataset.eid,this.dataset.field)">${fmtDate(lastVal)}</span>`
    :`<span class="equip-date-none" data-eid="${_esc(eid)}" data-field="${_esc(lastField)}" onclick="equipInlineDate(this,this.dataset.eid,this.dataset.field)">+ Sin registro</span>`;
  return `<td class="equip-date-cell" data-equip="${_esc(eid)}" data-field="${_esc(lastField)}">${lastHtml}<div class="equip-date-next" style="${nc}">Próx: ${nextVal?fmtDate(nextVal):'—'}</div></td>`;
}

/* =========================
   LISTADO — render y filtros
========================= */

function renderEquipos(){
  const venc=D.equipos.filter(e=>equipStatus(e).st==='rojo').length;
  const prox=D.equipos.filter(e=>equipStatus(e).st==='amarillo').length;
  document.getElementById('equipos-sub').textContent=
    `${D.equipos.length} equipos · ${venc} vencidos · ${prox} por vencer`;

  const filtered=D.equipos.filter(e=>equipFilter==='todos'||equipStatus(e).st===equipFilter);
  const tbody=document.getElementById('equip-tbody');
  if(!filtered.length){
    tbody.innerHTML=`<tr><td colspan="8"><div class="empty">No hay equipos para mostrar</div></td></tr>`;
    return;
  }
  tbody.innerHTML=filtered.map(e=>{
    const {st,nextAceite,nextBateria,nextVisita}=equipStatus(e);
    const rc=st==='rojo'?'row-err':st==='amarillo'?'row-warn':'';
    const dot=st==='rojo'?'dot-err':st==='amarillo'?'dot-warn':st==='gris'?'':'dot-ok';
    const badg=st==='rojo'?'b-err':st==='amarillo'?'b-warn':st==='gris'?'b-gray':'b-ok';
    const lbl=st==='rojo'?'Vencido':st==='amarillo'?'Próximo':st==='gris'?'Sin fecha':'Al día';
    const crit=clientCritical(e.clienteId);

    const tipoAbrev=e.tipo==='Grupo Electrógeno'?'G. Electrógeno':e.tipo;
    return `<tr class="${rc}">
      <td>
        <div style="font-size:13px;font-weight:600">${_esc(e.id)}</div>
        <div style="font-size:11px;color:var(--t2)">${tipoAbrev}</div>
      </td>
      <td>${_esc(clientName(e.clienteId))}</td>
      ${eqDateCell(e.id,'ultimaVisita',e.ultimaVisita,nextVisita)}
      ${eqDateCell(e.id,'ultimoPreventivo',e.ultimoPreventivo,e.proximoPreventivo)}
      ${eqDateCell(e.id,'ultimoAceite',e.ultimoAceite,nextAceite)}
      ${eqDateCell(e.id,'ultimoBateria',e.ultimoBateria,nextBateria)}
      <td><span class="dot ${dot}"></span><span class="badge ${badg}">${lbl}</span></td>
      <td style="white-space:nowrap">
        <div style="display:flex;gap:6px">
          <button class="eq-act-btn" data-id="${_esc(e.id)}" onclick="openEquipModal(this.dataset.id)" title="Editar equipo">✏</button>
          <button class="eq-act-btn eq-act-del" data-id="${_esc(e.id)}" onclick="delEquipConfirm(this.dataset.id)" title="Eliminar equipo">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function setEquipFilter(f,btn){
  equipFilter=f;
  document.querySelectorAll('.filters-bar .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderEquipos();
}

function applyEquipFilter(){
  const q=(document.getElementById('equip-q')||{value:''}).value.trim().toLowerCase();
  const tipo=(document.getElementById('equip-f-tipo')||{value:''}).value;
  const est=(document.getElementById('equip-f-est')||{value:''}).value;
  const rows=document.querySelectorAll('#equip-tbody tr');
  let n=0,tot=rows.length;
  rows.forEach(tr=>{
    const cells=tr.cells;
    if(!cells||cells.length<7){return;}
    // cells[0] = ID/Tipo (tipo está como subtexto), cells[1] = Cliente, cells[6] = Estado
    const id=(cells[0].textContent||'').toLowerCase();
    const cli=(cells[1].textContent||'').toLowerCase();
    const tipoV=(cells[0].textContent||'');  // el tipo está en el subtexto de la celda ID
    const estV=(cells[6].textContent||'').trim();
    const tipoOk=!tipo||tipoV.includes(tipo);
    const estOk=!est||estV.includes(est);
    const ok=(!q||id.includes(q)||cli.includes(q))&&tipoOk&&estOk;
    tr.style.display=ok?'':'none';
    if(ok)n++;
  });
  const el=document.getElementById('equip-count');
  if(el)el.textContent=(q||tipo||est)&&n<tot?`Mostrando ${n} de ${tot} equipos`:'';
  toggleClear('equip',q||tipo||est);
}
function clearEquipFilter(){
  ['equip-q','equip-f-tipo','equip-f-est'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  applyEquipFilter();
}

/* =========================
   ACCIÓN CRUZADA (sin puntos de llamada actuales)
========================= */

function quoteFromEquip(eid){
  const eq=D.equipos.find(e=>e.id===eid);
  if(eq) openQuoteModal(null,eq);
}

/* =========================
   MODAL ALTA / EDICIÓN
========================= */

function openEquipModal(eid){
  const eq=eid?D.equipos.find(e=>e.id===eid):null;
  document.getElementById('modal-title').textContent=eq?`Editar Equipo — ${eid}`:'Nuevo Equipo';
  const tipos=['Grupo Electrógeno','Electrocompresor','Motocompresor','Motobomba','Secadora de Aire'];
  const tipoOpts=tipos.map(t=>`<option ${eq?.tipo===t?'selected':''}>${t}</option>`).join('');
  const cliOpts=D.clientes.map(c=>`<option value="${c.id}" ${eq?.clienteId===c.id?'selected':''}>${_esc(c.nombre)}</option>`).join('');
  const _vfd={'Semanal':7,'Quincenal':15,'Mensual':30,'Bimestral':60,'Trimestral':90,'Semestral':180,'Anual':365};
  const _vcli=D.clientes.find(c=>c.id===(eq?.clienteId||''));
  const _nvisita=eq?.proximaVisita||(eq?.ultimaVisita&&_vfd[_vcli?.frecuenciaVisita||'']?addDays(eq.ultimaVisita,_vfd[_vcli?.frecuenciaVisita||'']):'' );

  document.getElementById('modal-body').innerHTML=`
    <div class="form-row">
      <div class="fg"><label class="fl">ID Equipo *</label><input class="fc" id="e-id" value="${_esc(eq?.id)}" ${eq?'readonly':''} placeholder="ej: GE-009"></div>
      <div class="fg"><label class="fl">Tipo de equipo</label><select class="fc" id="e-tipo">${tipoOpts}</select></div>
    </div>
    <div class="fg"><label class="fl">Cliente *</label><select class="fc" id="e-cli">${cliOpts}</select></div>
    <div class="form-row">
      <div class="fg"><label class="fl">Fecha del último preventivo realizado</label><input class="fc" type="date" id="e-uprev" value="${eq?.ultimoPreventivo||''}" oninput="autoNextPrev()"></div>
      <div class="fg"><label class="fl">Próximo preventivo</label><input class="fc" type="date" id="e-nprev" value="${eq?.proximoPreventivo||''}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Fecha del último cambio de refrigerante</label><input class="fc" type="date" id="e-ace" value="${eq?.ultimoAceite||''}" oninput="autoNextAceite()"></div>
      <div class="fg"><label class="fl">Próximo refrigerante</label><input class="fc" type="date" id="e-nace" value="${eq?.proximoAceite||(eq?.ultimoAceite?addDays(eq.ultimoAceite,730):'')}" ></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Fecha del último cambio de batería</label><input class="fc" type="date" id="e-bat" value="${eq?.ultimoBateria||''}"></div>
      <div class="fg"><label class="fl">Último refrigerante (gas)</label><input class="fc" type="date" id="e-ref" value="${eq?.ultimoRefrigerante||''}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Horómetro (hs)</label><input class="fc" type="number" id="e-hor" value="${eq?.horometro||''}"></div>
      <div class="fg"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Fecha de la última visita</label><input class="fc" type="date" id="e-uvisita" value="${eq?.ultimaVisita||''}" oninput="autoNextVisita()"></div>
      <div class="fg"><label class="fl">Próxima visita</label><input class="fc" type="date" id="e-nvisita" value="${_nvisita}"></div>
    </div>
    <div class="fg"><label class="fl">Observaciones</label><textarea class="fc" id="e-obs">${_esc(eq?.observaciones)}</textarea></div>
  `;
  document.getElementById('modal-foot').innerHTML=`
    ${eq?`<button class="btn" style="background:#fef2f2;color:var(--err);border:1px solid #fecaca" data-id="${_esc(eid)}" onclick="deleteEquip(this.dataset.id)">Eliminar</button>`:''}
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveEquip()">Guardar equipo</button>
  `;
  document.getElementById('modal-overlay').classList.add('open');
}

function autoNextPrev(){
  const v=document.getElementById('e-uprev').value;
  if(v) document.getElementById('e-nprev').value=addDays(v,365);
}

function autoNextAceite(){
  const v=document.getElementById('e-ace').value;
  if(v) document.getElementById('e-nace').value=addDays(v,730);
}

function autoNextVisita(){
  const v=document.getElementById('e-uvisita').value;
  if(!v) return;
  const cli=D.clientes.find(c=>c.id===document.getElementById('e-cli').value);
  const FDAYS={'Semanal':7,'Quincenal':15,'Mensual':30,'Bimestral':60,'Trimestral':90,'Semestral':180,'Anual':365};
  const d=FDAYS[cli?.frecuenciaVisita||''];
  if(d) document.getElementById('e-nvisita').value=addDays(v,d);
}

function saveEquip(){
  const id=document.getElementById('e-id').value.trim();
  const tipo=document.getElementById('e-tipo').value;
  const cliId=document.getElementById('e-cli').value;
  const uprev=document.getElementById('e-uprev').value;
  const nprev=document.getElementById('e-nprev').value;
  const ace=document.getElementById('e-ace').value;
  const nace=document.getElementById('e-nace').value;
  const bat=document.getElementById('e-bat').value;
  const ref=document.getElementById('e-ref').value;
  const hor=parseInt(document.getElementById('e-hor').value)||0;
  const obs=document.getElementById('e-obs').value.trim();
  const uvisita=(document.getElementById('e-uvisita')||{value:''}).value;
  const nvisita=(document.getElementById('e-nvisita')||{value:''}).value;
  if(!id||!cliId){toast('⚠ Completá ID y cliente');return;}
  const obj={id,clienteId:cliId,tipo,ultimoPreventivo:uprev,proximoPreventivo:nprev,ultimoAceite:ace,proximoAceite:nace,ultimoBateria:bat,ultimoRefrigerante:ref,horometro:hor,observaciones:obs,ultimaVisita:uvisita,proximaVisita:nvisita};
  const i=D.equipos.findIndex(e=>e.id===id);
  if(i>-1) D.equipos[i]=obj; else D.equipos.push(obj);
  persist(); closeModal(); renderEquipos();
  toast(`Equipo ${id} guardado`);
}

function deleteEquip(id){
  confirmDel(`Equipo ${_esc(id)}`,()=>{
    D.equipos=D.equipos.filter(e=>e.id!==id);
    persist(); closeModal(); renderEquipos();
    toast(`Equipo ${id} eliminado`);
  });
}

function delEquipConfirm(eid){
  const e=D.equipos.find(x=>x.id===eid);
  confirmDel(e?`${_esc(e.id)} — ${_esc(clientName(e.clienteId))}`:_esc(eid),()=>{
    D.equipos=D.equipos.filter(x=>x.id!==eid);
    persist();renderEquipos();toast(`Equipo ${eid} eliminado`);
  });
}
