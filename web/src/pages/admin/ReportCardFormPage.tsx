import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format, addMinutes } from 'date-fns';

interface TemplateItem {
  key: string;
  label: string;
  enabled: boolean;
}

interface DogSection {
  checklist: Record<string, boolean>;
  notes: string;
}

// Key used when no specific dogs are selected (single-section mode)
const GENERAL_KEY = '_general';

function buildFormData(fields: {
  userId?: string;
  dogIds?: number[];
  appointmentId?: string;
  arrivalTime?: string;
  departureTime?: string;
  dogData?: Record<string, DogSection>;
  specialTripDetails?: string;
  photos?: File[];
}) {
  const fd = new FormData();
  if (fields.userId) fd.append('user_id', fields.userId);
  if (fields.dogIds?.length) {
    fields.dogIds.forEach(id => fd.append('dog_ids[]', String(id)));
  }
  if (fields.appointmentId) fd.append('appointment_id', fields.appointmentId);
  if (fields.arrivalTime) fd.append('arrival_time', fields.arrivalTime);
  if (fields.departureTime) fd.append('departure_time', fields.departureTime);
  if (fields.specialTripDetails) fd.append('special_trip_details', fields.specialTripDetails);
  if (fields.dogData) {
    // Send per-dog data as JSON string
    fd.append('dog_data', JSON.stringify(fields.dogData));
    // Also send flat checklist + notes for backward compat (merge all dogs)
    const mergedChecklist: Record<string, boolean> = {};
    const mergedNotes: string[] = [];
    Object.values(fields.dogData).forEach(section => {
      Object.entries(section.checklist).forEach(([k, v]) => {
        if (v) mergedChecklist[k] = true;
      });
      if (section.notes.trim()) mergedNotes.push(section.notes.trim());
    });
    Object.entries(mergedChecklist).forEach(([key, val]) => {
      fd.append(`checklist[${key}]`, val ? '1' : '0');
    });
    if (mergedNotes.length) fd.append('notes', mergedNotes.join('\n\n'));
  }
  if (fields.photos?.length) {
    fields.photos.forEach(p => fd.append('photos[]', p));
  }
  return fd;
}

