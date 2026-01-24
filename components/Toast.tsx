import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { AppNotification } from '../types';

interface ToastProps {
    notification: AppNotification;
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ notification, onClose }) => {
    useEffect(() => {
        // Auto-fechar após 5 segundos
        const timer = setTimeout(() => {
            onClose();
        }, 5000);

        return () => clearTimeout(timer);
    }, [onClose]);

    const getIcon = () => {
        switch (notification.type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-rose-500" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            default:
                return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    const getBackgroundColor = () => {
        switch (notification.type) {
            case 'success':
                return 'bg-green-50 border-green-200';
            case 'error':
                return 'bg-rose-50 border-rose-200';
            case 'warning':
                return 'bg-amber-50 border-amber-200';
            default:
                return 'bg-blue-50 border-blue-200';
        }
    };

    return (
        <div
            className={`fixed top-20 right-4 z-[9999] max-w-md w-full ${getBackgroundColor()} border rounded-lg shadow-lg p-4 animate-in slide-in-from-right-5 fade-in duration-300`}
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                        {notification.title}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                        {notification.message}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
