/**
 * ============================================================
 * AERCOM CRM v2
 * Pedidos Module
 * Migrado tal cual desde index.html (Sprint 9)
 * ============================================================
 *
 * Responsabilidad: pantalla "Pedidos de Servicio" — listado
 * agrupado por estado (Pendiente/En ejecución/Realizado), alta/
 * edición/eliminación de pedidos, avance de estado, y el modal
 * de carga con vínculo opcional a una cotización Aprobada (se
 * puede generar un pedido desde el kanban de Cotizaciones vía
 * openPedidoModal(null, cotId, null)).
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, curModule, persist(), toast(), toggleClear(), confirmDel(),
 *   closeModal(), clientName(), today(), daysDiff(), fmtDate(),
 *   _esc() (js/utils.js — PR-014.1, hardening XSS)
 *
 * Decisiones de límite de módulo:
 *   - D.cotizaciones/D.clientes/D.equipos se leen para armar los
 *     selects del modal y el badge de cotización asociada, pero
 *     no son dominio de este módulo (no se mutan salvo el cambio
 *     puntual de cot.estado a 'A facturar' al marcar un pedido
 *     como Realizado, ya presente en el original).
 *   - fichaPedidos() sigue en js/modules/clientes.js (Sprint 5),
 *     no se duplica acá.
 *   - El caso 'pedidos' dentro del dispatcher renderModule() y el
 *     conteo de badges del sidebar (updateSidebarBadges()) siguen
 *     en index.html: son funciones centrales compartidas por
 *     todos los módulos, no responsabilidad exclusiva de Pedidos.
 */

// ─── PEDIDOS ─────────────────────────────────────────────────────────────────
function nextPedidoId(){
  if(!D.pedidos.length) return 'PS-001';
  const nums=D.pedidos.map(p=>{const m=(p.id||'').match(/PS-(\d+)/);return m?parseInt(m[1]):0;});
  return `PS-${String(Math.max(...nums)+1).padStart(3,'0')}`;
}

function refreshPedCliOpts(){
  const sel=document.getElementById('ped-f-cli');
  if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Cliente: Todos</option>'+D.clientes.map(c=>`<option value="${c.id}" ${cur===c.id?'selected':''}>${_esc(c.nombre)}</option>`).join('');
}

