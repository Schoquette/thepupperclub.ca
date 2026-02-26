import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { format } from 'date-fns';

const MOOD_EMOJI: Record<string, string> = {
  great: '🐾', good: '😊', okay: '😐', anxious: '😟', unwell: '🤒',
};

const ENERGY_LABELS: Record<string, string> = {
  low: 'Low', normal: 'Normal', high: 'High', hyper: 'Hyper',
};

function WalkCard({
  appt, onCheckIn, onComplete,
}: {
  appt: any;
  onCheckIn: (id: number) => void;
  onComplete: (appt: any) => void;
}) {
  const isCheckedIn = appt.status === 'checked_in';
  const isScheduled = appt.status === 'scheduled';
  const isCompleted = appt.status === 'completed';

  return (
    <View style={wc.card}>
      <View style={wc.row}>
        <View style={{ flex: 1 }}>
          <Text style={wc.clientName}>{appt.user?.name}</Text>
          <Text style={wc.dogs}>
            {appt.dogs?.map((d: any) => d.name).join(', ') || 'No dogs listed'}
          </Text>
          <Text style={wc.service}>{appt.service_type?.replace(/_/g, ' ')}</Text>
        </View>
        <View style={wc.timeBlock}>
          <Text style={wc.time}>{appt.client_time_block?.replace(/_/g, ' ')}</Text>
          <View style={[wc.statusDot, { backgroundColor: isCompleted ? '#22c55e' : isCheckedIn ? '#C9A24D' : '#6492D8' }]} />
        </View>
      </View>

      {!isCompleted && (
        <View style={wc.actions}>
          {isScheduled && (
            <TouchableOpacity style={wc.checkInBtn} onPress={() => onCheckIn(appt.id)}>
              <Text style={wc.checkInText}>🐾 Check In</Text>
            </TouchableOpacity>
          )}
          {isCheckedIn && (
            <TouchableOpacity style={wc.completeBtn} onPress={() => onComplete(appt)}>
              <Text style={wc.completeText}>✓ Complete Visit</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isCompleted && appt.visit_report && (
        <View style={wc.report}>
          <Text style={wc.reportMood}>{MOOD_EMOJI[appt.visit_report.mood] ?? '😊'} {appt.visit_report.mood}</Text>
          <View style={wc.stats}>
            {[
              { label: '💩', val: appt.visit_report.eliminated },
              { label: '🍗', val: appt.visit_report.ate_well },
              { label: '💧', val: appt.visit_report.drank_water },
            ].map(({ label, val }) => (
              <View key={label} style={[wc.stat, { backgroundColor: val ? '#f0fdf4' : '#fef2f2' }]}>
                <Text style={{ fontSize: 16 }}>{label}</Text>
                <Text style={{ fontSize: 10, color: val ? '#16a34a' : '#dc2626' }}>{val ? '✓' : '✗'}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default function AdminDashboardScreen() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [completing, setCompleting] = useState<any>(null);
  const [mood, setMood] = useState('good');
  const [eliminated, setEliminated] = useState(false);
  const [ateWell, setAteWell] = useState(false);
  const [drankWater, setDrankWater] = useState(false);
  const [energy, setEnergy] = useState('normal');
  const [notes, setNotes] = useState('');

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['mobile-admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data.data),
    refetchInterval: 30_000,
  });

  const checkIn = useMutation({
    mutationFn: (id: number) => api.post(`/admin/appointments/${id}/check-in`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobile-admin-dashboard'] }),
    onError: () => Alert.alert('Error', 'Could not check in. Please try again.'),
  });

  const complete = useMutation({
    mutationFn: (id: number) => api.post(`/admin/appointments/${id}/complete`, {
      mood, eliminated, ate_well: ateWell, drank_water: drankWater,
      energy_level: energy, notes: notes || undefined,
    }),
    onSuccess: () => {
      setCompleting(null);
      resetReport();
      qc.invalidateQueries({ queryKey: ['mobile-admin-dashboard'] });
      Alert.alert('Visit Complete!', 'Report saved and client notified.');
    },
    onError: () => Alert.alert('Error', 'Could not complete visit. Make sure you have uploaded at least one photo.'),
  });

  const resetReport = () => {
    setMood('good'); setEliminated(false); setAteWell(false);
    setDrankWater(false); setEnergy('normal'); setNotes('');
  };

  const today = dashboard?.today_appointments ?? [];
  const pending = dashboard?.pending_requests ?? 0;
  const unreadMsgs = dashboard?.unread_messages ?? 0;
  const outstandingInvoices = dashboard?.outstanding_invoices ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
      <View style={s.header}>
        <View>
          <Text style={s.headerGreeting}>Hey, Sophie! 🐾</Text>
          <Text style={s.headerDate}>{format(new Date(), 'EEEE, MMMM d')}</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Sign Out', 'Sign out?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: logout },
        ])}>
          <Text style={s.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{today.length}</Text>
            <Text style={s.statLabel}>Today's Walks</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, pending > 0 && { color: '#C9A24D' }]}>{pending}</Text>
            <Text style={s.statLabel}>Requests</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, unreadMsgs > 0 && { color: '#6492D8' }]}>{unreadMsgs}</Text>
            <Text style={s.statLabel}>Unread</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, outstandingInvoices > 0 && { color: '#dc2626' }]}>{outstandingInvoices}</Text>
            <Text style={s.statLabel}>Unpaid</Text>
          </View>
        </View>

        {/* Revenue */}
        {dashboard?.revenue && (
          <View style={s.revenueCard}>
            <Text style={s.revenueTitle}>This Month</Text>
            <View style={s.revenueRow}>
              <View style={s.revItem}>
                <Text style={s.revAmt}>${Number(dashboard.revenue.billed ?? 0).toFixed(0)}</Text>
                <Text style={s.revLabel}>Billed</Text>
              </View>
              <View style={s.revItem}>
                <Text style={[s.revAmt, { color: '#22c55e' }]}>${Number(dashboard.revenue.collected ?? 0).toFixed(0)}</Text>
                <Text style={s.revLabel}>Collected</Text>
              </View>
              <View style={s.revItem}>
                <Text style={[s.revAmt, { color: '#dc2626' }]}>${Number(dashboard.revenue.outstanding ?? 0).toFixed(0)}</Text>
                <Text style={s.revLabel}>Outstanding</Text>
              </View>
            </View>
          </View>
        )}

        {/* Today's Walks */}
        <Text style={s.sectionTitle}>Today's Walks</Text>
        {today.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>No walks scheduled today. Enjoy your rest! 🐾</Text>
          </View>
        ) : (
          today.map((appt: any) => (
            <WalkCard
              key={appt.id}
              appt={appt}
              onCheckIn={(id) => checkIn.mutate(id)}
              onComplete={(appt) => setCompleting(appt)}
            />
          ))
        )}
      </ScrollView>

      {/* Complete Visit Modal */}
      <Modal visible={!!completing} animationType="slide" presentationStyle="pageSheet">
        {completing && (
          <View style={cm.container}>
            <View style={cm.handle} />
            <Text style={cm.title}>Complete Visit</Text>
            <Text style={cm.subtitle}>{completing.user?.name} · {completing.dogs?.map((d: any) => d.name).join(', ')}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={cm.label}>Mood</Text>
              <View style={cm.optRow}>
                {Object.entries(MOOD_EMOJI).map(([key, emoji]) => (
                  <TouchableOpacity
                    key={key}
                    style={[cm.opt, mood === key && cm.optActive]}
                    onPress={() => setMood(key)}
                  >
                    <Text style={cm.optEmoji}>{emoji}</Text>
                    <Text style={[cm.optText, mood === key && cm.optTextActive]}>{key}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={cm.label}>Energy Level</Text>
              <View style={cm.optRow}>
                {Object.entries(ENERGY_LABELS).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[cm.opt, energy === key && cm.optActive]}
                    onPress={() => setEnergy(key)}
                  >
                    <Text style={[cm.optText, { marginTop: 0 }, energy === key && cm.optTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={cm.label}>Quick Checks</Text>
              {[
                { label: '💩 Eliminated', val: eliminated, set: setEliminated },
                { label: '🍗 Ate Well', val: ateWell, set: setAteWell },
                { label: '💧 Drank Water', val: drankWater, set: setDrankWater },
              ].map(({ label, val, set }) => (
                <TouchableOpacity key={label} style={cm.checkRow} onPress={() => set(!val)}>
                  <View style={[cm.checkbox, val && cm.checkboxActive]}>
                    {val && <Text style={cm.checkmark}>✓</Text>}
                  </View>
                  <Text style={cm.checkLabel}>{label}</Text>
                </TouchableOpacity>
              ))}

              <Text style={cm.label}>Notes (optional)</Text>
              <TextInput
                style={cm.notes}
                value={notes}
                onChangeText={setNotes}
                placeholder="How did the walk go? Any highlights?"
                placeholderTextColor="#C8BFB6"
                multiline
              />

              <TouchableOpacity
                style={[cm.submitBtn, complete.isPending && { opacity: 0.6 }]}
                onPress={() => complete.mutate(completing.id)}
                disabled={complete.isPending}
              >
                {complete.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={cm.submitText}>Complete & Notify Client</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={cm.cancelBtn} onPress={() => { setCompleting(null); resetReport(); }}>
                <Text style={cm.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header:        { backgroundColor: '#3B2F2A', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerGreeting:{ color: '#F6F3EE', fontSize: 20, fontWeight: '700' },
  headerDate:    { color: '#C8BFB6', fontSize: 13, marginTop: 2 },
  signOut:       { color: '#C8BFB6', fontSize: 13 },
  content:       { padding: 20, paddingBottom: 60 },
  statsRow:      { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:      { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statNum:       { fontSize: 24, fontWeight: '700', color: '#3B2F2A' },
  statLabel:     { fontSize: 10, color: '#C8BFB6', marginTop: 2, textAlign: 'center' },
  revenueCard:   { backgroundColor: '#3B2F2A', borderRadius: 16, padding: 16, marginBottom: 20 },
  revenueTitle:  { color: '#C8BFB6', fontSize: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  revenueRow:    { flexDirection: 'row' },
  revItem:       { flex: 1, alignItems: 'center' },
  revAmt:        { color: '#F6F3EE', fontSize: 20, fontWeight: '700' },
  revLabel:      { color: '#C8BFB6', fontSize: 11, marginTop: 2 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: '#3B2F2A', marginBottom: 12 },
  empty:         { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center' },
  emptyText:     { color: '#C8BFB6', fontSize: 14, textAlign: 'center' },
});

const wc = StyleSheet.create({
  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#3B2F2A', shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  row:        { flexDirection: 'row', alignItems: 'flex-start' },
  clientName: { fontSize: 16, fontWeight: '700', color: '#3B2F2A' },
  dogs:       { fontSize: 13, color: '#C9A24D', marginTop: 2 },
  service:    { fontSize: 12, color: '#C8BFB6', marginTop: 2, textTransform: 'capitalize' },
  timeBlock:  { alignItems: 'flex-end', gap: 6 },
  time:       { fontSize: 12, color: '#3B2F2A', textTransform: 'capitalize' },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  actions:    { flexDirection: 'row', gap: 10, marginTop: 12 },
  checkInBtn: { flex: 1, backgroundColor: '#6492D8', borderRadius: 10, padding: 12, alignItems: 'center' },
  checkInText:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  completeBtn:{ flex: 1, backgroundColor: '#22c55e', borderRadius: 10, padding: 12, alignItems: 'center' },
  completeText:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  report:     { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F6F3EE', flexDirection: 'row', alignItems: 'center', gap: 12 },
  reportMood: { fontSize: 14, color: '#3B2F2A', textTransform: 'capitalize' },
  stats:      { flexDirection: 'row', gap: 6 },
  stat:       { borderRadius: 8, padding: 8, alignItems: 'center', width: 40 },
});

const cm = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F6F3EE', padding: 20, paddingTop: 12 },
  handle:        { width: 40, height: 4, backgroundColor: '#C8BFB6', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:         { fontSize: 20, fontWeight: '700', color: '#3B2F2A', marginBottom: 4 },
  subtitle:      { fontSize: 14, color: '#C8BFB6', marginBottom: 24 },
  label:         { fontSize: 13, fontWeight: '700', color: '#3B2F2A', marginBottom: 10, marginTop: 16 },
  optRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt:           { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 12, padding: 10, alignItems: 'center', minWidth: 60 },
  optActive:     { backgroundColor: '#C9A24D', borderColor: '#C9A24D' },
  optEmoji:      { fontSize: 20 },
  optText:       { fontSize: 11, color: '#3B2F2A', marginTop: 4, textTransform: 'capitalize' },
  optTextActive: { color: '#fff', fontWeight: '700' },
  checkRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F6F3EE' },
  checkbox:      { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#C8BFB6', justifyContent: 'center', alignItems: 'center' },
  checkboxActive:{ backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkmark:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkLabel:    { fontSize: 14, color: '#3B2F2A' },
  notes:         { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 10, padding: 12, fontSize: 14, color: '#3B2F2A', backgroundColor: '#fff', height: 80, textAlignVertical: 'top' },
  submitBtn:     { backgroundColor: '#C9A24D', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn:     { padding: 16, alignItems: 'center' },
  cancelText:    { color: '#C8BFB6', fontSize: 14 },
});
