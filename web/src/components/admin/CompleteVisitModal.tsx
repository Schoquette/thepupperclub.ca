import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface CompleteVisitModalProps {
  appointmentId: number | null;
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

/** Shared by CalendarPage and DashboardPage so "Complete Visit" opens
 *  this modal in place rather than navigating to the Calendar page. */
export function CompleteVisitModal({ appointmentId, open, onClose, onCompleted }: CompleteVisitModalProps) {
  const navigate = useNavigate();
  const [reportForm, setReportForm] = useState({ distance_km: '', notes: '' });
  const [mileageFrom, setMileageFrom] = useState('');
  const [completeError, setCompleteError] = useState('');

  useEffect(() => {
    if (!open || !appointmentId) return;
    setReportForm({ distance_km: '', notes: '' });
    setMileageFrom('');
    setCompleteError('');
    api.get(`/admin/time-mileage/appointment/${appointmentId}`)
      .then(res => {
        setReportForm(f => ({ ...f, distance_km: String(res.data.data.distance_km) }));
        setMileageFrom(res.data.data.from || '');
      })
      .catch(() => {}); // silently fail if Maps not configured
  }, [open, appointmentId]);

  const complete = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {};
      if (reportForm.distance_km) payload.distance_km = reportForm.distance_km;
      if (reportForm.notes) payload.notes = reportForm.notes;
      return api.post(`/admin/appointments/${appointmentId}/complete`, payload);
    },
    onSuccess: () => {
      setCompleteError('');
      onCompleted();
    },
    onError: (err: any) => { setCompleteError(err.response?.data?.message || 'Failed to complete visit.'); },
  });

  return (
    <Modal open={open} onClose={onClose} title="Complete Visit" size="md">
      {appointmentId && (
        <div className="space-y-4">
          <div>
            <label className="label">Mileage (km)</label>
            <input type="number" step="0.1" className="input" value={reportForm.distance_km}
              placeholder="e.g. 3.5"
              onChange={e => setReportForm(f => ({ ...f, distance_km: e.target.value }))} />
            {mileageFrom && (
              <p className="text-xs text-taupe mt-1">Auto-calculated from: {mileageFrom}</p>
            )}
          </div>
          <div>
            <label className="label">Internal Notes</label>
            <textarea rows={3} className="input resize-none" value={reportForm.notes}
              placeholder="Notes visible only to you…"
              onChange={e => setReportForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {completeError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{completeError}</p>
          )}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                navigate(`/admin/report-cards/new?appointment_id=${appointmentId}`);
              }}
            >
              Write Report Card
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                loading={complete.isPending}
                onClick={() => complete.mutate()}
              >
                Complete Visit
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
