import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const ACCESS = process.env.REACT_APP_ACCESS_CODE || '3195122754';

  const ingresar = () => {
    if (code === ACCESS) { setError(false); onLogin(); }
    else { setError(true); setCode(''); }
  };

  return (
    <div style={{ background: '#eeeff1', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '36px 28px', width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, background: '#1e7e34', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍮</div>
          <span style={{ fontSize: 18, fontWeight: 400, color: '#3c4043' }}>Natilla Medellín</span>
        </div>
        <p style={{ fontSize: 12, color: '#9aa0a6', marginBottom: 28 }}>Panel de administración</p>
        <p style={{ fontSize: 14, color: '#3c4043', marginBottom: 4 }}>Acceso privado</p>
        <p style={{ fontSize: 12, color: '#9aa0a6', marginBottom: 20 }}>Ingresa tu código de acceso</p>

        <div style={{ marginBottom: 16, textAlign: 'left' }}>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 5 }}>Código de acceso</label>
          <input
            type="password"
            value={code}
            onChange={e => { setCode(e.target.value); setError(false); }}
            onKeyDown={e => e.key === 'Enter' && ingresar()}
            placeholder="Escribe tu código"
            style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${error ? '#d93025' : '#dadce0'}`, borderRadius: 6, fontSize: 15, color: '#3c4043', outline: 'none', background: '#fff', textAlign: 'center', letterSpacing: '.15em' }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < Math.min(code.length, 5) ? '#1e7e34' : '#e8eaed', transition: 'background .2s' }} />
          ))}
        </div>

        <button onClick={ingresar} style={{ width: '100%', padding: 13, background: '#1e7e34', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Ingresar
        </button>

        {error && <div style={{ marginTop: 12, fontSize: 13, color: '#d93025', background: '#fce8e6', padding: '9px 12px', borderRadius: 6 }}>Código incorrecto. Intenta de nuevo.</div>}
        <p style={{ fontSize: 11, color: '#bdc1c6', marginTop: 16 }}>Solo personal autorizado</p>
      </div>
    </div>
  );
}
