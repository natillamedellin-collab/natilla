import { useState, useCallback } from 'react';
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type='success') => {
    const id = Date.now();
    setToasts(t => [...t, {id, msg, type}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  const ToastContainer = () => (
    <div style={{position:'fixed',bottom:20,right:20,zIndex:9999,display:'flex',flexDirection:'column',gap:8}}>
      {toasts.map(t => (
        <div key={t.id} style={{padding:'10px 16px',borderRadius:6,fontSize:13,fontWeight:500,color:'#fff',background:t.type==='error'?'#d93025':'#1e7e34',boxShadow:'0 2px 8px rgba(0,0,0,.15)'}}>
          {t.msg}
        </div>
      ))}
    </div>
  );
  return { toast, ToastContainer };
}
