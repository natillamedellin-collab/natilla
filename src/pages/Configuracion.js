import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { Save, Plus, Trash2, UserCheck, UserX, Upload, Check } from 'lucide-react';

export default function Configuracion() {
  const [config, setConfig] = useState({ nombre_negocio:'', nit:'', direccion:'', telefono:'', email:'', mensaje:'', whatsapp:'', logo_url:'' });
  const [configId, setConfigId] = useState(null);
  const [productos, setProductos] = useState([]);
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [nuevoMensajero, setNuevoMensajero] = useState({ nombre:'', telefono:'' });
  const [uploading, setUploading] = useState({});
  const [savingRow, setSavingRow] = useState({});
  const { toast, ToastContainer } = useToast();

  useEffect(() => {
    supabase.from('configuracion').select('*').limit(1).single().then(({ data }) => { if(data){ setConfig(data); setConfigId(data.id); }});
    fetchProductos();
    fetchDomiciliarios();
  }, []);

  const fetchProductos = () => supabase.from('productos').select('*').order('orden').then(({ data }) => setProductos(data||[]));

  const agregarProducto = async () => {
    if (productos.length >= 100) { toast('Máximo 100 productos permitidos', 'error'); return; }
    const maxOrden = productos.reduce((m,p)=>Math.max(m, p.orden||0), 0);
    const { error } = await supabase.from('productos').insert([{
      nombre: 'Nuevo producto', descripcion: '', precio: 0, orden: maxOrden+1, activo: true,
    }]);
    if (error) { toast('Error: '+error.message, 'error'); return; }
    toast('✅ Producto agregado, edítalo abajo');
    fetchProductos();
  };

  const eliminarProducto = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar el producto "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) { toast('Error al eliminar: '+error.message, 'error'); return; }
    toast('🗑️ Producto eliminado');
    fetchProductos();
  };

  const fetchDomiciliarios = () => supabase.from('domiciliarios').select('*').order('nombre').then(({ data }) => setDomiciliarios(data||[]));

  const saveConfig = async () => {
    setSavingConfig(true);
    let error;
    if (configId) ({ error } = await supabase.from('configuracion').update(config).eq('id', configId));
    else {
      const res = await supabase.from('configuracion').insert([config]).select().single();
      error = res.error; if(!error) setConfigId(res.data.id);
    }
    setSavingConfig(false);
    if (error) toast('Error: '+error.message,'error');
    else toast('✅ Configuración guardada');
  };

  const handleConfigChange = e => setConfig(c=>({...c,[e.target.name]:e.target.value}));

  const updateProductoField = (id, field, value) => {
    setProductos(ps => ps.map(p => p.id===id ? {...p,[field]:value} : p));
  };

  const guardarProducto = async (producto) => {
    setSavingRow(s => ({ ...s, [producto.id]: 'saving' }));
    const { error } = await supabase.from('productos').update({
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: parseFloat(producto.precio) || 0,
      orden: parseInt(producto.orden) || 0,
    }).eq('id', producto.id);

    if (error) {
      setSavingRow(s => ({ ...s, [producto.id]: 'error' }));
      toast('❌ Error al guardar: ' + error.message, 'error');
      return;
    }

    // Verificación real: releer el registro desde la base de datos
    const { data: verificado, error: verifyError } = await supabase.from('productos').select('*').eq('id', producto.id).single();
    if (verifyError || !verificado || verificado.precio !== (parseFloat(producto.precio) || 0)) {
      setSavingRow(s => ({ ...s, [producto.id]: 'error' }));
      toast('❌ No se pudo confirmar el guardado. Intenta de nuevo.', 'error');
      return;
    }

    setSavingRow(s => ({ ...s, [producto.id]: 'saved' }));
    toast(`✅ "${producto.nombre}" guardado correctamente`);
    setTimeout(() => setSavingRow(s => ({ ...s, [producto.id]: null })), 2500);
  };

  const toggleProducto = async (id, activo) => {
    await supabase.from('productos').update({ activo: !activo }).eq('id', id);
    fetchProductos();
    toast(activo ? 'Producto desactivado' : 'Producto activado');
  };


  const uploadImagen = async (productoId, file) => {
    if (!file) return;
    setUploading(u=>({...u,[productoId]:true}));
    const ext = file.name.split('.').pop();
    const path = `${productoId}.${ext}`;
    const { error: upErr } = await supabase.storage.from('productos').upload(path, file, { upsert: true });
    if (upErr) { toast('Error subiendo imagen: '+upErr.message,'error'); setUploading(u=>({...u,[productoId]:false})); return; }
    const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(path);
    const urlConCache = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('productos').update({ imagen_url: urlConCache }).eq('id', productoId);
    fetchProductos();
    setUploading(u=>({...u,[productoId]:false}));
    toast('✅ Imagen actualizada');
  };

  const agregarMensajero = async () => {
    if (!nuevoMensajero.nombre.trim()) { toast('Ingresa el nombre','error'); return; }
    await supabase.from('domiciliarios').insert([{ nombre: nuevoMensajero.nombre.trim(), telefono: nuevoMensajero.telefono||null }]);
    setNuevoMensajero({ nombre:'', telefono:'' });
    fetchDomiciliarios();
    toast('Mensajero agregado');
  };

  const toggleMensajero = async (id, activo) => {
    await supabase.from('domiciliarios').update({ activo: !activo }).eq('id', id);
    fetchDomiciliarios();
    toast(activo ? 'Desactivado' : 'Activado');
  };

  const eliminarMensajero = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar a ${nombre}?`)) return;
    await supabase.from('domiciliarios').delete().eq('id', id);
    fetchDomiciliarios();
    toast('Mensajero eliminado');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Configuración</div>
          <div className="page-sub">Datos del negocio, productos y mensajeros</div>
        </div>
      </div>

      {/* Datos negocio */}
      <div className="card">
        <div className="card-title">Datos del negocio</div>
        <div className="form-grid cols3" style={{marginBottom:10}}>
          <div className="fg"><label>Nombre del negocio</label><input name="nombre_negocio" value={config.nombre_negocio||''} onChange={handleConfigChange} /></div>
          <div className="fg"><label>NIT</label><input name="nit" value={config.nit||''} onChange={handleConfigChange} placeholder="437492238-0" /></div>
          <div className="fg"><label>Teléfono</label><input name="telefono" value={config.telefono||''} onChange={handleConfigChange} /></div>
          <div className="fg"><label>Email</label><input name="email" value={config.email||''} onChange={handleConfigChange} /></div>
          <div className="fg"><label>WhatsApp (con código país)</label><input name="whatsapp" value={config.whatsapp||''} onChange={handleConfigChange} placeholder="573195122754" /></div>
          <div className="fg"><label>Dirección</label><input name="direccion" value={config.direccion||''} onChange={handleConfigChange} /></div>
          <div className="fg full"><label>Mensaje en órdenes y recibos</label><textarea name="mensaje" value={config.mensaje||''} onChange={handleConfigChange} rows={2} /></div>
          <div className="fg full"><label>URL del logo</label><input name="logo_url" value={config.logo_url||''} onChange={handleConfigChange} placeholder="https://..." /></div>
        </div>
        {config.logo_url && <img src={config.logo_url} alt="Logo" style={{maxHeight:60,borderRadius:6,border:'1px solid #e0e0e0',marginBottom:10}} onError={e=>e.target.style.display='none'} />}
        <button className="btn btn-green" onClick={saveConfig} disabled={savingConfig}><Save size={13}/> {savingConfig?'Guardando…':'Guardar configuración'}</button>
      </div>

      {/* Productos */}
      <div className="card">
        <div className="card-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center',border:'none',marginBottom:8,paddingBottom:0}}>
          <span>Productos del catálogo ({productos.length}/100)</span>
          <button className="btn btn-green" style={{padding:'5px 12px'}} onClick={agregarProducto} disabled={productos.length>=100}>
            <Plus size={13}/> Agregar producto
          </button>
        </div>
        <div style={{borderBottom:'1px solid #e0e0e0',marginBottom:12}}></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{width:70}}>Imagen</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th style={{width:100}}>Precio ($)</th>
                <th style={{width:80}}>Orden</th>
                <th style={{width:80}}>Estado</th>
                <th style={{width:120}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.id} style={!p.activo?{opacity:.5}:{}}>
                  <td>
                    <div style={{position:'relative',width:50,height:50}}>
                      <div style={{width:50,height:50,borderRadius:6,background:'#f1f3f4',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
                        {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : '🍮'}
                      </div>
                      <label style={{position:'absolute',bottom:-4,right:-4,width:20,height:20,background:'#1e7e34',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                        {uploading[p.id] ? <span style={{fontSize:8,color:'#fff'}}>...</span> : <Upload size={10} color="#fff" />}
                        <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>uploadImagen(p.id, e.target.files[0])} />
                      </label>
                    </div>
                  </td>
                  <td><input value={p.nombre||''} onChange={e=>updateProductoField(p.id,'nombre',e.target.value)} style={{width:'100%',padding:'5px 7px',border:'1px solid #e0e0e0',borderRadius:4,fontSize:13}} /></td>
                  <td><input value={p.descripcion||''} onChange={e=>updateProductoField(p.id,'descripcion',e.target.value)} style={{width:'100%',padding:'5px 7px',border:'1px solid #e0e0e0',borderRadius:4,fontSize:13}} /></td>
                  <td><input type="number" value={p.precio||''} onChange={e=>updateProductoField(p.id,'precio',e.target.value)} style={{width:'100%',padding:'5px 7px',border:'1px solid #e0e0e0',borderRadius:4,fontSize:13}} placeholder="0" /></td>
                  <td><input type="number" value={p.orden||''} onChange={e=>updateProductoField(p.id,'orden',e.target.value)} style={{width:'100%',padding:'5px 7px',border:'1px solid #e0e0e0',borderRadius:4,fontSize:13}} /></td>
                  <td><span className={`badge ${p.activo?'badge-green':'badge-gray'}`}>{p.activo?'Activo':'Inactivo'}</span></td>
                  <td>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      <button
                        className="btn btn-green"
                        style={{padding:'4px 10px',fontSize:11,justifyContent:'center'}}
                        onClick={()=>guardarProducto(p)}
                        disabled={savingRow[p.id]==='saving'}
                      >
                        {savingRow[p.id]==='saving' ? '⏳ Guardando...' :
                         savingRow[p.id]==='saved' ? <><Check size={12}/> Guardado</> :
                         <><Save size={12}/> Guardar</>}
                      </button>
                      <button className="btn" style={{padding:'3px 8px',fontSize:11,justifyContent:'center'}} onClick={()=>toggleProducto(p.id,p.activo)}>
                        {p.activo?<UserX size={12}/>:<UserCheck size={12}/>} {p.activo?'Desactivar':'Activar'}
                      </button>
                      <button className="btn btn-danger" style={{padding:'3px 8px',fontSize:11,justifyContent:'center'}} onClick={()=>eliminarProducto(p.id,p.nombre)}>
                        <Trash2 size={12}/> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{fontSize:11,color:'#9aa0a6',marginTop:8}}>💡 Edita los campos y toca <strong>"Guardar"</strong> en cada fila para confirmar los cambios. Verás "✓ Guardado" cuando se confirme en la base de datos. Para subir imagen toca el ícono verde en la foto del producto.</p>
      </div>

      {/* Mensajeros */}
      <div className="card">
        <div className="card-title">Mensajeros / Domiciliarios</div>
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="fg" style={{flex:'1 1 160px',margin:0}}>
            <label>Nombre</label>
            <input value={nuevoMensajero.nombre} onChange={e=>setNuevoMensajero(n=>({...n,nombre:e.target.value}))} placeholder="Nombre del mensajero" onKeyDown={e=>e.key==='Enter'&&agregarMensajero()} />
          </div>
          <div className="fg" style={{flex:'1 1 130px',margin:0}}>
            <label>Teléfono</label>
            <input value={nuevoMensajero.telefono} onChange={e=>setNuevoMensajero(n=>({...n,telefono:e.target.value}))} placeholder="Opcional" onKeyDown={e=>e.key==='Enter'&&agregarMensajero()} />
          </div>
          <button className="btn btn-green" onClick={agregarMensajero}><Plus size={13}/> Agregar</button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {domiciliarios.length === 0 ? (
                <tr><td colSpan={4} className="empty">No hay mensajeros registrados.</td></tr>
              ) : domiciliarios.map(d=>(
                <tr key={d.id}>
                  <td className="td-bold">{d.nombre}</td>
                  <td>{d.telefono||'-'}</td>
                  <td><span className={`badge ${d.activo?'badge-green':'badge-gray'}`}>{d.activo?'Activo':'Inactivo'}</span></td>
                  <td>
                    <div className="actions-row">
                      <button className="btn" style={{padding:'3px 8px',fontSize:11}} onClick={()=>toggleMensajero(d.id,d.activo)}>{d.activo?<UserX size={12}/>:<UserCheck size={12}/>}</button>
                      <button className="btn btn-danger" style={{padding:'3px 8px',fontSize:11}} onClick={()=>eliminarMensajero(d.id,d.nombre)}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
