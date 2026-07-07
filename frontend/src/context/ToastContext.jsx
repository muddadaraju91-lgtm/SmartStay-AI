import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

// ─── Individual Toast Item ─────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }) {
    const [visible, setVisible] = useState(false);

    // Trigger enter animation on mount
    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const handleDismiss = () => {
        setVisible(false);
        // Wait for the exit transition before removing from DOM
        setTimeout(() => onDismiss(toast.id), 300);
    };

    // Auto-dismiss
    useEffect(() => {
        const timer = setTimeout(handleDismiss, toast.duration ?? 4000);
        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const variants = {
        success: {
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
            border: 'border-emerald-500/25',
            accent: 'bg-emerald-500/10',
            shadow: 'shadow-emerald-900/30',
        },
        error: {
            icon: <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />,
            border: 'border-red-500/25',
            accent: 'bg-red-500/10',
            shadow: 'shadow-red-900/30',
        },
        info: {
            icon: <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />,
            border: 'border-blue-500/25',
            accent: 'bg-blue-500/10',
            shadow: 'shadow-blue-900/30',
        },
    };

    const v = variants[toast.type] ?? variants.info;

    return (
        <div
            role="alert"
            aria-live="assertive"
            style={{
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateX(0)' : 'translateX(40px)',
            }}
            className={[
                'glass-panel rounded-xl px-4 py-3.5 flex items-start gap-3',
                'min-w-[280px] max-w-[360px]',
                'shadow-lg',
                v.border, v.accent, v.shadow,
            ].join(' ')}
        >
            {v.icon}
            <p className="flex-1 text-sm text-slate-200 leading-snug">{toast.message}</p>
            <button
                onClick={handleDismiss}
                aria-label="Dismiss notification"
                className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

// ─── Toast Stack Container ─────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
    return (
        <div
            aria-label="Notifications"
            className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 items-end pointer-events-none"
        >
            {toasts.map((t) => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem toast={t} onDismiss={onDismiss} />
                </div>
            ))}
        </div>
    );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
let _nextId = 1;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const show = useCallback((message, type = 'info', duration = 4000) => {
        const id = _nextId++;
        setToasts((prev) => [...prev, { id, message, type, duration }]);
    }, []);

    const toast = {
        success: (msg, dur) => show(msg, 'success', dur),
        error:   (msg, dur) => show(msg, 'error',   dur),
        info:    (msg, dur) => show(msg, 'info',    dur),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}
