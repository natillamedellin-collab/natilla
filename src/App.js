import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { List, CreditCard, Settings, Menu, X, LogOut } from 'lucide-react';
import Login from './pages/Login';
import Pedidos from './pages/Pedidos';
import Pagos from './pages/Pagos';
import Configuracion from './pages/Configuracion';
import Formulario from './pages/Formulario';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App crash:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#fff3f3', minHeight: '100vh' }}>
          <h2 style={{ color: '#d93025' }}>⚠️ Error en la aplicación</h2>
          <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{String(this.state.error.message || this.state.error)}</p>
          <pre style={{ marginTop: 16, fontSize: 11, color: '#888', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const NAV = [
  { to: '/panel/pedidos', icon: List, label: 'Pedidos' },
  { to: '/panel/pagos', icon: CreditCard, label: 'Pagos y Recaudos' },
  { to: '/panel/configuracion', icon: Settings, label: 'Configuración' },
];

function NavLinks({ onNavigate }) {
  return (
    <>
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Icon size={16} /><span>{label}</span>
        </NavLink>
      ))}
    </>
  );
}

function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🍮</div>
        <div>
          <div className="sidebar-logo-name">Natilla Medellín</div>
          <div className="sidebar-logo-sub">Panel interno</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <NavLinks />
      </nav>
      <div className="sidebar-footer">
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function Panel({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Cierra el menú móvil automáticamente al cambiar de ruta
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <div className="shell">
      <Sidebar onLogout={onLogout} />

      <div className="topbar-mobile">
        <span className="topbar-mobile-title">🍮 Natilla Medellín</span>
        <button className="topbar-mobile-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
          <Menu size={24} />
        </button>
      </div>

      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }} onClick={() => setMenuOpen(false)} />
          <nav style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 230, background: '#1a5c2a', padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 16px' }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>🍮 Natilla Medellín</span>
              <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <NavLinks onNavigate={() => setMenuOpen(false)} />
            <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '10px 10px', marginTop: 12 }}>
              <LogOut size={14} /> Cerrar sesión
            </button>
          </nav>
        </div>
      )}

      <main className="main">
        <Routes>
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="pagos" element={<Pagos />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="*" element={<Navigate to="pedidos" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem('nm_auth') === '1');
  const login = () => { sessionStorage.setItem('nm_auth', '1'); setAuth(true); };
  const logout = () => { sessionStorage.removeItem('nm_auth'); setAuth(false); };

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/pedido" element={<Formulario />} />
          <Route path="/login" element={auth ? <Navigate to="/panel/pedidos" replace /> : <Login onLogin={login} />} />
          <Route path="/panel/*" element={auth ? <Panel onLogout={logout} /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/pedido" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
