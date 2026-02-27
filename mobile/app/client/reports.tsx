import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { format } from 'date-fns';

export default function ClientReportsScreen() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['mobile-client-report-cards'],
    queryFn: () => api.get('/client/report-cards').then((r) => r.data),
  });

  const reports = data?.data ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Report Cards</Text>
        </View>
        <ActivityIndicator color="#C9A24D" style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Report Cards</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {reports.length === 0 ? (
          <Text style={s.empty}>No report cards yet.</Text>
        ) : (
          reports.map((r: any) => {
            const isExpanded = expandedId === r.id;
            const checklist: Record<string, boolean> = r.checklist ?? {};
            const checkedItems = Object.entries(checklist)
              .filter(([k, v]) => k !== 'special_trip_details' && v)
              .map(([k]) =>
                k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
              );

            const dateLabel = r.arrival_time
              ? format(new Date(r.arrival_time), 'MMMM d, yyyy')
              : format(new Date(r.sent_at), 'MMMM d, yyyy');

            return (
              <View key={r.id} style={s.card}>
                <TouchableOpacity
                  onPress={() => setExpandedId(isExpanded ? null : r.id)}
                  style={s.cardHeader}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>Visit Report</Text>
                    <Text style={s.cardDate}>{dateLabel}</Text>
                  </View>
                  <Text style={s.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={s.detail}>
                    {/* Photo */}
                    {r.report_photo_path && (
                      <Image
                        source={{
                          uri: `${api.defaults.baseURL?.replace('/api', '')}/api/client/report-cards/${r.id}/photo`,
                          headers: {
                            Authorization: api.defaults.headers.common?.['Authorization'] as string,
                          },
                        }}
                        style={s.photo}
                        contentFit="cover"
                      />
                    )}

                    {/* Times */}
                    {(r.arrival_time || r.departure_time) && (
                      <View style={s.timesRow}>
                        {r.arrival_time && (
                          <View style={s.timeBlock}>
                            <Text style={s.timeLabel}>Arrived</Text>
                            <Text style={s.timeValue}>
                              {format(new Date(r.arrival_time), 'h:mm a')}
                            </Text>
                          </View>
                        )}
                        {r.departure_time && (
                          <View style={s.timeBlock}>
                            <Text style={s.timeLabel}>Departed</Text>
                            <Text style={s.timeValue}>
                              {format(new Date(r.departure_time), 'h:mm a')}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Checklist pills */}
                    {checkedItems.length > 0 && (
                      <View style={s.checkSection}>
                        <Text style={s.sectionLabel}>Activities & Care</Text>
                        <View style={s.pills}>
                          {checkedItems.map((item) => (
                            <View key={item} style={s.pill}>
                              <View style={s.pillDot} />
                              <Text style={s.pillText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Special trip */}
                    {r.special_trip_details && (
                      <View style={s.specialTrip}>
                        <Text style={s.specialLabel}>Special Trip: </Text>
                        <Text style={s.specialText}>{r.special_trip_details}</Text>
                      </View>
                    )}

                    {/* Notes */}
                    {r.notes && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={s.sectionLabel}>Notes</Text>
                        <Text style={s.notes}>{r.notes}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: '#3B2F2A',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: { color: '#F6F3EE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  content: { padding: 16, paddingBottom: 40 },
  empty: { color: '#C8BFB6', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#3B2F2A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#3B2F2A' },
  cardDate: { fontSize: 12, color: '#C8BFB6', marginTop: 2 },
  chevron: { fontSize: 12, color: '#C8BFB6' },
  detail: {
    borderTopWidth: 1,
    borderTopColor: '#F6F3EE',
    padding: 16,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 14,
  },
  timesRow: { flexDirection: 'row', gap: 24, marginBottom: 14 },
  timeBlock: {},
  timeLabel: { fontSize: 10, color: '#C8BFB6', textTransform: 'uppercase', letterSpacing: 1 },
  timeValue: { fontSize: 18, fontWeight: '700', color: '#3B2F2A', marginTop: 2 },
  checkSection: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 10,
    color: '#C8BFB6',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F6F3EE',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C9A24D' },
  pillText: { fontSize: 12, color: '#3B2F2A' },
  specialTrip: {
    backgroundColor: '#FDF8EE',
    borderWidth: 1,
    borderColor: '#C9A24D30',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specialLabel: { fontSize: 13, fontWeight: '700', color: '#C9A24D' },
  specialText: { fontSize: 13, color: '#3B2F2A' },
  notes: { fontSize: 14, color: '#3B2F2A', lineHeight: 20 },
});