function renderPedidos(){
  const pend=(D.pedidos||[]).filter(p=>p.estado==='Pendiente').length;
  const ejec=(D.pedidos||[]).filter(p=>p.estado==='En ejecución').length;
  document.getElementById('pedidos-sub').textContent=
    `${(D.pedidos||[]).length} pedidos · ${pend} pendientes · ${ejec} en ejecución`;

  refreshPedCliOpts();
  const q=(document.getElementById('ped-q')||{value:''}).value.trim().toLowerCase();
  const est=(document.getElementById('ped-f-est')||{value:''}).value;
  const cli=(document.getElementById('ped-f-cli')||{value:''}).value;
  const filtered=(D.pedidos||[]).filter(p=>{
    const clN=clientName(p.clienteId).toLowerCase();
    const ok=!q||(p.id||'').toLowerCase().includes(q)||clN.includes(q)||(p.equipoId||'').toLowerCase().includes(q)||(p.tecnico||'').toLowerCase().includes(q)||(p.detalle||'').toLowerCase().includes(q);
    return ok&&(!est||p.estado===est)&&(!cli||p.clienteId===cli);
  });
  const cnt=document.getElementById('ped-count');
  const total=D.pedidos.length;
  if(cnt) cnt.textContent=filtered.length<total?`${filtered.length} de ${total} pedidos`:total===0?'':`${total} pedido${total!==1?'s':''}`;
  toggleClear('ped',q||est||cli);
  const container=document.getElementById('ped-list');
  if(!container) return;
  if(!total){
    container.innerHTML=`<div class="empty">No hay pedidos de servicio. Creá uno desde una cotización aprobada o con el botón "+ Nuevo pedido".</div>`;
    return;
  }
  const BADG={'Pendiente':'b-warn','En ejecución':'b-info','Realizado':'b-ok'};
  function pedRow(p){
    const venc=p.fechaARealizar&&daysDiff(p.fechaARealizar)<0&&p.estado!=='Realizado';
    const canAdv=p.estado!=='Realizado';
    const nextEst=p.estado==='Pendiente'?'En ejecución':'Realizado';
    let cotBadge='';
    if(p.cotizacionId){
      const cot=D.cotizaciones.find(c=>c.id===p.cotizacionId);
      if(cot){
        if(cot.estado==='A facturar') cotBadge=`<div style="margin-top:3px"><span class="badge" style="background:#fef3e2;color:#d9730d;border-radius:var(--r-sm);white-space:nowrap">${_esc(cot.id)} · A facturar</span></div>`;
        else if(cot.estado==='Facturada') cotBadge=`<div style="margin-top:3px"><span class="badge" style="background:var(--ok-bg);color:var(--ok);border-radius:var(--r-sm);white-space:nowrap">${_esc(cot.id)} · Facturada ✓</span></div>`;
        else if(cot.estado==='Ejecutada') cotBadge=`<div style="margin-top:3px"><span class="badge" style="background:var(--ok-bg);color:var(--ok);border-radius:var(--r-sm);white-space:nowrap">${_esc(cot.id)} · Ejecutada</span></div>`;
      }
    }
    return `<tr>
      <td style="font-size:12.5px;font-weight:600">${p.id}</td>
      <td style="font-size:12px">${fmtDate(p.fechaSolicitud)||'—'}</td>
      <td style="font-size:12px;${venc?'color:var(--err);font-weight:600':''}">${fmtDate(p.fechaARealizar)||'—'}</td>
      <td style="font-size:12.5px">${_esc(clientName(p.clienteId))}</td>
      <td style="font-size:12px;color:var(--t2)">${_esc(p.equipoId)||'—'}</td>
      <td style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(p.detalle)}">${p.detalle?_esc(p.detalle.slice(0,55))+(p.detalle.length>55?'…':''):'—'}</td>
      <td style="font-size:12px">${_esc(p.tecnico)||'—'}</td>
      <td><span class="badge ${BADG[p.estado]||'b-gray'}">${p.estado}</span>${cotBadge}</td>
      <td><div style="display:flex;gap:5px">
        <button class="eq-act-btn" data-id="${_esc(p.id)}" onclick="openPedidoModal(this.dataset.id,null,null)" title="Editar">✏</button>
        ${canAdv?`<button class="eq-act-btn" data-id="${_esc(p.id)}" onclick="advancePedido(this.dataset.id)" title="Avanzar a ${nextEst}" style="font-size:13px">→</button>`:''}
        <button class="eq-act-btn eq-act-del" data-id="${_esc(p.id)}" onclick="delPedidoConfirm(this.dataset.id)" title="Eliminar">🗑</button>
      </div></td>
    </tr>`;
  }
  function section(lbl,color,list){
    if(!list.length) return '';
    return `<div class="ped-section">
      <div class="ped-sep" style="color:${color}">${lbl} (${list.length})</div>
      <div class="card" style="padding:0"><div class="tbl-wrap"><table>
        <thead><tr><th>N° Pedido</th><th>Solicitud</th><th>A realizar</th><th>Cliente</th><th>Equipo</th><th>Detalle</th><th>Técnico</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${list.map(pedRow).join('')}</tbody>
      </table></div></div>
    </div>`;
  }
  const pendientes=filtered.filter(p=>p.estado==='Pendiente');
  const enEjec=filtered.filter(p=>p.estado==='En ejecución');
  const realizados=filtered.filter(p=>p.estado==='Realizado');
  let realSection='';
  if(realizados.length){
    realSection=`<div class="ped-section">
      <div class="ped-sep" style="color:var(--ok)">REALIZADOS (${realizados.length})
        <button onclick="togglePedRealizados()" id="btn-ped-real" style="background:none;border:none;color:var(--info);font-size:11px;cursor:pointer;margin-left:8px;font-family:inherit;padding:0">Ver realizados</button>
      </div>
      <div id="ped-real-body" style="display:none">
        <div class="card" style="padding:0"><div class="tbl-wrap"><table>
          <thead><tr><th>N° Pedido</th><th>Solicitud</th><th>A realizar</th><th>Cliente</th><th>Equipo</th><th>Detalle</th><th>Técnico</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>${realizados.map(pedRow).join('')}</tbody>
        </table></div></div>
      </div>
    </div>`;
  }
  const html=section('PENDIENTES','var(--warn)',pendientes)+section('EN EJECUCIÓN','var(--info)',enEjec)+realSection;
  container.innerHTML=html||`<div class="empty">Sin pedidos que coincidan con los filtros.</div>`;
}

function togglePedRealizados(){
  const body=document.getElementById('ped-real-body');
  const btn=document.getElementById('btn-ped-real');
  if(!body||!btn) return;
  const shown=body.style.display!=='none';
  body.style.display=shown?'none':'block';
  btn.textContent=shown?'Ver realizados':'Ocultar realizados';
}

