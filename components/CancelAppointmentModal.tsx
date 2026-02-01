import React, { useState } from 'react';
import { X, AlertTriangle, Calendar } from 'lucide-react';
import { Appointment } from '../types';
import { apiAppointments } from '../services/api';

interface CancelAppointmentModalProps {
  appointment: Appointment;
  onClose: () => void;
  onSuccess: () => void;
}

export const CancelAppointmentModal: React.FC<CancelAppointmentModalProps> = ({
  appointment,
  onClose,
  onSuccess
}) => {
  const [cancellationReason, setCancellationReason] = useState('');
  const [wasRescheduled, setWasRescheduled] = useState(false);
  const [rescheduledNotes, setRescheduledNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cancellationReason.trim()) {
      setError('Por favor, informe o motivo do cancelamento');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await apiAppointments.cancelWithReason(
        appointment.id,
        cancellationReason.trim(),
        'operator',
        wasRescheduled,
        rescheduledNotes.trim() || undefined
      );

      if (updateError) {
        setError(updateError);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar agendamento');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Cancelar Agendamento
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {appointment.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Motivo do Cancelamento */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Motivo do cancelamento <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              placeholder="Ex: Cliente solicitou cancelamento, conflito de agenda..."
              disabled={isSaving}
            />
            <p className="text-xs text-slate-500 mt-1">
              Este motivo ficará registrado no histórico do agendamento
            </p>
          </div>

          {/* Foi Reagendado? */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={wasRescheduled}
                onChange={(e) => setWasRescheduled(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                disabled={isSaving}
              />
              <div className="flex-1">
                <span className="text-sm font-semibold text-slate-700">
                  Cliente reagendou para outra data
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Marque se o cliente já agendou em novo horário
                </p>
              </div>
            </label>

            {/* Notas do Reagendamento */}
            {wasRescheduled && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Informações do novo agendamento (opcional)
                </label>
                <textarea
                  value={rescheduledNotes}
                  onChange={(e) => setRescheduledNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Ex: Reagendado para 15/03 às 14h"
                  disabled={isSaving}
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isSaving || !cancellationReason.trim()}
              className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
