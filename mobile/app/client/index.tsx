import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

const TIME_BLOCK_LABELS = {
  early_morning: '7–10 AM', morning: '9–12 PM', midday: '11 AM–2 PM',
  afternoon: '2–5 PM', evening: '5–8 PM',
};

const STATUS_COLORS = {
  scheduled: '#6492D8', checked_in: '#C9A24D', completed: '#22c55e', cancelled: '#C8BFB6',
};

export default function ClientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: appointments, refetch: refetchAppts, isFetching } = useQuery({
    queryKey: ['mobile-client-appointments'],
    queryFn: () => api.get('/client/appointments', { params: { upcoming: 1 } }).then(r => r.data.data),
  });

  const { data: invoices } = useQuery({
    queryKey: ['mobile-client-invoices'],
    queryFn: () => api.get('/client/invoices').then(r => r.data.data),
  });

  const unpaid = invoices?.filter((i: any) => ['sent', 'overdue'].includes(i.status)) ?? [];
  const upcoming = appointments?.slice(0, 3) ?? [];

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetchAppts} />}
    >
      <Text style={s.greeting}>Hey{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 🐾</Text>

      {unpaid.length > 0 && (
        <TouchableOpacity style={s.alert} onPress={() => router.push('/client/invoices')}>
          <Text style={s.alertText}>💳  {unpaid.length} outstanding invoice{unpaid.length > 1 ? 's' : ''} — Tap to pay</Text>
        </TouchableOpacity>
      )}

      <Text style={s.sectionTitle}>Upcoming Walks</Text>

      {upcoming.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No upcoming walks. Tap below to request one.</Text>
        </View>
      ) : (
        upcoming.map((appt: any) => (
          <View key={appt.id} style={s.walkCard}>
            <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[appt.status as keyof typeof STATUS_COLORS] ?? '#C8BFB6' }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.walkService}>{appt.service_type?.replace(/_/g, ' ')}</Text>
              <Text style={s.walkTime}>
                {TIME_BLOCK_LABELS[appt.client_time_block as keyof typeof TIME_BLOCK_LABELS] ?? appt.client_time_block}
              </Text>
            </View>
            <Text style={[s.statusBadge, { backgroundColor: (STATUS_COLORS as any)[appt.status] + '20', color: (STATUS_COLORS as any)[appt.status] }]}>
              {appt.status?.replace('_', ' ')}
            </Text>
          </View>
        ))
      )}

      <View style={s.actionRow}>
        <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/client/appointments')}>
          <Text style={s.actionIcon}>📅</Text>
          <Text style={s.actionLabel}>Book Walk</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/client/messages')}>
          <Text style={s.actionIcon}>💬</Text>
          <Text style={s.actionLabel}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/client/dogs')}>
          <Text style={s.actionIcon}>🐕</Text>
          <Text style={s.actionLabel}>My Dogs</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F6F3EE' },
  content:      { padding: 20 },
  greeting:     { fontSize: 24, fontWeight: '700', color: '#3B2F2A', marginBottom: 16 },
  alert:        { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca' },
  alertText:    { color: '#dc2626', fontWeight: '600', fontSize: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#3B2F2A', marginBottom: 12 },
  emptyCard:    { backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyText:    { color: '#C8BFB6', fontSize: 14, textAlign: 'center' },
  walkCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  walkService:  { fontSize: 14, fontWeight: '600', color: '#3B2F2A', textTransform: 'capitalize' },
  walkTime:     { fontSize: 12, color: '#C8BFB6', marginTop: 2 },
  statusBadge:  { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, textTransform: 'capitalize', overflow: 'hidden' },
  actionRow:    { flexDirection: 'row', gap: 12, marginTop: 24 },
  actionBtn:    { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  actionIcon:   { fontSize: 28, marginBottom: 6 },
  actionLabel:  { fontSize: 12, color: '#3B2F2A', fontWeight: '600' },
});