function applyPedidosFilter(){renderPedidos();}
function clearPedidosFilter(){
  ['ped-q','ped-f-est','ped-f-cli'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderPedidos();
}

function openPedidoModal(pid, cotId, preCliId){
  const p=pid?(D.pedidos||[]).find(x=>x.id===pid):null;
  const newId=nextPedidoId();
  const prefCot=cotId||(p?.cotizacionId||'');
  const cot=prefCot?D.cotizaciones.find(c=>c.id===prefCot):null;
  const prefCli=preCliId||(cot?.clienteId||p?.clienteId||'');
  const prefEquip=cot?.equipoId||p?.equipoId||'';
  const prefDet=cot?.descripcion||p?.detalle||'';
  const cotOpts=D.cotizaciones.filter(c=>c.estado==='Aprobada').map(c=>`<option value="${c.id}" ${prefCot===c.id?'selected':''}>${_esc(c.id)} — ${_esc(clientName(c.clienteId))}</option>`).join('');
  const cliOpts=D.clientes.map(c=>`<option value="${c.id}" ${prefCli===c.id?'selected':''}>${_esc(c.nombre)}</option>`).join('');
  const equipList=D.equipos.filter(e=>!prefCli||e.clienteId===prefCli);
  const equipOpts=equipList.map(e=>`<option value="${e.id}" ${prefEquip===e.id?'selected':''}>${_esc(e.id)} — ${e.tipo}</option>`).join('');
  const estadoOpts=['Pendiente','En ejecución','Realizado'].map(s=>`<option value="${s}" ${(p?.estado||'Pendiente')===s?'selected':''}>${s}</option>`).join('');
  const isReal=(p?.estado||'Pendiente')==='Realizado';
  document.getElementById('modal-title').textContent=p?`Editar Pedido — ${pid}`:`Nuevo Pedido — ${newId}`;
  document.getElementById('modal-body').innerHTML=`
    <div class="form-row">
      <div class="fg"><label class="fl">N° Pedido</label><input class="fc" value="${p?p.id:newId}" readonly style="color:var(--t3)"></div>
      <div class="fg"><label class="fl">Estado</label><select class="fc" id="ped-m-est" onchange="onPedEstChange()">${estadoOpts}</select></div>
    </div>
    <div class="fg"><label class="fl">Cotización asociada (solo Aprobadas)</label>
      <select class="fc" id="ped-m-cot" onchange="onPedCotChange()">
        <option value="">— Sin cotización —</option>${cotOpts}
      </select>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Cliente</label><select class="fc" id="ped-m-cli" onchange="onPedCliChange()">${cliOpts?`<option value="">— Seleccionar —</option>`+cliOpts:'<option value="">— Seleccionar —</option>'}</select></div>
      <div class="fg"><label class="fl">Equipo</label><select class="fc" id="ped-m-equip"><option value="">— Sin equipo —</option>${equipOpts}</select></div>
    </div>
    <div class="fg"><label class="fl">Detalle del servicio</label><textarea class="fc" id="ped-m-det" rows="3">${_esc(prefDet)}</textarea></div>
    <div class="form-row">
      <div class="fg"><label class="fl">Fecha de solicitud</label><input class="fc" type="date" id="ped-m-fsol" value="${p?.fechaSolicitud||today()}"></div>
      <div class="fg"><label class="fl">Fecha a realizar</label><input class="fc" type="date" id="ped-m-freal" value="${p?.fechaARealizar||''}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Técnico asignado</label><input class="fc" id="ped-m-tec" value="${_esc(p?.tecnico)}"></div>
      <div class="fg"></div>
    </div>
    <div class="fg"><label class="fl">Observaciones</label><textarea class="fc" id="ped-m-obs" rows="2">${_esc(p?.observaciones)}</textarea></div>
    <div id="ped-m-real-fields" style="${isReal?'':'display:none'}">
      <div class="fg" style="margin-top:10px"><label class="fl">Fecha de realización</label><input class="fc" type="date" id="ped-m-frealizado" value="${p?.fechaRealizado||today()}"></div>
    </div>`;
  document.getElementById('modal-foot').innerHTML=`
    ${p?`<button class="btn" style="background:#fef2f2;color:var(--err);border:1px solid #fecaca" data-id="${_esc(pid)}" onclick="delPedidoConfirm(this.dataset.id)">Eliminar</button>`:''}
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" data-id="${_esc(p?p.id:'')}" data-newid="${_esc(newId)}" onclick="savePedido(this.dataset.id,this.dataset.newid)">Guardar pedido</button>`;
  document.getElementById('modal-overlay').classList.add('open');
  if(cotId||preCliId) setTimeout(()=>{const f=document.getElementById('ped-m-freal');if(f)f.focus();},120);
}

function onPedCotChange(){
  const cotId=(document.getElementById('ped-m-cot')||{}).value;
  if(!cotId) return;
  const cot=D.cotizaciones.find(c=>c.id===cotId);
  if(!cot) return;
  const cli=document.getElementById('ped-m-cli');
  if(cli) cli.value=cot.clienteId||'';
  onPedCliChange();
  setTimeout(()=>{
    const eq=document.getElementById('ped-m-equip');
    if(eq&&cot.equipoId) eq.value=cot.equipoId;
    const det=document.getElementById('ped-m-det');
    if(det&&cot.descripcion) det.value=cot.descripcion;
  },50);
}

function onPedCliChange(){
  const cli=(document.getElementById('ped-m-cli')||{}).value;
  const eq=document.getElementById('ped-m-equip');
  if(!eq) return;
  const cur=eq.value;
  const list=D.equipos.filter(e=>!cli||e.clienteId===cli);
  eq.innerHTML='<option value="">— Sin equipo —</option>'+list.map(e=>`<option value="${e.id}" ${cur===e.id?'selected':''}>${_esc(e.id)} — ${e.tipo}</option>`).join('');
}

function onPedEstChange(){
  const est=(document.getElementById('ped-m-est')||{}).value;
  const f=document.getElementById('ped-m-real-fields');
  if(f) f.style.display=est==='Realizado'?'':'none';
}

function savePedido(pid, newId){
  const cli=(document.getElementById('ped-m-cli')||{}).value;
  if(!cli){toast('⚠ Seleccioná un cliente.');return;}
  const estado=(document.getElementById('ped-m-est')||{}).value||'Pendiente';
  const obj={
    id:pid||newId,
    cotizacionId:(document.getElementById('ped-m-cot')||{}).value||'',
    clienteId:cli,
    equipoId:(document.getElementById('ped-m-equip')||{}).value||'',
    detalle:((document.getElementById('ped-m-det')||{}).value||'').trim(),
    fechaSolicitud:(document.getElementById('ped-m-fsol')||{}).value||today(),
    fechaARealizar:(document.getElementById('ped-m-freal')||{}).value||'',
    fechaRealizado:estado==='Realizado'?((document.getElementById('ped-m-frealizado')||{}).value||today()):'',
    tecnico:((document.getElementById('ped-m-tec')||{}).value||'').trim(),
    observaciones:((document.getElementById('ped-m-obs')||{}).value||'').trim(),
    estado
  };
  if(pid){
    const idx=D.pedidos.findIndex(x=>x.id===pid);
    if(idx!==-1) D.pedidos[idx]=obj; else D.pedidos.push(obj);
  } else {
    D.pedidos.push(obj);
  }
  if(estado==='Realizado'&&obj.cotizacionId){
    const cot=D.cotizaciones.find(c=>c.id===obj.cotizacionId);
    if(cot&&!['A facturar','Facturada','Ejecutada'].includes(cot.estado)){cot.estado='A facturar';toast(`Servicio realizado — ${cot.id} lista para facturar`);}
  }
  persist();
  closeModal();
  if(curModule==='pedidos') renderPedidos();
  else toast(`Pedido ${obj.id} guardado`);
}

function delPedidoConfirm(id){
  confirmDel(`Pedido ${id}`, ()=>{
    D.pedidos=D.pedidos.filter(p=>p.id!==id);
    persist();
    closeModal();
    if(curModule==='pedidos') renderPedidos();
    toast(`Pedido ${id} eliminado`);
  });
}

function advancePedido(id){
  const p=(D.pedidos||[]).find(x=>x.id===id);
  if(!p||p.estado==='Realizado') return;
  const next=p.estado==='Pendiente'?'En ejecución':'Realizado';
  p.estado=next;
  if(next==='Realizado'){
    p.fechaRealizado=today();
    if(p.cotizacionId){
      const cot=D.cotizaciones.find(c=>c.id===p.cotizacionId);
      if(cot&&!['A facturar','Facturada','Ejecutada'].includes(cot.estado)){cot.estado='A facturar';toast(`Servicio realizado — ${cot.id} lista para facturar`);}
      else toast(`Pedido ${id} marcado como Realizado`);
    } else toast(`Pedido ${id} marcado como Realizado`);
  } else toast(`Pedido ${id} → ${next}`);
  persist();
  renderPedidos();
}

// fichaPedidos() migrada a js/modules/clientes.js (Sprint 5)