export default function AdminReportCardFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !id;
  const fileRef = useRef<HTMLInputElement>(null);

  const [clientId, setClientId] = useState('');
  const [dogIds, setDogIds] = useState<number[]>([]);
  const [appointmentId, setAppointmentId] = useState('');
  const [saved, setSaved] = useState(false);
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [dogData, setDogData] = useState<Record<string, DogSection>>({});
  const [specialTripDetails, setSpecialTripDetails] = useState('');
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  const [existingPhotoCount, setExistingPhotoCount] = useState(0);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateItem[]>([]);
  const [error, setError] = useState('');

  // Pre-fill from query params (e.g. ?appointment_id=5 from calendar)
  const qsAppointmentId = searchParams.get('appointment_id');
  const { data: qsAppointment } = useQuery({
    queryKey: ['admin-appointment', qsAppointmentId],
    queryFn: () => api.get(`/admin/appointments/${qsAppointmentId}`).then(r => r.data.data),
    enabled: isNew && !!qsAppointmentId,
  });

  useEffect(() => {
    if (!qsAppointment || !isNew) return;
    setClientId(String(qsAppointment.user_id));
    setAppointmentId(String(qsAppointment.id));
    if (qsAppointment.scheduled_time) {
      const start = new Date(qsAppointment.scheduled_time);
      setArrivalTime(format(start, "yyyy-MM-dd'T'HH:mm"));
      if (qsAppointment.duration_minutes) {
        setDepartureTime(format(addMinutes(start, qsAppointment.duration_minutes), "yyyy-MM-dd'T'HH:mm"));
      }
    }
    if (qsAppointment.dogs?.length) {
      setDogIds(qsAppointment.dogs.map((d: any) => d.id));
    }
  }, [qsAppointment?.id]); // eslint-disable-line

  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-list'],
    queryFn: () => api.get('/admin/clients').then((r) => r.data.data ?? []),
  });

  const { data: appointmentsData } = useQuery({
    queryKey: ['admin-appointments-for-client', clientId],
    queryFn: () =>
      api.get('/admin/appointments', { params: { user_id: clientId } }).then((r) => r.data.data ?? []),
    enabled: !!clientId,
  });

  const { data: clientDetail } = useQuery({
    queryKey: ['admin-client-detail', clientId],
    queryFn: () => api.get(`/admin/clients/${clientId}`).then(r => r.data.data),
    enabled: !!clientId,
  });
  const clientDogs: { id: number; name: string }[] = clientDetail?.dogs ?? [];

  const DEFAULT_CHECKLIST: TemplateItem[] = [
    { key: 'no_1', label: 'No. 1', enabled: true },
    { key: 'no_2', label: 'No. 2', enabled: true },
    { key: 'grooming', label: 'Grooming', enabled: true },
    { key: 'indoor_play', label: 'Indoor Play', enabled: true },
    { key: 'outdoor_play', label: 'Outdoor Play', enabled: true },
    { key: 'long_walk', label: 'Long Walk', enabled: true },
    { key: 'socialization', label: 'Socialization', enabled: true },
    { key: 'training', label: 'Training', enabled: true },
    { key: 'water_refill', label: 'Water Refill', enabled: true },
    { key: 'feeding', label: 'Feeding', enabled: true },
    { key: 'medication', label: 'Medication Administration', enabled: true },
  ];

  const { data: templateData } = useQuery({
    queryKey: ['report-template', clientId],
    queryFn: () =>
      api.get(`/admin/clients/${clientId}/report-template`).then((r) => r.data.data).catch(() => DEFAULT_CHECKLIST),
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
      report.arrival_time ? format(new Date(report.arrival_time), "yyyy-MM-dd'T'HH:mm") : ''
    );
    setDepartureTime(
      report.departure_time ? format(new Date(report.departure_time), "yyyy-MM-dd'T'HH:mm") : ''
    );
    setSpecialTripDetails(report.special_trip_details ?? '');
    if (report.dog_ids?.length) setDogIds(report.dog_ids);
  }, [report?.id]); // eslint-disable-line

  // Build initial per-dog sections from template + existing report data
  useEffect(() => {
    const items = templateData ?? DEFAULT_CHECKLIST;
    setTemplateItems(items);
    setTemplateDraft(items);

    const enabledKeys = items.filter((i: TemplateItem) => i.enabled).map((i: TemplateItem) => i.key);

    // Determine which section keys to use
    const sectionKeys = dogIds.length > 0 ? dogIds.map(String) : [GENERAL_KEY];

    const newDogData: Record<string, DogSection> = {};
    sectionKeys.forEach(key => {
      const existingSection = report?.dog_data?.[key];
      const checklist: Record<string, boolean> = {};
      enabledKeys.forEach((k: string) => {
        if (existingSection) {
          checklist[k] = !!existingSection.checklist?.[k];
        } else if (key === GENERAL_KEY && report?.checklist) {
          // Backward compat: load from flat checklist
          checklist[k] = !!report.checklist[k];
        } else {
          checklist[k] = false;
        }
      });
      newDogData[key] = {
        checklist,
        notes: existingSection?.notes ?? (key === GENERAL_KEY ? (report?.notes ?? '') : ''),
      };
    });
    setDogData(newDogData);
  }, [templateData, report?.id, dogIds.join(',')]); // eslint-disable-line

  // Load existing photos
  useEffect(() => {
    if (isNew) return;
    const paths = report?.photo_paths ?? [];
    const count = paths.length || (report?.report_photo_path ? 1 : 0);
    if (count === 0) return;
    setExistingPhotoCount(count);
    const urls: string[] = [];
    let cancelled = false;
    Promise.all(
      Array.from({ length: count }, (_, i) =>
        api.get(`/admin/report-cards/${id}/photos/${i}`, { responseType: 'blob' })
          .then(r => { if (!cancelled) urls[i] = URL.createObjectURL(r.data); })
          .catch(() => {})
      )
    ).then(() => { if (!cancelled) setExistingPhotoUrls(urls.filter(Boolean)); });
    return () => { cancelled = true; urls.forEach(u => u && URL.revokeObjectURL(u)); };
  }, [id, report?.photo_paths?.length, report?.report_photo_path]); // eslint-disable-line

  // New photo previews
  useEffect(() => {
    const urls = newPhotos.map(f => URL.createObjectURL(f));
    setNewPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [newPhotos]);

  const allPhotos = [...existingPhotoUrls, ...newPreviews];
  const enabledItems = templateItems.filter((i) => i.enabled);
  const isSent = !isNew && !!report?.sent_at;
  const [editing, setEditing] = useState(false);

  // Determine section keys for rendering
  const sectionKeys = dogIds.length > 0 ? dogIds.map(String) : [GENERAL_KEY];
  const dogNameMap: Record<string, string> = {};
  clientDogs.forEach(d => { dogNameMap[String(d.id)] = d.name; });

  // Helpers to update per-dog state
  const locked = isSent && !editing;

  const toggleCheck = (sectionKey: string, checkKey: string) => {
    if (locked) return;
    setDogData(prev => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        checklist: {
          ...prev[sectionKey]?.checklist,
          [checkKey]: !prev[sectionKey]?.checklist?.[checkKey],
        },
      },
    }));
  };

  const setDogNotes = (sectionKey: string, value: string) => {
    setDogData(prev => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        notes: value,
      },
    }));
  };

  const fdConfig = { headers: { 'Content-Type': 'multipart/form-data' } };

  const makePayload = (includeCreate = false) => {
    const base: Parameters<typeof buildFormData>[0] = {
      arrivalTime: arrivalTime || undefined,
      departureTime: departureTime || undefined,
      dogData,
      specialTripDetails: specialTripDetails || undefined,
      photos: newPhotos,
    };
    if (includeCreate) {
      base.userId = clientId;
      base.dogIds = dogIds.length ? dogIds : undefined;
      base.appointmentId = appointmentId || undefined;
    }
    return buildFormData(base);
  };

  const createReport = useMutation({
    mutationFn: () => api.post('/admin/report-cards', makePayload(true), fdConfig),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-report-cards'] });
      qc.invalidateQueries({ queryKey: ['admin-report-cards-due'] });
      navigate('/admin/report-cards');
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to save.'),
  });

  const createAndSend = useMutation({
    mutationFn: async () => {
      const res = await api.post('/admin/report-cards', makePayload(true), fdConfig);
      const newId = res.data.data.id;
      await api.post(`/admin/report-cards/${newId}/send`);
      return newId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-report-cards'] });
      qc.invalidateQueries({ queryKey: ['admin-report-cards-due'] });
      navigate('/admin/report-cards');
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to send.'),
  });

  const updateReport = useMutation({
    mutationFn: () => api.post(`/admin/report-cards/${id}`, makePayload(), fdConfig),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setNewPhotos([]);
      qc.invalidateQueries({ queryKey: ['admin-report-cards'] });
      qc.invalidateQueries({ queryKey: ['admin-report-card', id] });
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to save.'),
  });

  const sendReport = useMutation({
    mutationFn: async () => {
      if (newPhotos.length > 0) {
        const fd = buildFormData({ photos: newPhotos });
        await api.post(`/admin/report-cards/${id}`, fd, fdConfig);
      }
      return api.post(`/admin/report-cards/${id}/send`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-report-cards'] });
      qc.invalidateQueries({ queryKey: ['admin-report-cards-due'] });
      navigate('/admin/report-cards');
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to send.'),
  });

  const deleteReport = useMutation({
    mutationFn: () => api.delete(`/admin/report-cards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-report-cards'] });
      navigate('/admin/report-cards');
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to delete report card.'),
  });

  const deletePhoto = useMutation({
    mutationFn: (index: number) => api.delete(`/admin/report-cards/${id}/photos?index=${index}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-report-card', id] });
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to delete photo.'),
  });

  const [templateMsg, setTemplateMsg] = useState('');
  const saveTemplate = useMutation({
    mutationFn: () =>
      api.put(`/admin/clients/${clientId}/report-template`, { items: templateDraft }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-template', clientId] });
      setShowTemplateModal(false);
      setTemplateMsg('Template saved!'); setTimeout(() => setTemplateMsg(''), 2500);
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to save template.'),
  });

  const resetTemplate = useMutation({
    mutationFn: () => api.delete(`/admin/clients/${clientId}/report-template`),
    onSuccess: (res) => {
      const defaults = res.data.data;
      setTemplateItems(defaults);
      setTemplateDraft(defaults);
      qc.invalidateQueries({ queryKey: ['report-template', clientId] });
      setShowTemplateModal(false);
      setTemplateMsg('Template reset to defaults!'); setTimeout(() => setTemplateMsg(''), 2500);
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to reset template.'),
  });

  if (!isNew && isLoading) return <PageLoader />;

  const toggleTemplateItem = (key: string) =>
    setTemplateDraft((prev) =>
      prev.map((i) => (i.key === key ? { ...i, enabled: !i.enabled } : i))
    );

  const isMultiDog = dogIds.length > 1;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-taupe hover:text-espresso text-lg">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-xs text-taupe mb-0.5">
            <a href="/admin/report-cards" onClick={e => { e.preventDefault(); navigate('/admin/report-cards'); }} className="hover:text-espresso hover:underline">Report Cards</a>
            <span>/</span>
            <span className="text-espresso">{isNew ? 'New' : 'Edit'}</span>
          </div>
          <h1 className="page-title text-xl">
            {isNew ? 'New Report Card' : isSent && !editing ? 'Report Card' : 'Edit Report Card'}
          </h1>
        </div>
        {!isNew && !isSent && (
          <button
            onClick={() => deleteReport.mutate()}
            className="text-xs text-red-400 hover:text-red-600 underline"
          >
            Delete
          </button>
        )}
        {isSent && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg">{error}</div>
      )}
      {saved && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg">Saved successfully!</div>
      )}
      {templateMsg && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg font-medium">{templateMsg}</div>
      )}

      <Card>
        {/* Client picker (new only) */}
        {isNew && (
          <div className="mb-4">
            <Select
              label="Client"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setAppointmentId(''); setArrivalTime(''); setDepartureTime(''); setDogIds([]); }}
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

        {/* Dog picker */}
        {clientId && clientDogs.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">
              Dog{clientDogs.length > 1 ? 's' : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              {clientDogs.map((dog) => {
                const selected = dogIds.includes(dog.id);
                return (
                  <button
                    key={dog.id}
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setDogIds((prev) =>
                        selected ? prev.filter((did) => did !== dog.id) : [...prev, dog.id]
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-gold text-white'
                        : 'bg-cream text-espresso hover:bg-gold/20'
                    } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {dog.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Appointment picker */}
        {isNew && clientId && (
          <div className="mb-5">
            <Select
              label="Visit / Appointment"
              value={appointmentId}
              onChange={(e) => {
                setAppointmentId(e.target.value);
                if (e.target.value) {
                  const appt = (appointmentsData ?? []).find(
                    (a: any) => String(a.id) === e.target.value
                  );
                  if (appt?.scheduled_time) {
                    const start = new Date(appt.scheduled_time);
                    setArrivalTime(format(start, "yyyy-MM-dd'T'HH:mm"));
                    if (appt.duration_minutes) {
                      setDepartureTime(format(addMinutes(start, appt.duration_minutes), "yyyy-MM-dd'T'HH:mm"));
                    }
                  }
                }
              }}
              options={[
                { value: '', label: appointmentsData ? 'Select a visit…' : 'Loading…' },
                ...(appointmentsData ?? []).map((a: any) => ({
                  value: String(a.id),
                  label: `${format(new Date(a.scheduled_time), 'EEE MMM d, h:mm a')} — ${a.service_type === 'walk_30' ? '30-Minute Visit' : a.service_type === 'walk_60' ? '60-Minute Visit' : a.service_type.replace(/_/g, ' ')}`,
                })),
              ]}
            />
          </div>
        )}

        {/* Read-only appointment info on existing reports */}
        {!isNew && report?.appointment && (
          <div className="mb-4 text-xs text-taupe bg-cream rounded-lg px-3 py-2">
            Visit: {format(new Date(report.appointment.scheduled_time), 'EEEE, MMM d, h:mm a')}
            {' '}— {report.appointment.service_type === 'walk_30' ? '30-Minute Visit' : report.appointment.service_type === 'walk_60' ? '60-Minute Visit' : report.appointment.service_type?.replace(/_/g, ' ')}
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
        {clientId && !locked && (
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

        {/* Photos */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">
            Photos {allPhotos.length > 0 && `(${allPhotos.length})`}
          </div>
          {allPhotos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {existingPhotoUrls.map((url, i) => (
                <div key={`existing-${i}`} className="relative group">
                  <img src={url} alt={`Visit photo ${i + 1}`} className="w-full h-32 object-cover rounded-xl" />
                  {!locked && (
                    <button
                      onClick={() => {
                        deletePhoto.mutate(i);
                        setExistingPhotoUrls(prev => prev.filter((_, idx) => idx !== i));
                      }}
                      className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {newPreviews.map((url, i) => (
                <div key={`new-${i}`} className="relative group">
                  <img src={url} alt={`New photo ${i + 1}`} className="w-full h-32 object-cover rounded-xl ring-2 ring-gold/40" />
                  <button
                    onClick={() => setNewPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {!locked && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-taupe/30 rounded-xl py-6 text-taupe text-sm hover:border-gold hover:text-gold transition-colors"
            >
              {allPhotos.length > 0 ? 'Add more photos' : 'Add visit photos'}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.HEIC"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) setNewPhotos(prev => [...prev, ...files]);
              e.target.value = '';
            }}
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
            disabled={locked}
          />
          <Input
            label="Departure Time"
            type="datetime-local"
            step={900}
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            disabled={locked}
          />
        </div>

        {/* Per-dog checklist & notes sections */}
        {sectionKeys.map((sectionKey) => {
          const section = dogData[sectionKey] ?? { checklist: {}, notes: '' };
          const dogName = sectionKey === GENERAL_KEY ? null : dogNameMap[sectionKey];

          return (
            <div
              key={sectionKey}
              className={`mb-5 ${isMultiDog ? 'border border-taupe/20 rounded-xl p-4' : ''}`}
            >
              {/* Dog name header (only in multi-dog mode) */}
              {isMultiDog && dogName && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-full bg-gold flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {dogName.charAt(0)}
                  </div>
                  <h3 className="font-semibold text-espresso">{dogName}</h3>
                </div>
              )}

              {/* Checklist */}
              {enabledItems.length > 0 ? (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-3">
                    Activities & Care{dogName && !isMultiDog ? ` — ${dogName}` : ''}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {enabledItems.map((item) => (
                      <label
                        key={item.key}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-colors ${
                          locked ? 'cursor-default' : 'cursor-pointer hover:bg-gold/5'
                        } ${
                          section.checklist[item.key]
                            ? 'bg-gold/10 border border-gold/30'
                            : 'bg-cream border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!section.checklist[item.key]}
                          onChange={() => toggleCheck(sectionKey, item.key)}
                          className="accent-gold"
                          disabled={locked}
                        />
                        <span className="text-sm text-espresso">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-taupe mb-4 italic">Loading checklist…</div>
              )}

              {/* Per-dog notes */}
              <Textarea
                label={isMultiDog ? `Notes for ${dogName ?? 'this dog'}` : 'Notes'}
                value={section.notes}
                onChange={(e) => setDogNotes(sectionKey, e.target.value)}
                rows={3}
                placeholder={isMultiDog ? `How was ${dogName}'s visit?` : 'How did the visit go? Any observations for the client…'}
                disabled={locked}
              />
            </div>
          );
        })}

        {/* Special trip details (shared across all dogs) */}
        {enabledItems.find((i) => i.key === 'special_trip') && !locked && (
          <div className="mb-5">
            <Input
              label="Special trip details"
              value={specialTripDetails}
              onChange={(e) => setSpecialTripDetails(e.target.value)}
              placeholder="e.g. Off-leash park, beach visit…"
            />
          </div>
        )}
        {locked && report?.special_trip_details && (
          <div className="mb-5 text-sm text-taupe bg-gold/5 border border-gold/20 rounded-lg px-3 py-2">
            <span className="font-semibold text-gold">Special Trip: </span>
            {report.special_trip_details}
          </div>
        )}

        {/* Action buttons */}
        {!locked && (
          <div className="flex gap-3 justify-end pt-2 border-t border-cream">
            {isNew ? (
              <>
                <Button
                  variant="outline"
                  loading={createReport.isPending}
                  disabled={!clientId || createAndSend.isPending}
                  onClick={() => { setError(''); createReport.mutate(); }}
                >
                  Save Draft
                </Button>
                <Button
                  loading={createAndSend.isPending}
                  disabled={!clientId || createReport.isPending}
                  onClick={() => { setError(''); createAndSend.mutate(); }}
                >
                  Send to Client
                </Button>
              </>
            ) : editing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  loading={updateReport.isPending}
                  onClick={() => { setError(''); updateReport.mutate(); }}
                >
                  Save
                </Button>
                <Button
                  loading={sendReport.isPending}
                  onClick={() => { setError(''); sendReport.mutate(); }}
                >
                  Update & Resend
                </Button>
              </>
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
