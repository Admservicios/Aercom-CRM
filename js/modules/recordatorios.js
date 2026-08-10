/**
 * ============================================================
 * AERCOM CRM v2
 * Recordatorios Module
 * Migrado tal cual desde index.html (Sprint 11)
 * ============================================================
 *
 * Responsabilidad: pantalla "Recordatorios" — listado con filtro
 * por estado (select `rem-filter`) y buscador (`rem-q`/`rem-f-prio`/
 * `rem-f-est`), alta/edición/eliminación, y el toggle de estado
 * Pendiente↔Hecho. Dominio propio: `D.recordatorios`.
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, persist(), toast(), closeModal(), confirmDel(), toggleClear(),
 *   clientName(), critBadge() (index.html — comparten lectura de
 *   D.clientes con otros módulos), daysDiff(), fmtDateTime(), _esc()
 *   (js/utils.js)
 *
 * Decisiones de límite de módulo:
 *   - D.clientes se lee (select de cliente del modal, nombre en la
 *     fila, badge de crítico) pero no es dominio de este módulo.
 *   - fichaRecordatorios() sigue en js/modules/clientes.js
 *     (Sprint 5) — es la pestaña de recordatorios dentro de la
 *     ficha de un cliente, no se duplica acá.
 *   - El caso 'recordatorios' del dispatcher renderModule() y el
 *     conteo de badges del sidebar (updateSidebarBadges()) siguen
 *     en index.html, compartidos por todos los módulos.
 *
 * Nota (PR-008): el stub previo vivía en js/recordatorios.js (raíz),
 * sin `<script src>` en index.html — nunca se cargó ni se referenció
 * desde ningún lado. Se reubica acá para seguir la convención vigente
 * desde Sprint 4 (todo módulo real vive en js/modules/); el archivo
 * viejo se eliminó por ser un stub inerte, no rompe compatibilidad.
 */

