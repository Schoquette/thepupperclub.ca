import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import api from '@/lib/api';
import { format, isToday, isYesterday } from 'date-fns';

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export default function AdminInboxScreen() {
  const router = useRouter();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['mobile-admin-inbox'],
    queryFn: () => api.get('/admin/conversations').then(r => r.data.data ?? []),
    refetchInterval: 10_000,
  });

  const initials = (name: string) => name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  const preview = (msg: any) => {
    if (!msg) return 'No messages yet';
    if (msg.type === 'visit_report') return '🐾 Visit report';
    if (msg.type === 'arrival') return '📍 Walker arrived';
    if (msg.type === 'invoice') return '💳 Invoice';
    if (msg.type === 'notification') return '📢 Announcement';
    return msg.body ?? '';
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Inbox</Text>
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color="#C9A24D" /></View>
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={s.empty}>No conversations yet.</Text>}
          renderItem={({ item }) => {
            const hasUnread = item.unread_count_admin > 0;
            return (
              <TouchableOpacity
                style={[s.row, hasUnread && s.rowUnread]}
                onPress={() => router.push(`/admin/conversation/${item.user_id}`)}
              >
                <View style={[s.avatar, { backgroundColor: hasUnread ? '#C9A24D' : '#3B2F2A' }]}>
                  <Text style={s.avatarText}>{initials(item.user?.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={[s.clientName, hasUnread && s.clientNameBold]}>{item.user?.name}</Text>
                    {item.last_message_at && (
                      <Text style={s.timeText}>{formatTime(item.last_message_at)}</Text>
                    )}
                  </View>
                  <Text style={[s.preview, hasUnread && s.previewBold]} numberOfLines={1}>
                    {preview(item.last_message)}
                  </Text>
                </View>
                {hasUnread && (
                  <View style={s.unreadBadge}>
                    <Text style={s.unreadCount}>{item.unread_count_admin}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={s.divider} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header:          { backgroundColor: '#3B2F2A', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle:     { color: '#F6F3EE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  loading:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:           { textAlign: 'center', color: '#C8BFB6', marginTop: 40, fontSize: 14 },
  row:             { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: '#fff' },
  rowUnread:       { backgroundColor: '#FFFBF0' },
  avatar:          { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  nameRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  clientName:      { fontSize: 15, color: '#3B2F2A', fontWeight: '500' },
  clientNameBold:  { fontWeight: '700' },
  timeText:        { fontSize: 11, color: '#C8BFB6' },
  preview:         { fontSize: 13, color: '#C8BFB6' },
  previewBold:     { color: '#3B2F2A', fontWeight: '500' },
  unreadBadge:     { width: 22, height: 22, borderRadius: 11, backgroundColor: '#C9A24D', justifyContent: 'center', alignItems: 'center' },
  unreadCount:     { color: '#fff', fontWeight: '700', fontSize: 11 },
  divider:         { height: 1, backgroundColor: '#F6F3EE', marginLeft: 74 },
});
