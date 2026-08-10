/**
 * ============================================================
 * AERCOM CRM v2
 * Excel Module
 * Migrado tal cual desde index.html (Sprint 14)
 * ============================================================
 *
 * Responsabilidad: importación/exportación de datos vía XLSX
 * (SheetJS, cargado por CDN en index.html) — descarga de
 * plantillas prellenadas (Clientes/Equipos/Cotizaciones) con
 * hojas de instrucciones y referencia, importación con matching
 * por ID/nombre y merge no destructivo, exportación de reportes
 * (Clientes/Equipos/Cotizaciones/Facturación) a descarga local o
 * a Google Drive, y el contador de registros de la pantalla
 * "Excel / Drive".
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   XLSX (CDN SheetJS), D, curMonth, today(), clientName(),
 *   toast(), persist(), renderModule() (index.html)
 *
 * Decisiones de límite de módulo:
 *   - `xlsExport(tipo,'drive')` depende de `_gdriveReady`,
 *     `_gdriveUploadFile()` y `_folderReportId` — todas viven en
 *     la integración de Google Drive (index.html) y no se migran
 *     acá; Excel solo las invoca cuando el destino es Drive.
 *   - `generarReporteVencimientos()` y `_LOGO_RPT` NO son parte de
 *     este módulo: son del Reporte PDF, ya migrados a
 *     js/modules/reportes.js (Sprint 13).
 */

// ─── EXCEL: PLANTILLAS ────────────────────────────────────────────────────────
const XLS_HEADERS = {
  clientes:     ['ID','Nombre','Tipo','Ciudad','Contacto','Telefono','Email','Frecuencia Visita','Presupuesto Mensual','Ajuste','Requiere OC','Requiere HES','Facturacion','Facturacion Dia','Estado','Incluye NS','Incluye Preventivo','Incluye Combustible','Incluye Plataforma','Incluye Bateria','Incluye Otro'],
  equipos:      ['ID','Cliente ID','Cliente (nombre)','Tipo','Marca','Ubicacion','Ultimo Preventivo','Proximo Preventivo','Ultimo Aceite','Ultima Bateria','Ultimo Refrigerante','Horometro','Observaciones'],
  cotizaciones: ['ID','Cliente (nombre)','Descripcion','Monto','Fecha Envio','Fecha Followup','Responsable','Estado','Notas'],
  facturacion:  ['Cliente','Tipo','Ajuste','Requiere OC','Requiere HES','Facturacion','Estado Mes']
};

