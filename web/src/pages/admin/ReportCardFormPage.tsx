import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

interface TemplateItem {
  key: string;
  label: string;
  enabled: boolean;
}

function buildFormData(fields: {
  userId?: string;
  appointmentId?: string;
  arrivalTime?: string;
  departureTime?: string;
  checks?: Record<string, boolean>;
  specialTripDetails?: string;
  notes?: string;
  photo?: File | null;
}) {
  const fd = new FormData();
  if (fields.userId) fd.append('user_id', fields.userId);
  if (fields.appointmentId) fd.append('appointment_id', fields.appointmentId);
  if (fields.arrivalTime) fd.append('arrival_time', fields.arrivalTime);
  if (fields.departureTime) fd.append('departure_time', fields.departureTime);
  if (fields.checks) {
    Object.entries(fields.checks).forEach(([key, val]) => {
      fd.append(`checklist[${key}]`, val ? '1' : '0');
    });
  }
  if (fields.specialTripDetails) fd.append('special_trip_details', fields.specialTripDetails);
  if (fields.notes) fd.append('notes', fields.notes);
  if (fields.photo) fd.append('photo', fields.photo);
  return fd;
}

export default function AdminReportCardFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = id === 'new';
  const fileRef = useRef<HTMLInputElement>(null);

  const [clientId, setClientId] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [specialTripDetails, setSpecialTripDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateItem[]>([]);
  const [error, setError] = useState('');

  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-list'],
    queryFn: () => api.get('/admin/clients').then((r) => r.data.data ?? []),
  });

  // Load appointments for the selected client so we can link one report per visit
  const { data: appointmentsData } = useQuery({
    queryKey: ['admin-appointments-for-client', clientId],
    queryFn: () =>
      api
        .get('/admin/appointments', { params: { user_id: clientId } })
        .then((r) => r.data.data ?? []),
    enabled: !!clientId,
  });

  const { data: templateData } = useQuery({
    queryKey: ['report-template', clientId],
    queryFn: () =>
      api.get(`/admin/clients/${clientId}/report-template`).then((r) => r.data.data),
    enabled: !!clientId,
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['admin-report-card', id],
    queryFn: () => api.get(`/admin/report-cards/${id}`).then((r) => r.data.data),
    enabled: !isNew,
  });

  // Pre-fill form when report loads
  useEffect(() => {
    if (!report) return;
    setClientId(String(report.user_id ?? ''));
    setAppointmentId(report.appointment_id ? String(report.appointment_id) : '');
    setArrivalTime(
      report.arrival_time
        ? format(new Date(report.arrival_time), "yyyy-MM-dd'T'HH:mm")
        : ''
    );
    setDepartureTime(
      report.departure_time
        ? format(new Date(report.departure_time), "yyyy-MM-dd'T'HH:mm")
        : ''
    );
    setSpecialTripDetails(report.special_trip_details ?? '');
    setNotes(report.notes ?? '');
  }, [report?.id]); // eslint-disable-line

  // Init template items + checks when template or report changes
  useEffect(() => {
    if (!templateData) return;
    setTemplateItems(templateData);
    setTemplateDraft(templateData);
    const initial: Record<string, boolean> = {};
    templateData.forEach((item: TemplateItem) => {
      initial[item.key] = !!(report?.checklist?.[item.key]);
    });
    setChecks(initial);
  }, [templateData, report?.id]); // eslint-disable-line

  // Load existing photo
  useEffect(() => {
    if (isNew || !report?.report_photo_path) return;
    let url = '';
    api
      .get(`/admin/report-cards/${id}/photo`, { responseType: 'blob' })
      .then((r) => {
        url = URL.createObjectURL(r.data);
        setExistingPhotoUrl(url);
      })
      .catch(() => {});
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, report?.report_photo_path]); // eslint-disable-line

  // Photo preview blob
  useEffect(() => {
    if (!photo) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const activePhoto = photoPreview ?? existingPhotoUrl;

  const enabledItems = templateItems.filter((i) => i.enabled);
  const isSent = !isNew && !!report?.sent_at;

  const createReport = useMutation({
    mutationFn: () => {
      const fd = buildFormData({
        userId: clientId,
        appointmentId: appointmentId || undefined,
        arrivalTime: arrivalTime || undefined,
        departureTime: departureTime || undefined,
        checks,
        specialTripDetails: specialTripDetails || undefined,
        notes: notes || undefined,
        photo,
      });
      return api.post('/admin/report-cards', fd);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-report-cards'] });
      navigate(`/admin/report-cards/${res.data.data.id}`);
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to save.'),
  });

  const updateReport = useMutation({
    mutationFn: () => {
      const fd = buildFormData({
        arrivalTime: arrivalTime || undefined,
        departureTime: departureTime || undefined,
        checks,
        specialTripDetails: specialTripDetails || undefined,
        notes: notes || undefined,
        photo,
      });
      return api.post(`/admin/report-cards/${id}`, fd);
    },
    onSuccess: () => {
      setPhoto(null);
      qc.invalidateQueries({ queryKey: ['admin-report-cards'] });
      qc.invalidateQueries({ queryKey: ['admin-report-card', id] });
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to save.'),
  });

  const sendReport = useMutation({
    mutationFn: async () => {
      if (photo) {
        const fd = buildFormData({ photo });
        await api.post(`/admin/report-cards/${id}`, fd);
      }
      return api.post(`/admin/report-cards/${id}/send`);
    },
    onSuccess: () => {
      setPhoto(null);
      qc.invalidateQueries({ queryKey: ['admin-report-cards'] });
      qc.invalidateQueries({ queryKey: ['admin-report-card', id] });
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to send.'),
  });

  const deleteReport = useMutation({
    mutationFn: () => api.delete(`/admin/report-cards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-report-cards'] });
      navigate('/admin/report-cards');
    },
  });

  const deletePhoto = useMutation({
    mutationFn: () => api.delete(`/admin/report-cards/${id}/photo`),
    onSuccess: () => {
      setExistingPhotoUrl(null);
      qc.invalidateQueries({ queryKey: ['admin-report-card', id] });
    },
  });

  const saveTemplate = useMutation({
    mutationFn: () =>
      api.put(`/admin/clients/${clientId}/report-template`, { items: templateDraft }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-template', clientId] });
      setShowTemplateModal(false);
    },
  });

  const resetTemplate = useMutation({
    mutationFn: () => api.delete(`/admin/clients/${clientId}/report-template`),
    onSuccess: (res) => {
      const defaults = res.data.data;
      setTemplateItems(defaults);
      setTemplateDraft(defaults);
      qc.invalidateQueries({ queryKey: ['report-template', clientId] });
      setShowTemplateModal(false);
    },
  });

  if (!isNew && isLoading) return <PageLoader />;

  const toggleTemplateItem = (key: string) =>
    setTemplateDraft((prev) =>
      prev.map((i) => (i.key === key ? { ...i, enabled: !i.enabled } : i))
    );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/report-cards')} className="text-taupe hover:text-espresso">
          ←
        </button>
        <h1 className="page-title text-xl flex-1">
          {isNew ? 'New Report Card' : isSent ? 'Report Card' : 'Edit Report Card'}
        </h1>
        {!isNew && !isSent && (
          <button
            onClick={() => deleteReport.mutate()}
            className="text-xs text-red-400 hover:text-red-600 underline"
          >
            Delete
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg">{error}</div>
      )}

      <Card>
        {/* Client picker (new only) */}
        {isNew && (
          <div className="mb-4">
            <Select
              label="Client"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setAppointmentId(''); setArrivalTime(''); setDepartureTime(''); }}
              options={[
                { value: '', label: 'Select a client…' },
                ...(clientsData ?? []).map((c: any) => ({
                  value: String(c.id),
                  label: c.name,
                })),
              ]}
            />
          </div>
        )}

        {/* Appointment picker — one report card per visit */}
        {isNew && clientId && (
          <div className="mb-5">
            <Select
              label="Visit / Appointment"
              value={appointmentId}
              onChange={(e) => {
                setAppointmentId(e.target.value);
                // Auto-fill arrival time from the appointment's scheduled time
                if (e.target.value) {
                  const appt = (appointmentsData ?? []).find(
                    (a: any) => String(a.id) === e.target.value
                  );
                  if (appt?.scheduled_time) {
                    setArrivalTime(format(new Date(appt.scheduled_time), "yyyy-MM-dd'T'HH:mm"));
                  }
                }
              }}
              options={[
                { value: '', label: appointmentsData ? 'Select a visit…' : 'Loading…' },
                ...(appointmentsData ?? []).map((a: any) => ({
                  value: String(a.id),
                  label: `${format(new Date(a.scheduled_time), 'EEE MMM d, h:mm a')} — ${a.service_type.replace(/_/g, ' ')}`,
                })),
              ]}
            />
          </div>
        )}

        {/* Read-only appointment info on existing reports */}
        {!isNew && report?.appointment && (
          <div className="mb-4 text-xs text-taupe bg-cream rounded-lg px-3 py-2">
            Visit: {format(new Date(report.appointment.scheduled_time), 'EEEE, MMM d, h:mm a')}
            {' '}— {report.appointment.service_type?.replace(/_/g, ' ')}
          </div>
        )}

        {!isNew && (
          <div className="mb-4 flex items-center justify-between">
            <div className="font-semibold text-espresso">{report?.user?.name}</div>
            {isSent && report?.sent_at && (
              <div className="text-xs text-taupe">
                Sent {format(new Date(report.sent_at), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        )}

        {/* Template customization */}
        {clientId && !isSent && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => {
                setTemplateDraft(templateItems);
                setShowTemplateModal(true);
              }}
              className="text-xs text-taupe hover:text-espresso underline"
            >
              Customize checklist template
            </button>
          </div>
        )}

        {/* Photo */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Photo</div>
          {activePhoto ? (
            <div className="relative">
              <img
                src={activePhoto}
                alt="Visit photo"
                className="w-full max-h-64 object-cover rounded-xl"
              />
              {!isSent && (
                <button
                  onClick={() => {
                    setPhoto(null);
                    if (!isNew && existingPhotoUrl) deletePhoto.mutate();
                  }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-black/80"
                >
                  ×
                </button>
              )}
            </div>
          ) : (
            !isSent && (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-taupe/30 rounded-xl py-10 text-taupe text-sm hover:border-gold hover:text-gold transition-colors"
              >
                📷 Add visit photo
              </button>
            )
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Input
            label="Arrival Time"
            type="datetime-local"
            step={900}
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            disabled={isSent}
          />
          <Input
            label="Departure Time"
            type="datetime-local"
            step={900}
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            disabled={isSent}
          />
        </div>

        {/* Checklist */}
        {enabledItems.length > 0 ? (
          <div className="mb-5">
            <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-3">
              Activities & Care
            </div>
            <div className="grid grid-cols-2 gap-2">
              {enabledItems.map((item) => (
                <label
                  key={item.key}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-colors ${
                    isSent ? 'cursor-default' : 'cursor-pointer hover:bg-gold/5'
                  } ${
                    checks[item.key]
                      ? 'bg-gold/10 border border-gold/30'
                      : 'bg-cream border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!checks[item.key]}
                    onChange={() =>
                      !isSent && setChecks((p) => ({ ...p, [item.key]: !p[item.key] }))
                    }
                    className="accent-gold"
                    disabled={isSent}
                  />
                  <span className="text-sm text-espresso">{item.label}</span>
                </label>
              ))}
            </div>

            {/* Special trip text */}
            {enabledItems.find((i) => i.key === 'special_trip') && checks.special_trip && !isSent && (
              <div className="mt-3">
                <Input
                  label="Special trip details"
                  value={specialTripDetails}
                  onChange={(e) => setSpecialTripDetails(e.target.value)}
                  placeholder="e.g. Off-leash park, beach visit…"
                />
              </div>
            )}
            {isSent && report?.special_trip_details && (
              <div className="mt-3 text-sm text-taupe bg-gold/5 border border-gold/20 rounded-lg px-3 py-2">
                <span className="font-semibold text-gold">Special Trip: </span>
                {report.special_trip_details}
              </div>
            )}
          </div>
        ) : (
          clientId && !templateData && (
            <div className="text-sm text-taupe mb-5 italic">Loading checklist…</div>
          )
        )}

        {/* Notes */}
        <div className="mb-5">
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="How did the visit go? Any observations for the client…"
            disabled={isSent}
          />
        </div>

        {/* Action buttons */}
        {!isSent && (
          <div className="flex gap-3 justify-end pt-2 border-t border-cream">
            {isNew ? (
              <Button
                loading={createReport.isPending}
                disabled={!clientId}
                onClick={() => { setError(''); createReport.mutate(); }}
              >
                Save Draft
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  loading={updateReport.isPending}
                  onClick={() => { setError(''); updateReport.mutate(); }}
                >
                  Save Draft
                </Button>
                <Button
                  loading={sendReport.isPending}
                  onClick={() => { setError(''); sendReport.mutate(); }}
                >
                  Send to Client
                </Button>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Template customization modal */}
      <Modal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="Customize Checklist Template"
      >
        <p className="text-xs text-taupe mb-4">
          Toggle items on/off for this client's report cards. Changes apply to future reports.
        </p>
        <div className="space-y-1 mb-5">
          {templateDraft.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between py-2.5 border-b border-cream"
            >
              <span className="text-sm text-espresso">{item.label}</span>
              <button
                onClick={() => toggleTemplateItem(item.key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  item.enabled ? 'bg-gold' : 'bg-taupe/30'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    item.enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => resetTemplate.mutate()}
            className="text-xs text-taupe hover:text-espresso underline"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTemplateModal(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saveTemplate.isPending} onClick={() => saveTemplate.mutate()}>
              Save Template
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
