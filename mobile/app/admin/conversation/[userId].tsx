import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { format } from 'date-fns';

const MOOD_EMOJI: Record<string, string> = {
  great: '🐾', good: '😊', okay: '😐', anxious: '😟', unwell: '🤒',
};

function MessageItem({ message, currentUserId }: { message: any; currentUserId: number }) {
  const isOwn = message.sender_id === currentUserId;

  if (message.type === 'visit_report') {
    const meta = message.metadata ?? {};
    return (
      <View style={vr.container}>
        <Text style={vr.title}>Visit Report 🐾</Text>
        <View style={vr.stats}>
          {[
            { label: 'Eliminated', val: meta.eliminated },
            { label: 'Ate Well', val: meta.ate_well },
            { label: 'Hydrated', val: meta.drank_water },
          ].map(({ label, val }) => (
            <View key={label} style={[vr.stat, { backgroundColor: val ? '#f0fdf4' : '#fef2f2' }]}>
              <Text style={[vr.statText, { color: val ? '#16a34a' : '#dc2626' }]}>
                {val ? '✓' : '✗'} {label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={vr.mood}>{MOOD_EMOJI[meta.mood] ?? '😊'} {meta.mood}</Text>
        {meta.notes ? <Text style={vr.notes}>{meta.notes}</Text> : null}
        <Text style={vr.time}>{format(new Date(message.created_at), 'h:mm a')}</Text>
      </View>
    );
  }

  if (message.type === 'arrival') {
    return (
      <View style={arr.container}>
        <Text style={arr.text}>🐾 Walker arrived · {format(new Date(message.created_at), 'h:mm a')}</Text>
      </View>
    );
  }

  if (message.type === 'invoice') {
    const meta = message.metadata ?? {};
    return (
      <View style={inv.container}>
        <Text style={inv.num}>{meta.invoice_number}</Text>
        <Text style={inv.total}>${Number(meta.total ?? 0).toFixed(2)}</Text>
        <Text style={inv.time}>{format(new Date(message.created_at), 'h:mm a')}</Text>
      </View>
    );
  }

  return (
    <View style={[bubble.row, isOwn ? bubble.right : bubble.left]}>
      <View style={[bubble.bubble, isOwn ? bubble.ownBubble : bubble.otherBubble]}>
        {!isOwn && message.sender && (
          <Text style={bubble.senderName}>{message.sender.name}</Text>
        )}
        <Text style={[bubble.text, isOwn ? bubble.ownText : bubble.otherText]}>
          {message.body}
        </Text>
        <Text style={[bubble.time, isOwn ? bubble.ownTime : bubble.otherTime]}>
          {format(new Date(message.created_at), 'h:mm a')}
        </Text>
      </View>
    </View>
  );
}

export default function AdminConversationScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const lastIdRef = useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: ['mobile-admin-conversation', userId],
    queryFn: () =>
      api.get(`/conversations/${userId}`, { params: { since: lastIdRef.current } }).then(r => {
        const msgs = r.data.data ?? [];
        if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;
        return r.data;
      }),
    refetchInterval: 5_000,
    enabled: !!userId,
  });

  const clientName = data?.data?.[0]?.sender?.name ?? data?.data?.find((m: any) => m.sender_id !== user?.id)?.sender?.name;

  useEffect(() => {
    if (data?.data?.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [data]);

  const send = useMutation({
    mutationFn: () => api.post(`/conversations/${userId}/messages`, { body: text }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['mobile-admin-conversation', userId] });
      qc.invalidateQueries({ queryKey: ['mobile-admin-inbox'] });
    },
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F6F3EE' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{clientName ?? 'Conversation'}</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color="#C9A24D" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={data?.data ?? []}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <MessageItem message={item} currentUserId={user?.id ?? 0} />}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={s.empty}>No messages yet.</Text>}
        />
      )}

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor="#C8BFB6"
          multiline
        />
        <TouchableOpacity
          style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]}
          onPress={() => send.mutate()}
          disabled={!text.trim() || send.isPending}
        >
          {send.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendIcon}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header:        { backgroundColor: '#3B2F2A', paddingTop: 60, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  backBtn:       { width: 60 },
  backText:      { color: '#C8BFB6', fontSize: 16 },
  headerTitle:   { color: '#F6F3EE', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  loading:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:         { textAlign: 'center', color: '#C8BFB6', marginTop: 40, fontSize: 14 },
  inputRow:      { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F6F3EE' },
  input:         { flex: 1, borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#3B2F2A', maxHeight: 100 },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#C9A24D', justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  sendBtnDisabled: { backgroundColor: '#C8BFB6' },
  sendIcon:      { color: '#fff', fontSize: 18, fontWeight: '700' },
});

const bubble = StyleSheet.create({
  row:        { marginVertical: 2 },
  left:       { alignItems: 'flex-start' },
  right:      { alignItems: 'flex-end' },
  bubble:     { maxWidth: '75%', borderRadius: 18, padding: 12 },
  ownBubble:  { backgroundColor: '#3B2F2A', borderBottomRightRadius: 4 },
  otherBubble:{ backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  text:       { fontSize: 14, lineHeight: 20 },
  ownText:    { color: '#F6F3EE' },
  otherText:  { color: '#3B2F2A' },
  senderName: { fontSize: 11, fontWeight: '700', color: '#C8BFB6', marginBottom: 3 },
  time:       { fontSize: 10, marginTop: 4 },
  ownTime:    { color: 'rgba(246,243,238,0.6)', textAlign: 'right' },
  otherTime:  { color: '#C8BFB6' },
});

const vr = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#C9A24D', marginHorizontal: 4 },
  title:     { fontSize: 15, fontWeight: '700', color: '#3B2F2A', marginBottom: 10 },
  stats:     { flexDirection: 'row', gap: 8, marginBottom: 10 },
  stat:      { flex: 1, borderRadius: 8, padding: 8, alignItems: 'center' },
  statText:  { fontSize: 11, fontWeight: '600' },
  mood:      { fontSize: 16, marginBottom: 6 },
  notes:     { fontSize: 13, color: '#C8BFB6', fontStyle: 'italic' },
  time:      { fontSize: 11, color: '#C8BFB6', marginTop: 8 },
});

const arr = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 4 },
  text:      { backgroundColor: 'rgba(201,162,77,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, fontSize: 12, color: '#C9A24D', fontWeight: '600', borderWidth: 1, borderColor: 'rgba(201,162,77,0.3)' },
});

const inv = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#6492D8', marginHorizontal: 4 },
  num:       { fontSize: 12, color: '#C8BFB6', fontFamily: 'monospace' },
  total:     { fontSize: 22, fontWeight: '700', color: '#3B2F2A', marginTop: 4 },
  time:      { fontSize: 11, color: '#C8BFB6', marginTop: 6 },
});
