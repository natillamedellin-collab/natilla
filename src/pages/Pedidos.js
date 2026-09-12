import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { RefreshCw, Download, Search, X, Edit2, Save, Trash2, Printer, FileText, Receipt, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { imprimirOrdenes, imprimirComandas, imprimirCotizaciones, imprimirCuentasCobro } from '../lib/pdf';

const fmt = n => n ? `$${Number(n).toLocaleString('es-CO')}` : '-';
const fmtDate = d => d ? new Date(d+'T12:00').toLocaleDateString('es-CO') : '-';
const ESTADOS = ['Recibido','En producción','Despachado','Entregado','Cancelado'];
const ESTADO_BADGE = { 'Recibido':'badge-gray','En producción':'badge-amber','Despachado':'badge-blue','Entregado':'badge-green','Cancelado':'badge-red' };

// Hora SIEMPRE en formato AM/PM — nunca militar/24h, en ningún lugar de la app
function fmtHora12(t) {
  if (!t) return '-';
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'p.m.' : 'a.m.';
  let h12 = hh % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [items, setItems] = useState({});
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(new Set());
  const { toast, ToastContainer } = useToast();

  // Modal de edición
  const [modalPedido, setModalPedido] = useState(null);
  const [editData, setEditData] = useState({});
  const [editItems, setEditItems] = useState([]);
  const [nuevoProductoId, setNuevoProductoId] = useState('');
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState('');
  const [ordenHora, setOrdenHora] = useState(null); // null | 'asc' | 'desc'
  const [fFechaReg, setFechaReg] = useState('');
  const [fFechaEntDesde, setFechaEntDesde] = useState('');
  const [fFechaEntHasta, setFechaEntHasta] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fDom, setFDom] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: peds }, { data: doms }, { data: cfg }, { data: prods }] = await Promise.all([
      supabase.from('pedidos').select('*, domiciliarios(nombre)').order('consecutivo', { ascending: false }),
      supabase.from('domiciliarios').select('*').eq('activo', true).order('nombre'),
      supabase.from('configuracion').select('*').limit(1).single(),
      supabase.from('productos').select('*').eq('activo', true).order('orden'),
    ]);
    setPedidos(peds || []);
    setDomiciliarios(doms || []);
    setConfig(cfg || {});
    setProductos(prods || []);
    if (peds?.length) {
      const ids = peds.map(p => p.id);
      const { data: it } = await supabase.from('pedido_items').select('*').in('pedido_id', ids);
      const map = {};
      (it||[]).forEach(i => { if (!map[i.pedido_id]) map[i.pedido_id] = []; map[i.pedido_id].push(i); });
      setItems(map);
    } else {
      setItems({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Sin filtros = TODOS los pedidos. Los filtros solo restringen cuando se usan.
  const filtered = pedidos.filter(p => {
    const sq = q.toLowerCase();
    if (sq &&
        !p.nombre_empresa?.toLowerCase().includes(sq) &&
        !p.nombre_contacto?.toLowerCase().includes(sq) &&
        !String(p.consecutivo).includes(sq) &&
        !p.telefono?.includes(sq)) return false;
    if (fFechaReg && !p.fecha_registro?.startsWith(fFechaReg)) return false;
    if (fFechaEntDesde && (!p.fecha_entrega || p.fecha_entrega < fFechaEntDesde)) return false;
    if (fFechaEntHasta && (!p.fecha_entrega || p.fecha_entrega > fFechaEntHasta)) return false;
    if (fEstado && p.estado !== fEstado) return false;
    if (fDom && p.domiciliario_id !== fDom) return false;
    return true;
  }).sort((a, b) => {
    if (!ordenHora) return 0;
    const ha = a.hora_entrega || '';
    const hb = b.hora_entrega || '';
    if (ordenHora === 'asc') return ha.localeCompare(hb);
    return hb.localeCompare(ha);
  });

  const totalConDomicilio = p => (items[p.id]||[]).reduce((s,i)=>s+(i.subtotal||0),0);
  const totalVentas = filtered.reduce((s, p) => s + totalConDomicilio(p), 0);

  const selPedidos = filtered.filter(p => sel.has(p.id));
  const toggleSel = id => setSel(s => { const ns=new Set(s); ns.has(id)?ns.delete(id):ns.add(id); return ns; });
  const toggleAll = () => sel.size===filtered.length ? setSel(new Set()) : setSel(new Set(filtered.map(p=>p.id)));

  // ── Modal de edición ──────────────────────────────────────────────────
  const abrirEdicion = p => {
    setModalPedido(p);
    setEditData({ ...p });
    setEditItems((items[p.id]||[]).map(i=>({...i})));
    setNuevoProductoId('');
  };
  const cerrarModal = () => { setModalPedido(null); setEditData({}); setEditItems([]); };

  const agregarProductoAlPedido = () => {
    if (!nuevoProductoId) return;
    const prod = productos.find(pr => pr.id === nuevoProductoId);
    if (!prod) return;
    setEditItems(ei => [...ei, {
      id: `nuevo-${Date.now()}`, isNew: true, producto_id: prod.id,
      nombre_producto: prod.nombre, imagen_url: prod.imagen_url || null,
      cantidad: 1, precio_unitario: parseFloat(prod.precio)||0, subtotal: parseFloat(prod.precio)||0,
    }]);
    setNuevoProductoId('');
  };

  const quitarItem = (idx) => setEditItems(ei => ei.filter((_,i)=>i!==idx));

  const actualizarItem = (idx, campo, valor) => {
    setEditItems(ei => ei.map((it,i) => {
      if (i !== idx) return it;
      const actualizado = { ...it, [campo]: valor };
      actualizado.subtotal = (parseFloat(actualizado.cantidad)||0) * (parseFloat(actualizado.precio_unitario)||0);
      return actualizado;
    }));
  };

  const guardarEdicion = async () => {
    setSaving(true);
    const { error } = await supabase.from('pedidos').update({
      nombre_empresa: editData.nombre_empresa,
      nombre_contacto: editData.nombre_contacto,
      telefono: editData.telefono,
      direccion: editData.direccion,
      fecha_entrega: editData.fecha_entrega,
      hora_entrega: editData.hora_entrega,
      estado: editData.estado,
      domiciliario_id: editData.domiciliario_id || null,
      observaciones: editData.observaciones,
    }).eq('id', modalPedido.id);
    if (error) { toast('Error: ' + error.message, 'error'); setSaving(false); return; }

    // Items existentes: actualizar. Items nuevos: insertar. Items removidos: ya no están en editItems -> borrar los que faltan.
    const originalIds = (items[modalPedido.id]||[]).map(i=>i.id);
    const editIdsExistentes = editItems.filter(i=>!i.isNew).map(i=>i.id);
    const idsABorrar = originalIds.filter(id => !editIdsExistentes.includes(id));
    if (idsABorrar.length) await supabase.from('pedido_items').delete().in('id', idsABorrar);

    for (const item of editItems) {
      if (item.isNew) {
        await supabase.from('pedido_items').insert([{
          pedido_id: modalPedido.id, producto_id: item.producto_id, nombre_producto: item.nombre_producto,
          imagen_url: item.imagen_url, cantidad: item.cantidad, precio_unitario: item.precio_unitario, subtotal: item.subtotal,
        }]);
      } else {
        await supabase.from('pedido_items').update({
          cantidad: item.cantidad, precio_unitario: item.precio_unitario, subtotal: item.subtotal,
        }).eq('id', item.id);
      }
    }
    toast('✅ Pedido actualizado');
    setSaving(false);
    cerrarModal();
    fetchAll();
  };

  const eliminarPedido = async (id, consecutivo) => {
    if (!window.confirm(`¿Estás seguro de eliminar el pedido #${String(consecutivo).padStart(4,'0')}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('pedidos').delete().eq('id', id);
    if (error) { toast('Error al eliminar: ' + error.message, 'error'); return; }
    toast('🗑️ Pedido eliminado');
    setSel(s => { const ns = new Set(s); ns.delete(id); return ns; });
    fetchAll();
  };

  const exportarPedidosExcel = () => {
    const data = filtered.map(p => ({
      'No.': p.consecutivo,
      'Fecha Registro': p.fecha_registro ? new Date(p.fecha_registro).toLocaleDateString('es-CO') : '',
      'Fecha Entrega': p.fecha_entrega || '',
      'Hora Entrega': fmtHora12(p.hora_entrega),
      'Empresa': p.nombre_empresa,
      'Contacto': p.nombre_contacto,
      'Teléfono': p.telefono,
      'Email': p.email || '',
      'Documento': `${p.tipo_documento||''} ${p.numero_documento||''}`,
      'Dirección': p.direccion,
      'Productos': (items[p.id]||[]).map(i=>`${i.cantidad}x ${i.nombre_producto}`).join(' | '),
      'Total': totalConDomicilio(p),
      'Observaciones': p.observaciones || '',
      'Anticipo': p.tiene_anticipo ? 'Sí' : 'No',
      'Mensajero': p.domiciliarios?.nombre || '',
      'Estado': p.estado,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Pedidos');
    XLSX.writeFile(wb, `Pedidos_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportarComandasExcel = () => {
    const rows = [];
    (selPedidos.length?selPedidos:filtered).forEach(p => {
      (items[p.id]||[]).forEach(i => rows.push({ 'No. Pedido': p.consecutivo, 'Empresa': p.nombre_empresa, 'Producto': i.nombre_producto, 'Cantidad': i.cantidad, 'F. Entrega': p.fecha_entrega, 'Hora': fmtHora12(p.hora_entrega), 'Observaciones': p.observaciones||'' }));
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Comandas');
    XLSX.writeFile(wb, `Comandas_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportarOrdenesExcel = () => {
    const data = (selPedidos.length?selPedidos:filtered).map(p => ({
      'No.': p.consecutivo, 'Empresa': p.nombre_empresa, 'Dirección': p.direccion, 'Teléfono': p.telefono,
      'Productos': (items[p.id]||[]).map(i=>`${i.cantidad}x ${i.nombre_producto}`).join(' | '),
      'Total': totalConDomicilio(p), 'Mensajero': p.domiciliarios?.nombre||'', 'Estado': p.estado,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Ordenes');
    XLSX.writeFile(wb, `Ordenes_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Exportación operativa detallada: una fila POR PRODUCTO (no agrupado),
  // pensada para agilizar preparación y despacho del día/rango seleccionado.
  const exportarDetalladoExcel = () => {
    const peds = selPedidos.length ? selPedidos : filtered;
    if (!peds.length) { toast('No hay pedidos para exportar', 'error'); return; }
    const rows = [];
    let n = 1;
    peds.forEach(p => {
      (items[p.id]||[]).forEach(i => {
        rows.push({
          'PDO': n++,
          'Fecha Entrega': fmtDate(p.fecha_entrega),
          'Hora Entrega': fmtHora12(p.hora_entrega),
          'Nombre de la Empresa': p.nombre_empresa,
          'Nombre de Contacto': p.nombre_contacto,
          '# Teléfono': p.telefono,
          'Dirección de Entrega': p.direccion,
          'Cantidad': i.cantidad,
          'Opción': i.nombre_producto,
          'Observaciones': p.observaciones || '',
          'Mensajero': p.domiciliarios?.nombre || '',
        });
      });
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{wch:5},{wch:12},{wch:12},{wch:22},{wch:18},{wch:14},{wch:28},{wch:9},{wch:22},{wch:30},{wch:16}];
    XLSX.utils.book_append_sheet(wb, ws, 'Detallado');
    XLSX.writeFile(wb, `Pedidos_Detallado_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const accionMasiva = async (fn, nombre) => {
    const peds = selPedidos.length ? selPedidos : filtered;
    if (!peds.length) { toast('No hay pedidos para procesar', 'error'); return; }
    toast(`Generando ${nombre}...`);
    await fn(peds, items, config);
    toast(`✅ ${nombre} generado (${peds.length})`);
  };

  const accionMasivaConPagos = async (fn, nombre) => {
    const peds = selPedidos.length ? selPedidos : filtered;
    if (!peds.length) { toast('No hay pedidos para procesar', 'error'); return; }
    const { data: pagos } = await supabase.from('pagos').select('*').in('pedido_id', peds.map(p=>p.id));
    const pagosPorPedido = {};
    (pagos||[]).forEach(pg => { if(!pagosPorPedido[pg.pedido_id]) pagosPorPedido[pg.pedido_id]=[]; pagosPorPedido[pg.pedido_id].push(pg); });
    await fn(peds, pagosPorPedido, items, config);
    toast(`✅ ${nombre} generado (${peds.length})`);
  };

  const clearFilters = () => { setQ(''); setFechaReg(''); setFechaEntDesde(''); setFechaEntHasta(''); setFEstado(''); setFDom(''); };
  const hasFilters = q || fFechaReg || fFechaEntDesde || fFechaEntHasta || fEstado || fDom;

  const totalEditado = editItems.reduce((s,i)=>s+(parseFloat(i.cantidad)||0)*(parseFloat(i.precio_unitario)||0),0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Pedidos</div>
          <div className="page-sub">{filtered.length} de {pedidos.length} registros{sel.size>0 && ` · ${sel.size} seleccionados`}</div>
        </div>
        <div className="actions-row">
          <button className="btn" onClick={fetchAll}><RefreshCw size={13} /> Actualizar Data</button>
        </div>
      </div>

      {/* Botones de impresión y exportación */}
      <div className="actions-row" style={{marginBottom:14, flexWrap:'wrap'}}>
        <button className="btn btn-green" onClick={()=>accionMasiva(imprimirOrdenes,'Órdenes de despacho')}><Printer size={13}/> Órdenes Despacho</button>
        <button className="btn btn-green" onClick={()=>accionMasiva(imprimirComandas,'Comandas')}><FileText size={13}/> Imprimir Comanda</button>
        <button className="btn btn-green" onClick={()=>accionMasiva(imprimirCotizaciones,'Cotizaciones')}><Receipt size={13}/> Imprimir Cotización</button>
        <button className="btn btn-green" onClick={()=>accionMasivaConPagos(imprimirCuentasCobroWrapper,'Cuentas de cobro')}><Receipt size={13}/> Imprimir C. de Cobro</button>
        <span style={{width:1, background:'#dadce0', alignSelf:'stretch'}}></span>
        <button className="btn" onClick={exportarPedidosExcel}><Download size={13}/> Exportar Pedidos</button>
        <button className="btn" onClick={exportarComandasExcel}><Download size={13}/> Exportar Comandas</button>
        <button className="btn" onClick={exportarOrdenesExcel}><Download size={13}/> Exportar Órdenes</button>
        <button className="btn btn-green" onClick={exportarDetalladoExcel}><Download size={13}/> Exportar Detallado (operativo)</button>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-label">Total</div><div className="stat-val">{filtered.length}</div></div>
        <div className="stat"><div className="stat-label">Recibidos</div><div className="stat-val amber">{filtered.filter(p=>p.estado==='Recibido').length}</div></div>
        <div className="stat"><div className="stat-label">En producción</div><div className="stat-val amber">{filtered.filter(p=>p.estado==='En producción').length}</div></div>
        <div className="stat"><div className="stat-val">{filtered.filter(p=>p.estado==='Entregado').length}</div><div className="stat-label">Entregados</div></div>
        <div className="stat"><div className="stat-label">Total ventas</div><div className="stat-val text">{fmt(totalVentas)}</div></div>
      </div>

      <div className="filters">
        <div className="search-wrap">
          <Search className="search-icon" />
          <input placeholder="Buscar empresa, contacto, # pedido..." value={q} onChange={e => setQ(e.target.value)} style={{minWidth:220}} />
        </div>
        <div>
          <label style={{fontSize:10,color:'#9aa0a6',display:'block',marginBottom:2}}>Fecha del pedido</label>
          <input type="date" value={fFechaReg} onChange={e=>setFechaReg(e.target.value)} />
        </div>
        <div>
          <label style={{fontSize:10,color:'#9aa0a6',display:'block',marginBottom:2}}>Entrega desde</label>
          <input type="date" value={fFechaEntDesde} onChange={e=>setFechaEntDesde(e.target.value)} />
        </div>
        <div>
          <label style={{fontSize:10,color:'#9aa0a6',display:'block',marginBottom:2}}>Entrega hasta</label>
          <input type="date" value={fFechaEntHasta} onChange={e=>setFechaEntHasta(e.target.value)} />
        </div>
        <select value={fEstado} onChange={e=>setFEstado(e.target.value)}>
          <option value="">Estado (todos)</option>
          {ESTADOS.map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={fDom} onChange={e=>setFDom(e.target.value)}>
          <option value="">Mensajero (todos)</option>
          {domiciliarios.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        {hasFilters && <button className="btn btn-ghost" onClick={clearFilters}><X size={13} /> Limpiar</button>}
      </div>

      {loading ? <div className="empty">Cargando pedidos…</div> :
       filtered.length === 0 ? <div className="empty">No hay pedidos con los filtros seleccionados.</div> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{width:32}}><input type="checkbox" checked={sel.size===filtered.length&&filtered.length>0} onChange={toggleAll} /></th>
                <th>#</th>
                <th>Empresa</th>
                <th>Contacto</th>
                <th>Productos</th>
                <th>F. Entrega</th>
                <th style={{cursor:'pointer', userSelect:'none'}} onClick={()=>setOrdenHora(o => o==='asc'?'desc':o==='desc'?null:'asc')}>
                  Hora {ordenHora==='asc'?'▲':ordenHora==='desc'?'▼':'⇅'}
                </th>
                <th>Total</th>
                <th>Mensajero</th>
                <th>Estado</th>
                <th>Anticipo</th>
                <th>Observaciones</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const pit = items[p.id] || [];
                const totalProd = pit.reduce((s,i)=>s+(i.subtotal||0),0);
                return (
                  <tr key={p.id} style={sel.has(p.id)?{background:'#f0fdf4'}:{}}>
                    <td><input type="checkbox" checked={sel.has(p.id)} onChange={()=>toggleSel(p.id)} /></td>
                    <td><span className="td-mono">{String(p.consecutivo).padStart(4,'0')}</span></td>
                    <td><div className="td-bold">{p.nombre_empresa}</div><div style={{fontSize:11,color:'#9aa0a6'}}>{p.telefono}</div></td>
                    <td>{p.nombre_contacto}</td>
                    <td style={{maxWidth:200}}>
                      {pit.map(i=><div key={i.id} style={{fontSize:12}}><span style={{background:'#e6f4ea',color:'#1a5c2a',borderRadius:3,padding:'1px 5px',fontSize:11,marginRight:4}}>{i.cantidad}</span>{i.nombre_producto}</div>)}
                    </td>
                    <td>{fmtDate(p.fecha_entrega)}</td>
                    <td>{fmtHora12(p.hora_entrega)}</td>
                    <td className="td-right td-bold">{fmt(totalProd)}</td>
                    <td>{p.domiciliarios?.nombre||'-'}</td>
                    <td><span className={`badge ${ESTADO_BADGE[p.estado]||'badge-gray'}`}>{p.estado}</span></td>
                    <td className="td-center">{p.tiene_anticipo?<span className="badge badge-green">Sí</span>:'No'}</td>
                    <td style={{maxWidth:150,fontSize:12,color:'#5f6368',fontStyle:p.observaciones?'italic':'normal'}}>{p.observaciones||'-'}</td>
                    <td>
                      <div className="actions-row">
                        <button className="btn" style={{padding:'4px 10px'}} onClick={()=>abrirEdicion(p)} title="Editar"><Edit2 size={12} /></button>
                        <button className="btn btn-danger" style={{padding:'4px 10px'}} onClick={()=>eliminarPedido(p.id, p.consecutivo)} title="Eliminar"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL DE EDICIÓN COMPLETO ── */}
      {modalPedido && (
        <div className="overlay" onClick={cerrarModal}>
          <div className="modal" style={{maxWidth:640}} onClick={e=>e.stopPropagation()}>
            <div className="modal-title">
              <span>Editar Pedido #{String(modalPedido.consecutivo).padStart(4,'0')}</span>
              <button className="btn btn-ghost" style={{padding:'2px 6px'}} onClick={cerrarModal}><X size={16}/></button>
            </div>

            <div className="form-grid cols2" style={{marginBottom:14}}>
              <div className="fg">
                <label>Empresa</label>
                <input value={editData.nombre_empresa||''} onChange={e=>setEditData(d=>({...d,nombre_empresa:e.target.value}))} style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}} />
              </div>
              <div className="fg">
                <label>Contacto</label>
                <input value={editData.nombre_contacto||''} onChange={e=>setEditData(d=>({...d,nombre_contacto:e.target.value}))} style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}} />
              </div>
              <div className="fg">
                <label>Teléfono</label>
                <input value={editData.telefono||''} onChange={e=>setEditData(d=>({...d,telefono:e.target.value}))} style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}} />
              </div>
              <div className="fg">
                <label>Mensajero</label>
                <select value={editData.domiciliario_id||''} onChange={e=>setEditData(d=>({...d,domiciliario_id:e.target.value}))} style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}}>
                  <option value="">— sin asignar —</option>
                  {domiciliarios.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div className="fg">
                <label>Fecha de entrega</label>
                <input type="date" value={editData.fecha_entrega||''} onChange={e=>setEditData(d=>({...d,fecha_entrega:e.target.value}))} style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}} />
              </div>
              <div className="fg">
                <label>Hora de entrega</label>
                <input type="time" value={editData.hora_entrega||''} onChange={e=>setEditData(d=>({...d,hora_entrega:e.target.value}))} style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}} />
              </div>
              <div className="fg">
                <label>Estado</label>
                <select value={editData.estado||''} onChange={e=>setEditData(d=>({...d,estado:e.target.value}))} style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}}>
                  {ESTADOS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="fg">
                <label>Dirección</label>
                <input value={editData.direccion||''} onChange={e=>setEditData(d=>({...d,direccion:e.target.value}))} style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}} />
              </div>
              <div className="fg full">
                <label>Observaciones</label>
                <input value={editData.observaciones||''} onChange={e=>setEditData(d=>({...d,observaciones:e.target.value}))} style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}} />
              </div>
            </div>

            <div style={{fontSize:11,fontWeight:600,color:'#5f6368',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>Productos del pedido</div>
            <div className="tbl-wrap" style={{marginBottom:10}}>
              <table>
                <thead>
                  <tr><th>Producto</th><th style={{width:70}}>Cant.</th><th style={{width:100}}>Precio unit.</th><th style={{width:100}}>Subtotal</th><th style={{width:40}}></th></tr>
                </thead>
                <tbody>
                  {editItems.map((it, idx) => (
                    <tr key={it.id}>
                      <td>{it.nombre_producto}</td>
                      <td><input type="number" min="1" value={it.cantidad} onChange={e=>actualizarItem(idx,'cantidad',parseFloat(e.target.value)||0)} style={{width:60,padding:'4px 6px',border:'1px solid #dadce0',borderRadius:4,fontSize:12}} /></td>
                      <td><input type="number" min="0" value={it.precio_unitario} onChange={e=>actualizarItem(idx,'precio_unitario',parseFloat(e.target.value)||0)} style={{width:90,padding:'4px 6px',border:'1px solid #dadce0',borderRadius:4,fontSize:12}} /></td>
                      <td className="td-right">{fmt(it.subtotal)}</td>
                      <td><button className="btn btn-danger" style={{padding:'3px 6px'}} onClick={()=>quitarItem(idx)}><Trash2 size={12}/></button></td>
                    </tr>
                  ))}
                  {editItems.length===0 && <tr><td colSpan={5} className="empty" style={{padding:16}}>Sin productos. Agrega uno abajo.</td></tr>}
                </tbody>
              </table>
            </div>

            <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'flex-end'}}>
              <div className="fg" style={{flex:1,margin:0}}>
                <label>Agregar producto</label>
                <select value={nuevoProductoId} onChange={e=>setNuevoProductoId(e.target.value)} style={{width:'100%',padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}}>
                  <option value="">Selecciona un producto...</option>
                  {productos.map(pr=><option key={pr.id} value={pr.id}>{pr.nombre}</option>)}
                </select>
              </div>
              <button className="btn btn-green" onClick={agregarProductoAlPedido}><Plus size={13}/> Agregar</button>
            </div>

            <div style={{background:'#f0fdf4',border:'1px solid #ceead6',borderRadius:6,padding:12,marginBottom:16,display:'flex',justifyContent:'space-between',fontSize:15,fontWeight:700,color:'#1e7e34'}}>
              <span>TOTAL</span><span>{fmt(totalEditado)}</span>
            </div>

            <div className="actions-row">
              <button className="btn btn-green" onClick={guardarEdicion} disabled={saving}><Save size={13}/> {saving?'Guardando...':'Guardar cambios'}</button>
              <button className="btn" onClick={cerrarModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );

  async function imprimirCuentasCobroWrapper(peds, pagosPorPedido, itemsArg, cfg) {
    await imprimirCuentasCobro(peds, itemsArg, cfg);
  }
}
