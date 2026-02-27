import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { format } from 'date-fns';

interface TemplateItem {
  key: string;
  label: string;
  enabled: boolean;
}

export default function AdminReportsScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'draft'>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [specialTripDetails, setSpecialTripDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [formError, setFormError] = useState('');

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['mobile-admin-report-cards', statusFilter],
    queryFn: () =>
      api
        .get('/admin/report-cards', {
          params: statusFilter !== 'all' ? { status: statusFilter } : {},
        })
        .then((r) => r.data),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['mobile-admin-clients-list'],
    queryFn: () => api.get('/admin/clients').then((r) => r.data.data ?? []),
  });

  const { data: templateData } = useQuery({
    queryKey: ['mobile-report-template', selectedClientId],
    queryFn: () =>
      api
        .get(`/admin/clients/${selectedClientId}/report-template`)
        .then((r) => r.data.data),
    enabled: !!selectedClientId,
    onSuccess: (data: TemplateItem[]) => {
      setTemplateItems(data);
      const initial: Record<string, boolean> = {};
      data.forEach((item) => { initial[item.key] = false; });
      setChecks(initial);
    },
  } as any);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const createReport = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('user_id', selectedClientId);
      if (arrivalTime) fd.append('arrival_time', arrivalTime);
      if (departureTime) fd.append('departure_time', departureTime);
      Object.entries(checks).forEach(([k, v]) => {
        fd.append(`checklist[${k}]`, v ? '1' : '0');
      });
      if (specialTripDetails) fd.append('special_trip_details', specialTripDetails);
      if (notes) fd.append('notes', notes);
      if (photoUri) {
        const filename = photoUri.split('/').pop() ?? 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        (fd as any).append('photo', { uri: photoUri, name: filename, type });
      }
      return api.post('/admin/report-cards', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mobile-admin-report-cards'] });
      setShowForm(false);
      resetForm();
      Alert.alert('Saved', 'Report card saved as draft.');
    },
    onError: (e: any) =>
      setFormError(e.response?.data?.message ?? 'Failed to save report card.'),
  });

  const resetForm = () => {
    setSelectedClientId('');
    setArrivalTime('');
    setDepartureTime('');
    setChecks({});
    setSpecialTripDetails('');
    setNotes('');
    setPhotoUri(null);
    setTemplateItems([]);
    setFormError('');
  };

  const reports = reportsData?.data ?? [];

  const toggleCheck = (key: string) =>
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Report Cards</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)}>
          <Text style={s.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={s.filters}>
        {(['all', 'sent', 'draft'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterBtn, statusFilter === f && s.filterBtnActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text
              style={[s.filterText, statusFilter === f && s.filterTextActive]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {isLoading ? (
          <ActivityIndicator color="#C9A24D" style={{ marginTop: 40 }} />
        ) : reports.length === 0 ? (
          <Text style={s.empty}>No report cards found.</Text>
        ) : (
          reports.map((r: any) => (
            <View key={r.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.clientName}>{r.user?.name ?? '—'}</Text>
                <Text style={s.cardDate}>
                  {r.arrival_time
                    ? format(new Date(r.arrival_time), 'MMM d, yyyy')
                    : format(new Date(r.created_at), 'MMM d, yyyy')}
                </Text>
              </View>
              <View
                style={[
                  s.statusBadge,
                  { backgroundColor: r.sent_at ? '#dcfce7' : '#F6F3EE' },
                ]}
              >
                <Text
                  style={[
                    s.statusText,
                    { color: r.sent_at ? '#166534' : '#C8BFB6' },
                  ]}
                >
                  {r.sent_at ? 'Sent' : 'Draft'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create form modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={m.container}>
          <View style={m.handle} />
          <Text style={m.title}>New Report Card</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {formError ? (
              <Text style={m.error}>{formError}</Text>
            ) : null}

            <Text style={m.label}>Client</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={m.optionRow}>
                {(clientsData ?? []).map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      m.option,
                      selectedClientId === String(c.id) && m.optionActive,
                    ]}
                    onPress={() => setSelectedClientId(String(c.id))}
                  >
                    <Text
                      style={[
                        m.optionText,
                        selectedClientId === String(c.id) && m.optionTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={m.label}>Arrival Time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={m.input}
              value={arrivalTime}
              onChangeText={setArrivalTime}
              placeholder="e.g. 2024-01-15 14:30"
              placeholderTextColor="#C8BFB6"
            />

            <Text style={m.label}>Departure Time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={m.input}
              value={departureTime}
              onChangeText={setDepartureTime}
              placeholder="e.g. 2024-01-15 15:30"
              placeholderTextColor="#C8BFB6"
            />

            {/* Photo */}
            <Text style={m.label}>Photo</Text>
            <TouchableOpacity style={m.photoPicker} onPress={pickPhoto}>
              <Text style={m.photoPickerText}>
                {photoUri ? '✓ Photo selected' : '📷 Select Photo'}
              </Text>
            </TouchableOpacity>

            {/* Checklist */}
            {templateItems.filter((i) => i.enabled).length > 0 && (
              <>
                <Text style={m.label}>Activities & Care</Text>
                {templateItems
                  .filter((i) => i.enabled)
                  .map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        m.checkRow,
                        checks[item.key] && m.checkRowActive,
                      ]}
                      onPress={() => toggleCheck(item.key)}
                    >
                      <Text
                        style={[
                          m.checkText,
                          checks[item.key] && m.checkTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text style={{ fontSize: 16 }}>
                        {checks[item.key] ? '✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                {templateItems.find((i) => i.key === 'special_trip')?.enabled &&
                  checks.special_trip && (
                    <>
                      <Text style={m.label}>Special Trip Details</Text>
                      <TextInput
                        style={m.input}
                        value={specialTripDetails}
                        onChangeText={setSpecialTripDetails}
                        placeholder="Describe the special trip…"
                        placeholderTextColor="#C8BFB6"
                      />
                    </>
                  )}
              </>
            )}

            <Text style={m.label}>Notes</Text>
            <TextInput
              style={[m.input, m.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did the visit go?"
              placeholderTextColor="#C8BFB6"
              multiline
            />

            <TouchableOpacity
              style={[
                m.submitBtn,
                (!selectedClientId || createReport.isPending) && { opacity: 0.5 },
              ]}
              onPress={() => {
                setFormError('');
                createReport.mutate();
              }}
              disabled={!selectedClientId || createReport.isPending}
            >
              {createReport.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={m.submitText}>Save Draft</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={m.cancelBtn}
              onPress={() => { setShowForm(false); resetForm(); }}
            >
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: '#3B2F2A',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { color: '#F6F3EE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  addBtn: {
    backgroundColor: '#C9A24D',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F6F3EE',
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F6F3EE',
  },
  filterBtnActive: { backgroundColor: '#3B2F2A' },
  filterText: { fontSize: 12, color: '#C8BFB6', fontWeight: '600' },
  filterTextActive: { color: '#F6F3EE' },
  content: { padding: 16, paddingBottom: 40 },
  empty: { color: '#C8BFB6', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#3B2F2A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  clientName: { fontSize: 14, fontWeight: '700', color: '#3B2F2A' },
  cardDate: { fontSize: 12, color: '#C8BFB6', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
});

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F3EE', padding: 20, paddingTop: 12 },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#C8BFB6',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#3B2F2A', marginBottom: 16 },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    fontSize: 13,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#3B2F2A', marginBottom: 6, marginTop: 14 },
  optionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  option: {
    borderWidth: 1,
    borderColor: '#C8BFB6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionActive: { backgroundColor: '#C9A24D', borderColor: '#C9A24D' },
  optionText: { fontSize: 13, color: '#3B2F2A', fontWeight: '500' },
  optionTextActive: { color: '#fff', fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#C8BFB6',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#3B2F2A',
    backgroundColor: '#fff',
    marginTop: 4,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  photoPicker: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#C8BFB6',
    borderRadius: 10,
    paddingVertical: 20,
    alignItems: 'center',
  },
  photoPickerText: { color: '#C8BFB6', fontSize: 14 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F6F3EE',
    marginBottom: 6,
  },
  checkRowActive: { backgroundColor: '#FDF8EE', borderWidth: 1, borderColor: '#C9A24D30' },
  checkText: { fontSize: 14, color: '#3B2F2A' },
  checkTextActive: { fontWeight: '600', color: '#3B2F2A' },
  submitBtn: {
    backgroundColor: '#C9A24D',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#C8BFB6', fontSize: 14 },
});