function xlsDownloadPlantilla(tipo){
  const wb = XLSX.utils.book_new();
  const hoy = today();

  if(tipo==='clientes'){
    const rows = D.clientes.map(c=>[
      c.id, c.nombre, c.tipo||'', c.ciudad||'', c.contacto||'',
      c.telefono||'', c.email||'', c.frecuenciaVisita||'',
      c.presupuesto||0, c.ajuste||'IPC',
      c.requiereOC?'SI':'NO', c.requiereHES?'SI':'NO',
      c.facturacion||'Manual', c.facturacionDia||'', c.estadoCliente||'Activo',
      c.incluyeNS?'SI':'NO', c.incluyePreventivo?'SI':'NO',
      c.incluyeCombustible?'SI':'NO', c.incluyePlataforma?'SI':'NO',
      c.incluyeBateria?'SI':'NO', c.incluyeOtro||''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([XLS_HEADERS.clientes, ...rows]);
    ws['!cols'] = XLS_HEADERS.clientes.map(()=>({wch:22}));
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    const wi = XLSX.utils.aoa_to_sheet([
      ['INSTRUCCIONES'],[''],
      ['• El campo ID puede dejarse en blanco — la app lo genera automáticamente'],
      ['• Tipos válidos: Sanatorio/Clínica · Industria · Comercio · Edificio · Otro'],
      ['• Ajuste: IPC · Dólar divisa · Dólar billete · Fijo pesos'],
      ['• Requiere OC / HES: escribir SI o NO'],[''],
      [`Exportado el: ${hoy} · ${D.clientes.length} clientes`]
    ]);
    XLSX.utils.book_append_sheet(wb, wi, 'Instrucciones');
    XLSX.writeFile(wb, `clientes-aercom-${hoy}.xlsx`);
    toast(`✓ ${D.clientes.length} clientes exportados`);

  } else if(tipo==='equipos'){
    const rows = D.equipos.map(e=>[
      e.id, e.clienteId, clientName(e.clienteId),
      e.tipo||'', e.marca||'', e.ubicacion||'',
      e.ultimoPreventivo||'', e.proximoPreventivo||'',
      e.ultimoAceite||'', e.ultimoBateria||'',
      e.ultimoRefrigerante||'', e.horometro||0, e.observaciones||''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([XLS_HEADERS.equipos, ...rows]);
    ws['!cols'] = XLS_HEADERS.equipos.map(()=>({wch:22}));
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
    const wref = XLSX.utils.aoa_to_sheet([
      ['REFERENCIA DE CLIENTES'],['Cliente ID', 'Nombre', 'Tipo'],
      ...D.clientes.map(c=>[c.id, c.nombre, c.tipo||''])
    ]);
    wref['!cols'] = [{wch:14},{wch:40},{wch:20}];
    XLSX.utils.book_append_sheet(wb, wref, 'IDs de Clientes');
    const wi = XLSX.utils.aoa_to_sheet([
      ['INSTRUCCIONES'],[''],
      ['• Usá la hoja "IDs de Clientes" para copiar el Cliente ID correcto'],
      ['• El ID del equipo identifica el registro — no lo cambies si ya existe'],
      ['• Preventivo: +1 año · Batería y Refrigerante: +2 años'],[''],
      [`Exportado el: ${hoy} · ${D.equipos.length} equipos`]
    ]);
    XLSX.utils.book_append_sheet(wb, wi, 'Instrucciones');
    XLSX.writeFile(wb, `equipos-aercom-${hoy}.xlsx`);
    toast(`✓ ${D.equipos.length} equipos exportados`);

  } else if(tipo==='cotizaciones'){
    const rows = D.cotizaciones.map(c=>[
      c.id, c.clienteId, clientName(c.clienteId),
      c.descripcion||'', c.monto||0,
      c.fechaEnvio||'', c.fechaFollowup||'',
      c.responsable||'', c.estado||'Solicitud', c.notas||''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([XLS_HEADERS.cotizaciones, ...rows]);
    ws['!cols'] = XLS_HEADERS.cotizaciones.map(()=>({wch:22}));
    XLSX.utils.book_append_sheet(wb, ws, 'Cotizaciones');
    XLSX.writeFile(wb, `cotizaciones-aercom-${hoy}.xlsx`);
    toast(`✓ ${D.cotizaciones.length} cotizaciones exportadas`);
  }
}

function xlsImport(ev, tipo){
  const f=ev.target.files[0]; if(!f) return;
  // Confirmar si ya hay datos cargados
  const existentes = tipo==='clientes'?D.clientes.length : tipo==='equipos'?D.equipos.length : D.cotizaciones.length;
  if(existentes>0 && !confirm(`Ya tenés ${existentes} ${tipo} cargados.\n\nLa importación AGREGA nuevos y ACTUALIZA los que coincidan por ID.\nNo borra nada.\n\n¿Continuar?`)){
    ev.target.value=''; return;
  }
  const r=new FileReader();
  r.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'binary'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if(!rows.length){toast('⚠ El archivo está vacío');return;}
      let importados=0;
      if(tipo==='clientes'){
        // Helper: convierte SI/true/1 → true
        function _bool(v){ return v==='SI'||v===true||v==='1'||v===1; }
        // Helper: genera ID secuencial si está vacío
        function _nextCliId(){
          const nums=D.clientes.map(c=>parseInt((c.id||'').replace(/\D/g,''))||0);
          return 'C'+String((nums.length?Math.max(...nums):0)+1).padStart(3,'0');
        }
        rows.forEach(r=>{
          if(!r['Nombre']) return;
          // Buscar existente por ID primero, luego por nombre
          const idXls = String(r['ID']||'').trim();
          let existe = idXls ? D.clientes.find(c=>c.id===idXls) : null;
          if(!existe) existe = D.clientes.find(c=>c.nombre===r['Nombre']);
          const obj={
            id:                 existe ? existe.id : (idXls||_nextCliId()),
            nombre:             r['Nombre']||'',
            tipo:               r['Tipo']||existe?.tipo||'Otro',
            ciudad:             r['Ciudad']||existe?.ciudad||'',
            contacto:           r['Contacto']||existe?.contacto||'',
            telefono:           r['Telefono']||existe?.telefono||'',
            email:              r['Email']||existe?.email||'',
            frecuenciaVisita:   r['Frecuencia Visita']||existe?.frecuenciaVisita||'Mensual',
            presupuesto:        r['Presupuesto Mensual']!==undefined&&r['Presupuesto Mensual']!==''
                                  ? Number(r['Presupuesto Mensual'])||0
                                  : existe?.presupuesto||0,
            ajuste:             r['Ajuste']||existe?.ajuste||'IPC',
            requiereOC:         r['Requiere OC']!==undefined ? _bool(r['Requiere OC']) : existe?.requiereOC||false,
            requiereHES:        r['Requiere HES']!==undefined ? _bool(r['Requiere HES']) : existe?.requiereHES||false,
            facturacion:        r['Facturacion']||existe?.facturacion||'Manual',
            facturacionDia:     r['Facturacion Dia']?parseInt(r['Facturacion Dia'])||null : existe?.facturacionDia||null,
            estadoCliente:      r['Estado']||existe?.estadoCliente||'Activo',
            prioridad:          r['Prioridad']||existe?.prioridad||'Normal',
            // Incluidos en abono
            incluyeNS:          r['Incluye NS']!==undefined ? _bool(r['Incluye NS']) : existe?.incluyeNS||false,
            incluyePreventivo:  r['Incluye Preventivo']!==undefined ? _bool(r['Incluye Preventivo']) : existe?.incluyePreventivo||false,
            incluyeCombustible: r['Incluye Combustible']!==undefined ? _bool(r['Incluye Combustible']) : existe?.incluyeCombustible||false,
            incluyePlataforma:  r['Incluye Plataforma']!==undefined ? _bool(r['Incluye Plataforma']) : existe?.incluyePlataforma||false,
            incluyeBateria:     r['Incluye Bateria']!==undefined ? _bool(r['Incluye Bateria']) : existe?.incluyeBateria||false,
            incluyeOtro:        r['Incluye Otro']||existe?.incluyeOtro||'',
            // Preservar datos de facturación detallada que no están en el Excel
            tipoAbono:          existe?.tipoAbono||'Abono',
            codigoServicio:     existe?.codigoServicio||'',
            descripcionServicio:existe?.descripcionServicio||'',
            precioAbono:        existe?.precioAbono||null,
            monedaAbono:        existe?.monedaAbono||'Pesos',
            cantidadAbono:      existe?.cantidadAbono||1,
            mesesFacturacion:   existe?.mesesFacturacion||[],
          };
          if(existe){ const i=D.clientes.indexOf(existe); D.clientes[i]=obj; }
          else D.clientes.push(obj);
          importados++;
        });
      } else if(tipo==='equipos'){
        const TIPO_MAP={
          'GRUPO ELECTROGENO':'Grupo Electrógeno','GRUPO ELECTRÓGENO':'Grupo Electrógeno',
          'ELECTROCOMPRESOR':'Electrocompresor','MOTOCOMPRESOR':'Motocompresor',
          'MOTOBOMBA':'Motobomba','SECADORA DE AIRE':'Secadora de Aire','SECADORA':'Secadora de Aire',
          'TABLERO ELECTRICO':'Tablero Electrico'
        };
        function _normStr(s){ return (s||'').toUpperCase().replace(/[ÁÀÂÄ]/g,'A').replace(/[ÉÈÊË]/g,'E').replace(/[ÍÌÎÏ]/g,'I').replace(/[ÓÒÔÖ]/g,'O').replace(/[ÚÙÛÜ]/g,'U').replace(/\s+/g,' ').trim(); }
        function _findCliente(row){
          const byId = row['Cliente ID'] ? D.clientes.find(c=>c.id===String(row['Cliente ID']).trim()) : null;
          if(byId) return byId;
          const nombre = (row['Cliente (nombre)']||'').trim();
          if(!nombre) return null;
          const byName = D.clientes.find(c=>c.nombre===nombre);
          if(byName) return byName;
          const normNombre = _normStr(nombre);
          const byFuzzy = D.clientes.find(c=>_normStr(c.nombre)===normNombre);
          if(byFuzzy) return byFuzzy;
          const byPartial = D.clientes.find(c=>{
            const cn=_normStr(c.nombre), rn=_normStr(nombre);
            return cn.includes(rn)||rn.includes(cn);
          });
          return byPartial||null;
        }
        let sinMatch=[];
        rows.forEach(r=>{
          const cli=_findCliente(r);
          if(!cli){ sinMatch.push(r['Cliente (nombre)']||r['Cliente ID']||'?'); return; }
          const existe=D.equipos&&D.equipos.find(e=>e.id===String(r['ID']||'').trim());
          const tipoRaw=(r['Tipo']||'').trim();
          const tipo=TIPO_MAP[tipoRaw.toUpperCase()]||tipoRaw||'Grupo Electrógeno';
          const obj={
            id: existe?existe.id:(String(r['ID']||'').trim()||'EQ'+String(Date.now()).slice(-6)),
            clienteId: cli.id, tipo,
            marca: r['Marca']||existe?.marca||'',
            ubicacion: r['Ubicacion']||existe?.ubicacion||'',
            ultimoPreventivo: _xlsDate(r['Ultimo Preventivo'])||existe?.ultimoPreventivo||'',
            proximoPreventivo: _xlsDate(r['Proximo Preventivo'])||existe?.proximoPreventivo||'',
            ultimoAceite: _xlsDate(r['Ultimo Aceite'])||existe?.ultimoAceite||'',
            ultimoBateria: _xlsDate(r['Ultima Bateria'])||existe?.ultimoBateria||'',
            ultimoRefrigerante: _xlsDate(r['Ultimo Refrigerante'])||existe?.ultimoRefrigerante||'',
            horometro: Number(r['Horometro'])||existe?.horometro||0,
            observaciones: r['Observaciones']||existe?.observaciones||'',
            ultimaVisita: existe?.ultimaVisita||'', proximaVisita: existe?.proximaVisita||''
          };
          if(!D.equipos) D.equipos=[];
          if(existe){ const i=D.equipos.indexOf(existe); D.equipos[i]=obj; }
          else D.equipos.push(obj);
          importados++;
        });
        if(sinMatch.length) toast(`⚠ ${sinMatch.length} equipos sin cliente: ${sinMatch.slice(0,3).join(', ')}${sinMatch.length>3?'...':''}`);
      } else if(tipo==='cotizaciones'){
        rows.forEach(r=>{
          if(!r['Cliente (nombre)']) return;
          const cli=D.clientes.find(c=>c.nombre===r['Cliente (nombre)']);
          if(!cli) return;
          const existe=D.cotizaciones&&D.cotizaciones.find(c=>c.id===r['ID']);
          const obj={
            id: existe?existe.id:(r['ID']||'COT-'+String(Date.now()).slice(-6)),
            clienteId: cli.id,
            descripcion: r['Descripcion']||'',
            monto: Number(r['Monto'])||0,
            fechaEnvio: _xlsDate(r['Fecha Envio']),
            fechaFollowup: _xlsDate(r['Fecha Followup']),
            responsable: r['Responsable']||'',
            estado: r['Estado']||'Solicitud',
            notas: r['Notas']||''
          };
          if(!D.cotizaciones) D.cotizaciones=[];
          if(existe) Object.assign(existe,obj);
          else D.cotizaciones.push(obj);
          importados++;
        });
      }
      persist();
      renderModule();
      updateExcelCounts();
      toast(`✓ ${importados} registros importados correctamente`);
    }catch(err){console.error(err);toast('⚠ Error al importar: '+err.message);}
    ev.target.value='';
  };
  r.readAsBinaryString(f);
}

function _xlsDate(v){
  if(!v) return '';
  if(typeof v==='number') return new Date(Math.round((v-25569)*86400000)).toISOString().split('T')[0];
  const s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){const[d,m,y]=s.split('/');return `${y}-${m}-${d}`;}
  return '';
}

// ─── EXCEL: EXPORTAR ─────────────────────────────────────────────────────────
async function xlsExport(tipo, destino){
  if(destino==='drive'&&!_gdriveReady){toast('⚠ Conectate a Drive primero');return;}
  const fecha=today();
  const nombre=`reporte-${tipo}-${fecha}.xlsx`;
  const wb=XLSX.utils.book_new();
  let ws;

  if(tipo==='clientes'){
    const rows=D.clientes.map(c=>[c.id,c.nombre,c.tipo,c.ciudad,c.contacto,c.telefono,c.email,
      c.frecuenciaVisita,c.presupuesto,c.ajuste,c.requiereOC?'SI':'NO',c.requiereHES?'SI':'NO',c.facturacion,c.estadoCliente]);
    ws=XLSX.utils.aoa_to_sheet([XLS_HEADERS.clientes,...rows]);
  } else if(tipo==='equipos'){
    const rows=(D.equipos||[]).map(e=>[
      e.id, e.clienteId, clientName(e.clienteId), e.tipo, e.marca||'', e.ubicacion||'',
      e.ultimoPreventivo, e.proximoPreventivo, e.ultimoAceite,
      e.ultimoBateria, e.ultimoRefrigerante, e.horometro, e.observaciones
    ]);
    ws=XLSX.utils.aoa_to_sheet([XLS_HEADERS.equipos,...rows]);
  } else if(tipo==='cotizaciones'){
    const rows=(D.cotizaciones||[]).map(c=>[c.id,clientName(c.clienteId),c.descripcion,
      c.monto,c.fechaEnvio,c.fechaFollowup,c.responsable,c.estado,c.notas]);
    ws=XLSX.utils.aoa_to_sheet([XLS_HEADERS.cotizaciones,...rows]);
  } else if(tipo==='facturacion'){
    const mes=curMonth;
    const estados=D.facturacion_estados[mes]||{};
    const rows=D.clientes.filter(c=>c.estadoCliente==='Activo').map(c=>[
      c.nombre,c.tipo,c.ajuste,c.requiereOC?'SI':'NO',c.requiereHES?'SI':'NO',
      c.facturacion,estados[c.id]||'Pendiente']);
    ws=XLSX.utils.aoa_to_sheet([XLS_HEADERS.facturacion,...rows]);
  }

  ws['!cols']=XLS_HEADERS[tipo].map(()=>({wch:22}));
  XLSX.utils.book_append_sheet(wb,ws,'Reporte');

  if(destino==='download'){
    XLSX.writeFile(wb,nombre);
    toast(`✓ ${nombre} descargado`);
  } else {
    // Subir a Drive
    const xlsData=XLSX.write(wb,{bookType:'xlsx',type:'array'});
    const blob=new Blob([xlsData],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    toast('Subiendo a Drive...');
    const ok=await _gdriveUploadFile(nombre,blob,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',_folderReportId);
    if(ok) toast(`✓ ${nombre} guardado en Drive/Aercom Gestion/Reportes/`);
    else toast('⚠ No se pudo subir a Drive');
  }
}

// ─── EXCEL COUNTS ────────────────────────────────────────────────────────────
function updateExcelCounts(){
  const ec=document.getElementById('excel-count-clientes');
  const ee=document.getElementById('excel-count-equipos');
  const eq=document.getElementById('excel-count-cotizaciones');
  if(ec) ec.textContent=(D.clientes.length||0)+' registros';
  if(ee) ee.textContent=(D.equipos.length||0)+' registros';
  if(eq) eq.textContent=(D.cotizaciones.length||0)+' registros';
}
