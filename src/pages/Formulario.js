import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const HORAS_12 = Array.from({length:12}, (_,i)=>String(i+1).padStart(2,'0'));
const MINUTOS = ['00','15','30','45'];

export default function Formulario() {
  const [productos, setProductos] = useState([]);
  const [config, setConfig] = useState({});
  const [qtys, setQtys] = useState({});
  const [form, setForm] = useState({ email:'', nombre_empresa:'', tipo_documento:'', numero_documento:'', nombre_contacto:'', telefono:'', fecha_entrega:'', direccion:'', observaciones:'', tiene_anticipo:null });
  const [horaSel, setHoraSel] = useState({ h:'', m:'', ampm:'' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pedidoCreado, setPedidoCreado] = useState(null);

  useEffect(() => {
    supabase.from('productos').select('*').eq('activo', true).order('orden').then(({ data }) => {
      setProductos(data || []);
      const q = {}; (data||[]).forEach(p => q[p.id] = 0); setQtys(q);
    });
    supabase.from('configuracion').select('*').limit(1).single().then(({ data }) => setConfig(data || {}));
  }, []);

  const chg = (id, delta) => setQtys(q => ({ ...q, [id]: Math.max(0, (q[id]||0) + delta) }));
  const selected = productos.filter(p => (qtys[p.id]||0) > 0);
  const totalUnd = selected.reduce((s, p) => s + qtys[p.id], 0);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleTelefono = e => {
    const soloNumeros = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm(f => ({ ...f, telefono: soloNumeros }));
  };

  const horaEntrega24 = () => {
    if (!horaSel.h || !horaSel.m || !horaSel.ampm) return '';
    let h = parseInt(horaSel.h, 10);
    if (horaSel.ampm === 'AM' && h === 12) h = 0;
    if (horaSel.ampm === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2,'0')}:${horaSel.m}`;
  };
  const horaEntregaTexto = () => horaSel.h && horaSel.m && horaSel.ampm ? `${horaSel.h}:${horaSel.m} ${horaSel.ampm}` : '';

  const validar = () => {
    const faltantes = [];
    if (!form.email) faltantes.push('• Email');
    if (!form.nombre_empresa) faltantes.push('• Nombre de la empresa');
    if (!form.tipo_documento) faltantes.push('• Tipo de documento');
    if (!form.numero_documento) faltantes.push('• Número de documento');
    if (!form.nombre_contacto) faltantes.push('• Nombre de contacto');
    if (!selected.length) faltantes.push('• Al menos un producto seleccionado');
    if (form.tiene_anticipo === null) faltantes.push('• Indicar si tienes anticipo');
    if (!form.fecha_entrega) faltantes.push('• Fecha de entrega');
    if (!horaSel.h || !horaSel.m || !horaSel.ampm) faltantes.push('• Hora aproximada de entrega');
    if (!form.telefono) faltantes.push('• Teléfono de contacto');
    else if (form.telefono.length !== 10) faltantes.push('• Teléfono de contacto debe tener exactamente 10 números');
    if (!form.direccion) faltantes.push('• Dirección de entrega');
    return faltantes;
  };

  const enviar = async () => {
    const faltantes = validar();
    if (faltantes.length) { alert('Por favor completa los siguientes datos:\n\n' + faltantes.join('\n')); return; }
    setSending(true);
    const horaGuardar = horaEntrega24();
    try {
      const { data: pedido, error } = await supabase.from('pedidos').insert([{
        email: form.email, nombre_empresa: form.nombre_empresa,
        tipo_documento: form.tipo_documento, numero_documento: form.numero_documento,
        nombre_contacto: form.nombre_contacto, telefono: form.telefono,
        direccion: form.direccion, fecha_entrega: form.fecha_entrega,
        hora_entrega: horaGuardar, observaciones: form.observaciones,
        tiene_anticipo: form.tiene_anticipo === 'si', estado: 'Recibido',
      }]).select().single();
      if (error) throw error;
      const items = selected.map(p => {
        const precio = parseFloat(p.precio) || 0;
        return { pedido_id: pedido.id, producto_id: p.id, nombre_producto: p.nombre, imagen_url: p.imagen_url || null, cantidad: qtys[p.id], precio_unitario: precio, subtotal: precio * qtys[p.id] };
      });
      items.push({ pedido_id: pedido.id, producto_id: null, nombre_producto: 'Domicilio', imagen_url: null, cantidad: 1, precio_unitario: 0, subtotal: 0 });
      await supabase.from('pedido_items').insert(items);

      const appsScriptUrl = process.env.REACT_APP_APPSCRIPT_URL;
      if (appsScriptUrl) {
        const productosTexto = selected.map(p => `- ${p.nombre}: ${qtys[p.id]} und`).join('\n');
        fetch(appsScriptUrl, {
          method: 'POST',
          body: JSON.stringify({
            email: form.email,
            nombre_empresa: form.nombre_empresa,
            tipo_documento: form.tipo_documento,
            numero_documento: form.numero_documento,
            nombre_contacto: form.nombre_contacto,
            telefono: form.telefono,
            direccion: form.direccion,
            fecha_entrega: form.fecha_entrega,
            hora_entrega: horaEntregaTexto(),
            observaciones: form.observaciones,
            tiene_anticipo: form.tiene_anticipo === 'si',
            productos_texto: productosTexto,
          }),
        }).catch(() => {});
      }

      setPedidoCreado(pedido.consecutivo);
      setSent(true);
    } catch(e) { alert('Error al enviar el pedido: ' + e.message); }
    setSending(false);
  };

  const s = {
    input: { width:'100%', padding:'12px 0', border:'none', borderBottom:'1.5px solid #dadce0', borderRadius:0, fontSize:17, color:'#3c4043', background:'transparent', outline:'none' },
    label: { fontSize:15, color:'#5f6368', display:'block', marginBottom:6, fontWeight:500 },
    card: { background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, padding:22, marginBottom:16 },
    cardTitle: { fontSize:13, fontWeight:700, color:'#1e7e34', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:16, paddingBottom:11, borderBottom:'1px solid #f1f3f4' },
  };

  if (sent) return (
    <div style={{ background:'#eeeff1', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ ...s.card, textAlign:'center', maxWidth:400 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <h2 style={{ fontSize:20, fontWeight:400, color:'#3c4043', marginBottom:8 }}>¡Pedido enviado!</h2>
        {pedidoCreado && (
          <div style={{ background:'#e6f4ea', border:'1.5px solid #ceead6', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
            <div style={{ fontSize:14, color:'#5f6368' }}>Tu número de pedido es</div>
            <div style={{ fontSize:26, fontWeight:700, color:'#1e7e34' }}>#{String(pedidoCreado).padStart(4,'0')}</div>
            <div style={{ fontSize:13, color:'#5f6368', marginTop:4 }}>Guárdalo para cualquier consulta</div>
          </div>
        )}
        <p style={{ fontSize:15, color:'#5f6368', marginBottom:20 }}>Tu pedido fue registrado. Pronto nos comunicaremos contigo.</p>
        <button onClick={() => { setSent(false); setPedidoCreado(null); setQtys({}); setHoraSel({h:'',m:'',ampm:''}); setForm({ email:'', nombre_empresa:'', tipo_documento:'', numero_documento:'', nombre_contacto:'', telefono:'', fecha_entrega:'', direccion:'', observaciones:'', tiene_anticipo:null }); }} style={{ padding:'12px 26px', background:'#1e7e34', color:'#fff', border:'none', borderRadius:6, fontSize:16, cursor:'pointer' }}>
          Hacer otro pedido
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ background:'#eeeff1', minHeight:'100vh', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:'#fff', borderTop:'5px solid #1e7e34', padding:'20px', textAlign:'center', borderBottom:'1px solid #e0e0e0', marginBottom:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:3 }}>
          <div style={{ width:34, height:34, background:'#1e7e34', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🍮</div>
          <span style={{ fontSize:22, fontWeight:400, color:'#3c4043' }}>{config.nombre_negocio||'Natilla Medellín'}</span>
        </div>
        <p style={{ fontSize:15, color:'#9aa0a6' }}>Confirmación de Pedido</p>
      </div>

      <div style={{ maxWidth:640, margin:'0 auto', padding:'16px 16px 120px' }}>

        <div style={s.card}>
          <div style={s.cardTitle}>Información de contacto</div>
          <div style={{ marginBottom:18 }}><label style={s.label}>Email <span style={{color:'#d93025'}}>*</span></label><input style={s.input} type="email" name="email" value={form.email} onChange={handleChange} placeholder="tucorreo@empresa.com" /></div>
          <div style={{ marginBottom:18 }}><label style={s.label}>Nombre de la empresa <span style={{color:'#d93025'}}>*</span></label><input style={s.input} type="text" name="nombre_empresa" value={form.nombre_empresa} onChange={handleChange} placeholder="Empresa o tu nombre completo" /></div>
          <div style={{ marginBottom:18 }}>
            <label style={s.label}>Tipo de documento <span style={{color:'#d93025'}}>*</span></label>
            <div style={{ position:'relative' }}>
              <select name="tipo_documento" value={form.tipo_documento} onChange={handleChange} style={{ ...s.input, paddingRight:28, WebkitAppearance:'none', appearance:'none', cursor:'pointer' }}>
                <option value="">Selecciona el tipo</option>
                <option>NIT</option><option>Cédula</option>
              </select>
              <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#5f6368', fontSize:11 }}>▼</span>
            </div>
          </div>
          <div><label style={s.label}>Número de documento <span style={{color:'#d93025'}}>*</span></label><input style={s.input} type="text" name="numero_documento" value={form.numero_documento} onChange={handleChange} placeholder="Ej: 900123456-7" inputMode="numeric" /></div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Selecciona tu pedido</div>
          <p style={{ fontSize:15, color:'#5f6368', marginBottom:14 }}>Agrega los productos que deseas y ajusta las cantidades:</p>
          {productos.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid #f1f3f4' }}>
              <div style={{ width:58, height:58, borderRadius:8, background:'#f1f3f4', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} /> : <span style={{fontSize:26}}>🍮</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:16, color:'#3c4043' }}>{p.nombre}</div>
                {p.descripcion && <div style={{ fontSize:13, color:'#9aa0a6', marginTop:1 }}>{p.descripcion}</div>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <input type="number" value={qtys[p.id]||0} min={0} onChange={e => setQtys(q => ({...q,[p.id]:Math.max(0,parseInt(e.target.value)||0)}))} style={{ width:60, padding:'8px 4px', border:'1px solid #dadce0', borderRadius:4, textAlign:'center', fontSize:16, fontWeight:500, color:'#3c4043', outline:'none' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <label style={s.label}>Observaciones</label>
          <input style={s.input} type="text" name="observaciones" value={form.observaciones} onChange={handleChange} placeholder="Instrucciones especiales para tu pedido..." />
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>¿Tienes anticipo?</div>
          <p style={{ fontSize:15, color:'#5f6368', lineHeight:1.6, marginBottom:12 }}><strong>Recuerda:</strong> para pedidos mayores a 100 unidades debes enviar por WhatsApp el comprobante del anticipo para registrar el pedido, informando el nombre con que quedó registrado este pedido para poder descargarlo en el sistema.</p>
          <div style={{ display:'flex', gap:10 }}>
            {['si','no'].map(v => (
              <div key={v} onClick={() => setForm(f=>({...f,tiene_anticipo:v}))} style={{ flex:1, padding:'12px', border:`1.5px solid ${form.tiene_anticipo===v?'#1e7e34':'#dadce0'}`, borderRadius:8, textAlign:'center', fontSize:16, color:form.tiene_anticipo===v?'#1e7e34':'#5f6368', fontWeight:form.tiene_anticipo===v?600:400, cursor:'pointer', background:form.tiene_anticipo===v?'#e6f4ea':'#fff' }}>
                {v === 'si' ? 'Sí' : 'No'}
              </div>
            ))}
          </div>
          {form.tiene_anticipo === 'si' && (
            <a href="https://wa.me/573195122754" target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:'#25d366', color:'#fff', borderRadius:8, padding:13, fontSize:15, fontWeight:500, marginTop:12, textDecoration:'none' }}>
              📲 Enviar comprobante por WhatsApp
            </a>
          )}
        </div>

        <div style={{ background:'#fef9e7', border:'1px solid #fce8a2', borderRadius:8, padding:'12px 14px', fontSize:15, color:'#7d5a00', marginBottom:16, display:'flex', gap:8, lineHeight:1.5 }}>
          ⚠️ <span>Ten presente que no laboramos domingos ni festivos. Sábados hasta las 2:00 p.m.</span>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Fecha y hora de entrega</div>
          <div style={{ marginBottom:18 }}><label style={s.label}>Fecha de entrega <span style={{color:'#d93025'}}>*</span></label><input style={s.input} type="date" name="fecha_entrega" value={form.fecha_entrega} onChange={handleChange} /></div>
          <div>
            <label style={s.label}>Hora aproximada <span style={{color:'#d93025'}}>*</span></label>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ position:'relative', flex:1 }}>
                <select value={horaSel.h} onChange={e=>setHoraSel(hs=>({...hs,h:e.target.value}))} style={{ ...s.input, paddingRight:24, WebkitAppearance:'none', appearance:'none', cursor:'pointer' }}>
                  <option value="">Hora</option>
                  {HORAS_12.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
                <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#5f6368', fontSize:10 }}>▼</span>
              </div>
              <div style={{ position:'relative', flex:1 }}>
                <select value={horaSel.m} onChange={e=>setHoraSel(hs=>({...hs,m:e.target.value}))} style={{ ...s.input, paddingRight:24, WebkitAppearance:'none', appearance:'none', cursor:'pointer' }}>
                  <option value="">Min</option>
                  {MINUTOS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
                <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#5f6368', fontSize:10 }}>▼</span>
              </div>
              <div style={{ position:'relative', flex:1 }}>
                <select value={horaSel.ampm} onChange={e=>setHoraSel(hs=>({...hs,ampm:e.target.value}))} style={{ ...s.input, paddingRight:24, WebkitAppearance:'none', appearance:'none', cursor:'pointer' }}>
                  <option value="">–</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
                <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#5f6368', fontSize:10 }}>▼</span>
              </div>
            </div>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Datos de entrega</div>
          <div style={{ marginBottom:18 }}>
            <label style={s.label}>Nombre de contacto <span style={{color:'#d93025'}}>*</span></label>
            <p style={{ fontSize:12.5, color:'#7d5a00', fontWeight:600, marginBottom:6, lineHeight:1.3 }}>IMPORTANTE NOMBRE DE CONTACTO PARA LA ENTREGA</p>
            <input style={s.input} type="text" name="nombre_contacto" value={form.nombre_contacto} onChange={handleChange} placeholder="Persona que recibe el pedido" />
          </div>
          <div style={{ marginBottom:18 }}>
            <label style={s.label}>Teléfono de contacto <span style={{color:'#d93025'}}>*</span></label>
            <input style={s.input} type="tel" name="telefono" value={form.telefono} onChange={handleTelefono} placeholder="3001234567" inputMode="numeric" maxLength={10} />
            <p style={{ fontSize:12.5, color:'#9aa0a6', marginTop:5 }}>{form.telefono.length}/10 dígitos</p>
          </div>
          <div>
            <label style={s.label}>Dirección de entrega <span style={{color:'#d93025'}}>*</span></label>
            <input style={s.input} type="text" name="direccion" value={form.direccion} onChange={handleChange} placeholder="Calle, carrera, barrio e indicaciones" />
            <p style={{ fontSize:12.5, color:'#9aa0a6', marginTop:5, lineHeight:1.4 }}>Valida que la dirección esté bien escrita y al final puedes darnos indicaciones del lugar</p>
          </div>
        </div>

        {selected.length > 0 && (
          <div style={{ background:'#fff', border:'1.5px solid #ceead6', borderRadius:8, padding:16, marginBottom:16 }}>
            <div style={{ fontSize:15, fontWeight:600, color:'#1e7e34', marginBottom:10 }}>📋 Resumen de tu pedido</div>
            {selected.map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f1f3f4', fontSize:15 }}>
                <span style={{ color:'#3c4043' }}>{p.nombre}</span>
                <span style={{ background:'#e6f4ea', color:'#1e7e34', fontWeight:500, fontSize:13, padding:'3px 10px', borderRadius:999 }}>{qtys[p.id]} und</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, paddingTop:10, borderTop:'1.5px solid #ceead6', fontSize:16, fontWeight:600, color:'#3c4043' }}>
              <span>Total unidades</span><span>{totalUnd} und</span>
            </div>
          </div>
        )}

        <div style={{ background:'#fef9e7', border:'1px solid #fce8a2', borderRadius:8, padding:'14px 16px', marginBottom:16, fontSize:15, color:'#7d5a00', lineHeight:1.7 }}>
          <div style={{ fontWeight:600, marginBottom:6 }}>Por favor revisa que toda la información esté bien antes de enviar</div>
          <div>📌 El valor de la compra debe estar cancelado al momento de la entrega.</div>
          <div>📌 Si no vas a consumir todo el producto el mismo día (natilla o manjar) lo debes refrigerar.</div>
        </div>

        <div style={{ background:'#fdecea', border:'1.5px solid #f5b7b1', borderRadius:8, padding:'14px 16px', marginBottom:16, fontSize:15, color:'#a13c30', lineHeight:1.6 }}>
          Si vas a cancelar o modificar tu pedido, debes comunicarte <strong>telefónicamente</strong> e informar <strong>con anticipación</strong>. <strong>En caso de no recibir la notificación a tiempo, el pedido será facturado.</strong>
        </div>

        <button onClick={enviar} disabled={sending} style={{ width:'100%', padding:16, background:'#1e7e34', color:'#fff', border:'none', borderRadius:8, fontSize:17, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, letterSpacing:'.02em' }}>
          {sending ? 'ENVIANDO...' : 'CONFIRMACIÓN DE PEDIDO'}
        </button>
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #e0e0e0', padding:'10px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, boxShadow:'0 -2px 8px rgba(0,0,0,.06)', zIndex:100 }}>
        <div style={{ flex:1, minWidth:0 }}>
          {selected.length === 0 ? <span style={{ fontSize:15, color:'#9aa0a6' }}>Selecciona productos para continuar</span> : (
            <>
              <div style={{ fontSize:15, fontWeight:500, color:'#3c4043' }}>{selected.length} producto{selected.length>1?'s':''} · {totalUnd} unidades</div>
              <div style={{ fontSize:13, color:'#9aa0a6', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selected.map(p=>p.nombre.split(' ').slice(0,2).join(' ')+'×'+qtys[p.id]).join(' · ')}</div>
            </>
          )}
        </div>
        <button disabled={!selected.length} onClick={() => document.querySelector('[data-resumen]')?.scrollIntoView({behavior:'smooth'})} style={{ background: selected.length?'#1e7e34':'#dadce0', color:'#fff', border:'none', borderRadius:999, padding:'10px 20px', fontSize:15, fontWeight:500, cursor:selected.length?'pointer':'default', whiteSpace:'nowrap', flexShrink:0 }}>
          Ver resumen →
        </button>
      </div>
    </div>
  );
}