function applyRemFilter(){
  const q=(document.getElementById('rem-q')||{value:''}).value.trim().toLowerCase();
  const prio=(document.getElementById('rem-f-prio')||{value:''}).value;
  const est=(document.getElementById('rem-f-est')||{value:''}).value;
  const rows=document.querySelectorAll('#rem-tbody tr');
  let n=0,tot=rows.length;
  rows.forEach(tr=>{
    const cells=tr.cells;
    if(!cells||cells.length<6)return;
    const tit=(cells[0].textContent||'').toLowerCase();
    const cli=(cells[1].textContent||'').toLowerCase();
    const notas=(cells[5].textContent||'').toLowerCase();
    const prioV=(cells[3].textContent||'').trim();
    const estV=(cells[4].textContent||'').trim();
    const ok=(!q||tit.includes(q)||cli.includes(q)||notas.includes(q))&&(!prio||prioV===prio)&&(!est||estV===est);
    tr.style.display=ok?'':'none';
    if(ok)n++;
  });
  const el=document.getElementById('rem-count');
  if(el)el.textContent=(q||prio||est)&&n<tot?`${n} de ${tot} recordatorios`:'';
  toggleClear('rem',q||prio||est);
}
function clearRemFilter(){
  ['rem-q','rem-f-prio','rem-f-est'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  applyRemFilter();
}

function renderRecordatorios(){
  const fil=(document.getElementById('rem-filter')||{}).value||'todos';
  let list=D.recordatorios.slice().sort((a,b)=>(a.fechaHora||'').localeCompare(b.fechaHora||''));
  if(fil!=='todos') list=list.filter(r=>r.estado===fil);
  const tbody=document.getElementById('rem-tbody');
  if(!list.length){
    tbody.innerHTML=`<tr><td colspan="7"><div class="empty">No hay recordatorios para mostrar</div></td></tr>`;
    return;
  }
  const PRIO_B={'Alta':'b-alta','Media':'b-media','Baja':'b-baja'};
  tbody.innerHTML=list.map(r=>{
    const diff=r.fechaHora?daysDiff(r.fechaHora.split('T')[0]):9999;
    const done=r.estado==='Hecho';
    const rowCls=done?'rem-done':(diff<0?'rem-venc':(diff===0?'rem-hoy':''));
    return `<tr class="${rowCls}">
      <td><span class="rem-titulo">${_esc(r.titulo)}</span></td>
      <td style="font-size:12px">${r.clienteId?clientName(r.clienteId)+critBadge(r.clienteId):'<span style="color:var(--t3)">—</span>'}</td>
      <td style="font-size:12px;white-space:nowrap">${fmtDateTime(r.fechaHora)}</td>
      <td><span class="badge ${PRIO_B[r.prioridad]||'b-gray'}">${r.prioridad}</span></td>
      <td><span class="badge ${done?'b-ok':'b-warn'}">${r.estado}</span></td>
      <td style="font-size:12px;color:var(--t2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(r.notas)}">${r.notas?_esc(r.notas):'<span style="color:var(--t3)">—</span>'}</td>
      <td style="white-space:nowrap">
        ${done
          ?`<button class="btn-uncheck" data-id="${_esc(r.id)}" onclick="toggleRemDone(this.dataset.id)" title="Marcar pendiente">↩ Pendiente</button>`
          :`<button class="btn-check" data-id="${_esc(r.id)}" onclick="toggleRemDone(this.dataset.id)" title="Marcar como hecho">✓ Hecho</button>`}
        <button class="btn btn-outline btn-sm" data-id="${_esc(r.id)}" onclick="openRemModal(this.dataset.id)" title="Editar" style="margin-left:4px">✏</button>
        <button class="btn-del" data-id="${_esc(r.id)}" onclick="delRemConfirm(this.dataset.id)" title="Eliminar" style="margin-left:2px">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function openRemModal(id){
  const r=id?D.recordatorios.find(x=>x.id===id):null;
  const cliOpts=`<option value="">— Sin cliente —</option>`+D.clientes.map(c=>`<option value="${c.id}" ${r?.clienteId===c.id?'selected':''}>${_esc(c.nombre)}</option>`).join('');
  document.getElementById('modal-title').textContent=r?'Editar recordatorio':'Nuevo recordatorio';
  document.getElementById('modal-body').innerHTML=`
    <div class="fg"><label class="fl">Título *</label><input class="fc" id="rem-titulo" value="${r?r.titulo.replace(/"/g,'&quot;'):''}" placeholder="Ej: Llamar a cliente, Enviar cotización..."></div>
    <div class="form-row">
      <div class="fg"><label class="fl">Cliente (opcional)</label><select class="fc" id="rem-clienteId">${cliOpts}</select></div>
      <div class="fg"><label class="fl">Fecha y hora *</label><input class="fc" id="rem-fechaHora" type="datetime-local" value="${r?r.fechaHora:''}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Prioridad</label>
        <select class="fc" id="rem-prioridad">
          <option ${r?.prioridad==='Alta'?'selected':''}>Alta</option>
          <option ${(!r||r.prioridad==='Media')?'selected':''}>Media</option>
          <option ${r?.prioridad==='Baja'?'selected':''}>Baja</option>
        </select>
      </div>
      <div class="fg"><label class="fl">Estado</label>
        <select class="fc" id="rem-estado">
          <option ${(!r||r.estado==='Pendiente')?'selected':''}>Pendiente</option>
          <option ${r?.estado==='Hecho'?'selected':''}>Hecho</option>
        </select>
      </div>
    </div>
    <div class="fg"><label class="fl">Notas</label><textarea class="fc" id="rem-notas" rows="3" placeholder="Detalles adicionales...">${r?_esc(r.notas):''}</textarea></div>`;
  document.getElementById('modal-foot').innerHTML=`
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" data-id="${_esc(id||'')}" onclick="saveRem(this.dataset.id)">Guardar</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function saveRem(id){
  const titulo=(document.getElementById('rem-titulo').value||'').trim();
  const fechaHora=document.getElementById('rem-fechaHora').value;
  if(!titulo){toast('⚠ El título es obligatorio.');return;}
  if(!fechaHora){toast('⚠ La fecha y hora son obligatorias.');return;}
  const obj={
    id: id||`REM-${new Date().getFullYear()}-${String(D.recordatorios.length+1).padStart(3,'0')}`,
    titulo,
    clienteId: document.getElementById('rem-clienteId').value||'',
    fechaHora,
    prioridad: document.getElementById('rem-prioridad').value,
    estado: document.getElementById('rem-estado').value,
    notas: document.getElementById('rem-notas').value.trim()
  };
  const i=D.recordatorios.findIndex(x=>x.id===id);
  if(i>-1) D.recordatorios[i]=obj; else D.recordatorios.push(obj);
  persist(); closeModal(); renderRecordatorios();
  toast(`Recordatorio "${titulo}" guardado`);
}

function toggleRemDone(id){
  const r=D.recordatorios.find(x=>x.id===id);
  if(!r) return;
  r.estado=r.estado==='Hecho'?'Pendiente':'Hecho';
  persist(); renderRecordatorios();
  toast(r.estado==='Hecho'?'Recordatorio marcado como hecho':'Recordatorio marcado como pendiente');
}

function delRemConfirm(id){
  const r=D.recordatorios.find(x=>x.id===id);
  confirmDel(r?_esc(r.titulo):_esc(id),()=>{
    D.recordatorios=D.recordatorios.filter(x=>x.id!==id);
    persist(); renderRecordatorios(); toast('Recordatorio eliminado');
  });
}
