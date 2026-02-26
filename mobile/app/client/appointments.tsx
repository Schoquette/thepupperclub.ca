import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { format } from 'date-fns';

const TIME_BLOCKS = [
  { value: 'early_morning', label: '7–10 AM' },
  { value: 'morning',       label: '9–12 PM' },
  { value: 'midday',        label: '11 AM–2 PM' },
  { value: 'afternoon',     label: '2–5 PM' },
  { value: 'evening',       label: '5–8 PM' },
];

const SERVICE_TYPES = [
  { value: 'solo_walk',    label: 'Solo Walk' },
  { value: 'group_walk',   label: 'Group Walk' },
  { value: 'drop_in',      label: 'Drop-In Visit' },
  { value: 'overnight',    label: 'Overnight Stay' },
  { value: 'extended_walk',label: 'Extended Walk' },
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6492D8',
  checked_in: '#C9A24D',
  completed: '#22c55e',
  cancelled: '#C8BFB6',
};

const REQUEST_STATUS_COLORS: Record<string, string> = {
  pending:   '#C9A24D',
  approved:  '#22c55e',
  declined:  '#dc2626',
  countered: '#6492D8',
};

export default function ClientAppointmentsScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [service, setService] = useState('solo_walk');
  const [timeBlock, setTimeBlock] = useState('midday');
  const [preferredDate, setPreferredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDogs, setSelectedDogs] = useState<number[]>([]);

  const { data: appointments, isLoading: loadingAppts } = useQuery({
    queryKey: ['mobile-client-appointments-all'],
    queryFn: () => api.get('/client/appointments').then(r => r.data.data ?? []),
  });

  const { data: requests } = useQuery({
    queryKey: ['mobile-client-requests'],
    queryFn: () => api.get('/client/service-requests').then(r => r.data.data ?? []),
  });

  const { data: dogs } = useQuery({
    queryKey: ['mobile-client-dogs'],
    queryFn: () => api.get('/client/dogs').then(r => r.data.data ?? []),
  });

  const submit = useMutation({
    mutationFn: () => api.post('/client/service-requests', {
      service_type: service,
      preferred_time_block: timeBlock,
      preferred_date: preferredDate || undefined,
      notes: notes || undefined,
      dog_ids: selectedDogs,
    }),
    onSuccess: () => {
      setShowForm(false);
      setNotes('');
      setPreferredDate('');
      setSelectedDogs([]);
      qc.invalidateQueries({ queryKey: ['mobile-client-requests'] });
      Alert.alert('Request Sent', 'Sophie will confirm your booking shortly!');
    },
    onError: () => Alert.alert('Error', 'Could not send request. Please try again.'),
  });

  const toggleDog = (id: number) => {
    setSelectedDogs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Walks & Appointments</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)}>
          <Text style={s.addBtnText}>+ Request</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {requests && requests.filter((r: any) => r.status === 'pending').length > 0 && (
          <>
            <Text style={s.sectionTitle}>Pending Requests</Text>
            {requests.filter((r: any) => r.status === 'pending').map((req: any) => (
              <View key={req.id} style={s.requestCard}>
                <Text style={s.reqService}>{req.service_type?.replace(/_/g, ' ')}</Text>
                <Text style={s.reqMeta}>
                  {TIME_BLOCKS.find(t => t.value === req.preferred_time_block)?.label ?? req.preferred_time_block}
                  {req.preferred_date ? ` · ${format(new Date(req.preferred_date), 'MMM d')}` : ''}
                </Text>
                <View style={[s.statusPill, { backgroundColor: REQUEST_STATUS_COLORS[req.status] + '20' }]}>
                  <Text style={[s.statusPillText, { color: REQUEST_STATUS_COLORS[req.status] }]}>
                    {req.status}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={s.sectionTitle}>Upcoming</Text>
        {loadingAppts ? (
          <ActivityIndicator color="#C9A24D" style={{ marginTop: 20 }} />
        ) : !appointments?.length ? (
          <Text style={s.empty}>No upcoming appointments.</Text>
        ) : (
          appointments
            .filter((a: any) => ['scheduled', 'checked_in'].includes(a.status))
            .map((appt: any) => (
              <View key={appt.id} style={s.walkCard}>
                <View style={[s.dot, { backgroundColor: STATUS_COLORS[appt.status] ?? '#C8BFB6' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.walkService}>{appt.service_type?.replace(/_/g, ' ')}</Text>
                  <Text style={s.walkTime}>
                    {TIME_BLOCKS.find(t => t.value === appt.client_time_block)?.label ?? appt.client_time_block}
                  </Text>
                  {appt.dogs?.length > 0 && (
                    <Text style={s.walkDogs}>{appt.dogs.map((d: any) => d.name).join(', ')}</Text>
                  )}
                </View>
                <Text style={[s.apptStatus, { color: STATUS_COLORS[appt.status] }]}>
                  {appt.status?.replace('_', ' ')}
                </Text>
              </View>
            ))
        )}

        <Text style={[s.sectionTitle, { marginTop: 24 }]}>Past Walks</Text>
        {appointments
          ?.filter((a: any) => a.status === 'completed')
          .slice(0, 5)
          .map((appt: any) => (
            <View key={appt.id} style={[s.walkCard, { opacity: 0.7 }]}>
              <View style={[s.dot, { backgroundColor: '#22c55e' }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.walkService}>{appt.service_type?.replace(/_/g, ' ')}</Text>
                <Text style={s.walkTime}>
                  {TIME_BLOCKS.find(t => t.value === appt.client_time_block)?.label ?? appt.client_time_block}
                </Text>
              </View>
              <Text style={[s.apptStatus, { color: '#22c55e' }]}>completed</Text>
            </View>
          ))
        }
      </ScrollView>

      {/* Request Form Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={m.container}>
          <View style={m.handle} />
          <Text style={m.title}>Request a Walk</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={m.label}>Service Type</Text>
            <View style={m.optionRow}>
              {SERVICE_TYPES.map(st => (
                <TouchableOpacity
                  key={st.value}
                  style={[m.option, service === st.value && m.optionActive]}
                  onPress={() => setService(st.value)}
                >
                  <Text style={[m.optionText, service === st.value && m.optionTextActive]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.label}>Preferred Time</Text>
            <View style={m.optionRow}>
              {TIME_BLOCKS.map(tb => (
                <TouchableOpacity
                  key={tb.value}
                  style={[m.option, timeBlock === tb.value && m.optionActive]}
                  onPress={() => setTimeBlock(tb.value)}
                >
                  <Text style={[m.optionText, timeBlock === tb.value && m.optionTextActive]}>
                    {tb.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.label}>Preferred Date (optional)</Text>
            <TextInput
              style={m.input}
              value={preferredDate}
              onChangeText={setPreferredDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#C8BFB6"
            />

            {dogs && dogs.length > 0 && (
              <>
                <Text style={m.label}>Which dog(s)?</Text>
                <View style={m.optionRow}>
                  {dogs.map((dog: any) => (
                    <TouchableOpacity
                      key={dog.id}
                      style={[m.option, selectedDogs.includes(dog.id) && m.optionActive]}
                      onPress={() => toggleDog(dog.id)}
                    >
                      <Text style={[m.optionText, selectedDogs.includes(dog.id) && m.optionTextActive]}>
                        {dog.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={m.label}>Notes (optional)</Text>
            <TextInput
              style={[m.input, m.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any specific needs or notes for Sophie..."
              placeholderTextColor="#C8BFB6"
              multiline
            />

            <TouchableOpacity
              style={[m.submitBtn, submit.isPending && { opacity: 0.6 }]}
              onPress={() => submit.mutate()}
              disabled={submit.isPending}
            >
              {submit.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={m.submitText}>Send Request</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={m.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header:       { backgroundColor: '#3B2F2A', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle:  { color: '#F6F3EE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  addBtn:       { backgroundColor: '#C9A24D', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  content:      { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#3B2F2A', marginBottom: 12 },
  empty:        { color: '#C8BFB6', fontSize: 14, textAlign: 'center', marginTop: 8 },
  requestCard:  { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqService:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#3B2F2A', textTransform: 'capitalize' },
  reqMeta:      { fontSize: 12, color: '#C8BFB6' },
  statusPill:   { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  walkCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  walkService:  { fontSize: 14, fontWeight: '600', color: '#3B2F2A', textTransform: 'capitalize' },
  walkTime:     { fontSize: 12, color: '#C8BFB6', marginTop: 2 },
  walkDogs:     { fontSize: 11, color: '#C9A24D', marginTop: 2 },
  apptStatus:   { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});

const m = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F6F3EE', padding: 20, paddingTop: 12 },
  handle:          { width: 40, height: 4, backgroundColor: '#C8BFB6', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:           { fontSize: 20, fontWeight: '700', color: '#3B2F2A', marginBottom: 24 },
  label:           { fontSize: 13, fontWeight: '700', color: '#3B2F2A', marginBottom: 8, marginTop: 16 },
  optionRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option:          { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  optionActive:    { backgroundColor: '#C9A24D', borderColor: '#C9A24D' },
  optionText:      { fontSize: 13, color: '#3B2F2A', fontWeight: '500' },
  optionTextActive:{ color: '#fff', fontWeight: '700' },
  input:           { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 10, padding: 12, fontSize: 14, color: '#3B2F2A', backgroundColor: '#fff', marginTop: 4 },
  textarea:        { height: 80, textAlignVertical: 'top' },
  submitBtn:       { backgroundColor: '#C9A24D', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText:      { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn:       { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelText:      { color: '#C8BFB6', fontSize: 14 },
});
