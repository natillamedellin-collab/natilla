import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { RefreshCw, Download, Search, X, Plus, CheckCircle, Clock, Edit2, Trash2, Save } from 'lucide-react';
import { imprimirRecibos } from '../lib/pdf';
import * as XLSX from 'xlsx';

const fmt = n => `$${Number(n||0).toLocaleString('es-CO')}`;
// Solo cambia cómo se muestra en pantalla: "Pago Normal" (guardado en BD) se ve como "Pago Total"
const tipoLabel = t => t === 'Pago Normal' ? 'Pago Total' : t;

// Formato con puntos separadores de miles, SIN decimales — para el campo Monto
const formatMiles = (val) => {
  const soloDigitos = String(val||'').replace(/\D/g,'');
  if (!soloDigitos) return '';
  return Number(soloDigitos).toLocaleString('es-CO');
};
const parseMiles = (val) => String(val||'').replace(/\D/g,'');

export default function Pagos() {
  const [pedidos, setPedidos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [items, setItems] = useState({});
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalId, setModalId] = useState(null); // solo el ID — los datos se derivan en vivo
  const [nuevoPago, setNuevoPago] = useState({ tipo:'Pago Normal', metodo:'Efectivo', monto:'', referencia:'', nota:'' });
  const [savingPago, setSavingPago] = useState(false);
  const [editingPagoId, setEditingPagoId] = useState(null);
  const [editPagoData, setEditPagoData] = useState({});
  const [sel, setSel] = useState(new Set());
  const { toast, ToastContainer } = useToast();

  const [q, setQ] = useState('');
  const [fFecha, setFFecha] = useState('');
  const [fNit, setFNit] = useState('');
  const [fEstPago, setFEstPago] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: peds }, { data: pags }, { data: cfg }] = await Promise.all([
      supabase.from('pedidos').select('*').order('consecutivo', { ascending: false }),
      supabase.from('pagos').select('*').order('fecha_pago', { ascending: false }),
      supabase.from('configuracion').select('*').limit(1).single(),
    ]);
    setPedidos(peds || []);
    setPagos(pags || []);
    setConfig(cfg || {});
    if (peds?.length) {
      const { data: it } = await supabase.from('pedido_items').select('*').in('pedido_id', peds.map(p=>p.id));
      const map = {};
      (it||[]).forEach(i => { if (!map[i.pedido_id]) map[i.pedido_id] = []; map[i.pedido_id].push(i); });
      setItems(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const calcSaldo = (pedidoId, totalPedido) => {
    const totalPagado = pagos.filter(p=>p.pedido_id===pedidoId).reduce((s,p)=>s+(p.monto||0),0);
    return { totalPagado, saldo: totalPedido - totalPagado, completado: (totalPedido - totalPagado) <= 0 };
  };

  // Recalculado en cada render a partir del estado fresco — así el modal
  // SIEMPRE refleja los datos reales, nunca una "foto" desactualizada.
  const enriquecidos = pedidos.map(p => {
    const pit = items[p.id] || [];
    const totalPedido = pit.reduce((s,i)=>s+(i.subtotal||0),0);
    return { ...p, totalPedido, ...calcSaldo(p.id, totalPedido), pagosDel: pagos.filter(pg=>pg.pedido_id===p.id) };
  });

  const filtered = enriquecidos.filter(p => {
    const sq = q.toLowerCase();
    if (sq && !p.nombre_empresa?.toLowerCase().includes(sq) && !String(p.consecutivo).includes(sq) && !p.nombre_contacto?.toLowerCase().includes(sq)) return false;
    if (fFecha && !p.fecha_registro?.startsWith(fFecha)) return false;
    if (fNit && !p.numero_documento?.includes(fNit)) return false;
    if (fEstPago === 'completado' && !p.completado) return false;
    if (fEstPago === 'pendiente' && p.completado) return false;
    return true;
  });

  // El modal SIEMPRE se deriva de los datos frescos, nunca de un snapshot viejo
  const modal = modalId ? enriquecidos.find(p => p.id === modalId) : null;

  const totalCobrar = filtered.reduce((s,p)=>s+(p.saldo>0?p.saldo:0),0);
  const selPedidos = filtered.filter(p=>sel.has(p.id));
  const toggleSel = id => setSel(s=>{const ns=new Set(s);ns.has(id)?ns.delete(id):ns.add(id);return ns;});

  const cerrarModal = () => { setModalId(null); setEditingPagoId(null); };

  const guardarPago = async () => {
    const montoNum = parseFloat(parseMiles(nuevoPago.monto));
    if (!montoNum || montoNum <= 0) { toast('Ingresa un monto válido','error'); return; }
    setSavingPago(true);
    const { error } = await supabase.from('pagos').insert([{ pedido_id: modalId, tipo: nuevoPago.tipo, metodo: nuevoPago.metodo, monto: montoNum, referencia: nuevoPago.referencia||null, nota: nuevoPago.nota||null }]);
    setSavingPago(false);
    if (error) { toast('Error: '+error.message,'error'); return; }
    toast('✅ Pago registrado');
    setNuevoPago({ tipo:'Pago Normal', metodo:'Efectivo', monto:'', referencia:'', nota:'' });
    fetchAll();
  };

  const startEditPago = (pago) => { setEditingPagoId(pago.id); setEditPagoData({ ...pago, monto: formatMiles(pago.monto) }); };
  const cancelEditPago = () => { setEditingPagoId(null); setEditPagoData({}); };
  const saveEditPago = async () => {
    const { error } = await supabase.from('pagos').update({
      tipo: editPagoData.tipo, metodo: editPagoData.metodo,
      monto: parseFloat(parseMiles(editPagoData.monto)) || 0, referencia: editPagoData.referencia || null,
    }).eq('id', editingPagoId);
    if (error) { toast('Error: '+error.message,'error'); return; }
    toast('✅ Pago actualizado');
    setEditingPagoId(null);
    fetchAll();
  };

  const eliminarPago = async (id) => {
    if (!window.confirm('¿Eliminar este pago?')) return;
    const { error } = await supabase.from('pagos').delete().eq('id', id);
    if (error) { toast('❌ Error al eliminar: ' + error.message, 'error'); return; }
    toast('🗑️ Pago eliminado');
    await fetchAll();
  };

  const exportarExcel = () => {
    const data = filtered.map(p => ({ 'No.':p.consecutivo,'Empresa':p.nombre_empresa,'Contacto':p.nombre_contacto,'Documento':`${p.tipo_documento||''} ${p.numero_documento||''}`,'Total Pedido':p.totalPedido,'Total Pagado':p.totalPagado,'Saldo':p.saldo,'Estado':p.completado?'Completado':'Pendiente','Pagos':p.pagosDel.map(pg=>`${tipoLabel(pg.tipo)}/${pg.metodo}: ${fmt(pg.monto)}`).join(' | ') }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Pagos');
    XLSX.writeFile(wb, `Pagos_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportarRecibos = async () => {
    const peds = selPedidos.length ? selPedidos : filtered;
    if (!peds.length) { toast('No hay recibos para exportar','error'); return; }
    const pagosPorPedido = {};
    const itemsPorPedido = {};
    peds.forEach(p => { pagosPorPedido[p.id] = p.pagosDel; itemsPorPedido[p.id] = items[p.id]||[]; });
    toast('Generando recibos...');
    await imprimirRecibos(peds, pagosPorPedido, itemsPorPedido, config);
    toast(`✅ ${peds.length} recibo(s) generados`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Pagos y Recaudos</div>
          <div className="page-sub">{filtered.length} registros · Por cobrar: {fmt(totalCobrar)}</div>
        </div>
        <div className="actions-row">
          <button className="btn" onClick={fetchAll}><RefreshCw size={13} /></button>
          <button className="btn" onClick={exportarRecibos}><Download size={13} /> {selPedidos.length?`Recibos (${sel.size})`:'Todos los recibos'}</button>
          <button className="btn btn-green" onClick={exportarExcel}><Download size={13} /> Exportar Excel</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-label">Completados</div><div className="stat-val">{filtered.filter(p=>p.completado).length}</div></div>
        <div className="stat"><div className="stat-label">Pendientes</div><div className="stat-val amber">{filtered.filter(p=>!p.completado).length}</div></div>
        <div className="stat"><div className="stat-label">Total por cobrar</div><div className="stat-val text">{fmt(totalCobrar)}</div></div>
        <div className="stat"><div className="stat-label">Seleccionados</div><div className="stat-val">{sel.size}</div></div>
      </div>

      <div className="filters">
        <div className="search-wrap">
          <Search className="search-icon" />
          <input placeholder="Buscar empresa, contacto, # pedido..." value={q} onChange={e=>setQ(e.target.value)} style={{minWidth:200}} />
        </div>
        <input type="date" value={fFecha} onChange={e=>setFFecha(e.target.value)} title="Fecha de registro" />
        <input placeholder="NIT / Cédula" value={fNit} onChange={e=>setFNit(e.target.value)} style={{width:130}} />
        <select value={fEstPago} onChange={e=>setFEstPago(e.target.value)}>
          <option value="">Estado pago (todos)</option>
          <option value="completado">Completado</option>
          <option value="pendiente">Pendiente</option>
        </select>
        {(q||fFecha||fNit||fEstPago) && <button className="btn btn-ghost" onClick={()=>{setQ('');setFFecha('');setFNit('');setFEstPago('');}}><X size={13} /></button>}
      </div>

      {loading ? <div className="empty">Cargando…</div> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{width:36}}><input type="checkbox" checked={sel.size===filtered.length&&filtered.length>0} onChange={()=>sel.size===filtered.length?setSel(new Set()):setSel(new Set(filtered.map(p=>p.id)))} /></th>
                <th>#</th>
                <th>Empresa</th>
                <th>Documento</th>
                <th>Total pedido</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Pagos registrados</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><input type="checkbox" checked={sel.has(p.id)} onChange={()=>toggleSel(p.id)} /></td>
                  <td><span className="td-mono">{String(p.consecutivo).padStart(4,'0')}</span></td>
                  <td>
                    <div className="td-bold">{p.nombre_empresa}</div>
                    <div style={{fontSize:11,color:'#9aa0a6'}}>{p.nombre_contacto}</div>
                  </td>
                  <td style={{fontSize:12}}>{p.tipo_documento} {p.numero_documento}</td>
                  <td className="td-right td-bold">{fmt(p.totalPedido)}</td>
                  <td className="td-right" style={{color:'#1e7e34',fontWeight:500}}>{fmt(p.totalPagado)}</td>
                  <td className="td-right" style={{fontWeight:600,color:p.saldo>0?'#f29900':'#1e7e34'}}>{p.saldo>0?fmt(p.saldo):'✓'}</td>
                  <td>
                    {p.completado
                      ? <span className="badge badge-green"><CheckCircle size={10} style={{marginRight:3}}/>Completado</span>
                      : <span className="badge badge-amber"><Clock size={10} style={{marginRight:3}}/>Pendiente</span>}
                  </td>
                  <td style={{fontSize:11,color:'#5f6368',maxWidth:200}}>
                    {p.pagosDel.length===0?'—':p.pagosDel.map((pg,i)=>(
                      <div key={i}>{tipoLabel(pg.tipo)} · {pg.metodo}: {fmt(pg.monto)}{pg.referencia?` · ${pg.referencia}`:''}</div>
                    ))}
                  </td>
                  <td>
                    <button className="btn btn-green" style={{padding:'4px 10px'}} onClick={()=>{setModalId(p.id);setNuevoPago({tipo:'Pago Normal',metodo:'Efectivo',monto:p.saldo>0?formatMiles(Math.round(p.saldo)):'',referencia:'',nota:''});}}>
                      <Plus size={12} /> Pago
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal pago — siempre refleja los datos más recientes (derivado de enriquecidos) */}
      {modal && (
        <div className="overlay" onClick={cerrarModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">
              <span>Pedido #{String(modal.consecutivo).padStart(4,'0')} — {modal.nombre_empresa}</span>
              <button className="btn btn-ghost" style={{padding:'2px 6px'}} onClick={cerrarModal}><X size={14}/></button>
            </div>

            <div style={{background:'#f0fdf4',border:'1px solid #ceead6',borderRadius:6,padding:12,marginBottom:14,fontSize:13}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span>Total pedido:</span><strong>{fmt(modal.totalPedido)}</strong></div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span>Total pagado:</span><strong style={{color:'#1e7e34'}}>{fmt(modal.totalPagado)}</strong></div>
              <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #ceead6',paddingTop:6,marginTop:4}}><strong>Saldo pendiente:</strong><strong style={{color:modal.saldo>0?'#f29900':'#1e7e34',fontSize:15}}>{modal.saldo>0?fmt(modal.saldo):'¡PAGADO COMPLETO!'}</strong></div>
            </div>

            {modal.pagosDel?.length>0 && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:600,color:'#5f6368',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>Pagos registrados</div>
                {modal.pagosDel.map((pg) => editingPagoId === pg.id ? (
                  <div key={pg.id} style={{padding:'8px 0',borderBottom:'1px solid #f1f3f4'}}>
                    <div style={{display:'flex',gap:6,marginBottom:6}}>
                      <select value={editPagoData.tipo} onChange={e=>setEditPagoData(d=>({...d,tipo:e.target.value}))} style={{flex:1,padding:'5px 7px',border:'1px solid #dadce0',borderRadius:4,fontSize:12}}>
                        <option value="Pago Normal">Pago Total</option><option value="Anticipo">Anticipo</option>
                      </select>
                      <select value={editPagoData.metodo} onChange={e=>setEditPagoData(d=>({...d,metodo:e.target.value}))} style={{flex:1,padding:'5px 7px',border:'1px solid #dadce0',borderRadius:4,fontSize:12}}>
                        <option>Efectivo</option><option>Transferencia</option>
                      </select>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <input type="text" inputMode="numeric" value={editPagoData.monto} onChange={e=>setEditPagoData(d=>({...d,monto:formatMiles(e.target.value)}))} style={{flex:1,padding:'5px 7px',border:'1px solid #dadce0',borderRadius:4,fontSize:12}} placeholder="Monto" />
                      <button type="button" onClick={()=>setEditPagoData(d=>({...d,monto:''}))} title="Borrar monto" style={{padding:'5px 8px',border:'1px solid #dadce0',borderRadius:4,background:'#fef7f6',color:'#d93025',cursor:'pointer',display:'flex',alignItems:'center'}}><X size={12}/></button>
                      <input value={editPagoData.referencia||''} onChange={e=>setEditPagoData(d=>({...d,referencia:e.target.value}))} style={{flex:2,padding:'5px 7px',border:'1px solid #dadce0',borderRadius:4,fontSize:12}} placeholder="Referencia" />
                      <button className="btn btn-green" style={{padding:'4px 8px'}} onClick={saveEditPago}><Save size={12}/></button>
                      <button className="btn" style={{padding:'4px 8px'}} onClick={cancelEditPago}><X size={12}/></button>
                    </div>
                  </div>
                ) : (
                  <div key={pg.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #f1f3f4',fontSize:13}}>
                    <span>{tipoLabel(pg.tipo)} · {pg.metodo}{pg.referencia?` · ${pg.referencia}`:''}</span>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <strong>{fmt(pg.monto)}</strong>
                      <button className="btn btn-ghost" style={{padding:'3px 6px'}} onClick={()=>startEditPago(pg)}><Edit2 size={12}/></button>
                      <button className="btn btn-ghost" style={{padding:'3px 6px',color:'#d93025'}} onClick={()=>eliminarPago(pg.id)}><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{fontSize:11,fontWeight:600,color:'#5f6368',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Agregar pago</div>
            <div className="form-grid cols2" style={{marginBottom:10}}>
              <div className="fg">
                <label>Tipo</label>
                <div className="select-wrap"><select value={nuevoPago.tipo} onChange={e=>setNuevoPago(n=>({...n,tipo:e.target.value}))}><option value="Pago Normal">Pago Total</option><option value="Anticipo">Anticipo</option></select></div>
              </div>
              <div className="fg">
                <label>Método</label>
                <div className="select-wrap"><select value={nuevoPago.metodo} onChange={e=>setNuevoPago(n=>({...n,metodo:e.target.value}))}><option>Efectivo</option><option>Transferencia</option></select></div>
              </div>
            </div>
            <div className="fg" style={{marginBottom:10}}>
              <label>Monto ($)</label>
              <div style={{display:'flex',gap:6}}>
                <input type="text" inputMode="numeric" value={nuevoPago.monto} onChange={e=>setNuevoPago(n=>({...n,monto:formatMiles(e.target.value)}))} placeholder="0" style={{flex:1,padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:14}} />
                <button type="button" onClick={()=>setNuevoPago(n=>({...n,monto:''}))} title="Borrar monto" style={{padding:'8px 12px',border:'1px solid #dadce0',borderRadius:4,background:'#fef7f6',color:'#d93025',cursor:'pointer',display:'flex',alignItems:'center'}}>
                  <X size={16}/>
                </button>
              </div>
            </div>
            <div className="fg" style={{marginBottom:14}}>
              <label>Referencia / Nota</label>
              <input type="text" value={nuevoPago.referencia} onChange={e=>setNuevoPago(n=>({...n,referencia:e.target.value}))} placeholder="Comprobante, ref. transferencia..." style={{padding:'8px 10px',border:'1px solid #dadce0',borderRadius:4,fontSize:13}} />
            </div>
            <div className="actions-row">
              <button className="btn btn-green" onClick={guardarPago} disabled={savingPago}>{savingPago?'Guardando…':'Guardar pago'}</button>
              <button className="btn" onClick={cerrarModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
