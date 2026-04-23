import { useState, useCallback, useEffect } from 'react';

let toastFn = null;

export function useToast() {
  return useCallback((msg, type = 'success') => {
    if (toastFn) toastFn(msg, type);
  }, []);
}

export function ToastContainer() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    toastFn = (msg, type) => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 2400);
    };
    return () => { toastFn = null; };
  }, []);

  if (!toast) return null;
  const bg = toast.type === 'error' ? 'bg-red text-white' : 'bg-lime text-bg';
  return (
    <div className={`fixed bottom-6 right-6 z-[999] px-5 py-3 rounded font-condensed font-bold text-sm tracking-widest uppercase shadow-xl transition-all ${bg}`}>
      {toast.msg}
    </div>
  );
}
