import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Dimensions, Alert, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { format } from 'date-fns';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.thepupperclub.ca';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MOOD_EMOJI = { great: '🐾', good: '😊', okay: '😐', anxious: '😟', unwell: '🤒' };
const REACTION_EMOJIS = ['👍', '👎', '❤️', '😂', '😢', '🙏', '🎉', '🐾'];
const QUICK_EMOJIS = ['😊', '😂', '❤️', '🥰', '😢', '😮', '🙏', '👍', '👎', '🎉', '🐾', '🐶', '😅', '💪', '🔥', '✨'];

function PhotoMessage({
  message,
  isOwn,
  token,
}: {
  message: any;
  isOwn: boolean;
  token: string | null;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photoUri = `${API_URL}/api/messages/${message.id}/photo`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  return (
    <>
      <View style={[bubble.row, isOwn ? bubble.right : bubble.left]}>
        <TouchableOpacity onPress={() => setLightboxOpen(true)}>
          <Image
            source={{ uri: photoUri, headers }}
            style={ph.thumb}
            contentFit="cover"
            transition={200}
          />
          <Text style={[bubble.time, isOwn ? bubble.ownTime : bubble.otherTime, { marginTop: 4 }]}>
            {format(new Date(message.created_at), 'h:mm a')}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={lightboxOpen} transparent animationType="fade" onRequestClose={() => setLightboxOpen(false)}>
        <View style={ph.overlay}>
          <Image
            source={{ uri: photoUri, headers }}
            style={ph.full}
            contentFit="contain"
          />
          <View style={ph.btnRow}>
            <TouchableOpacity style={ph.btn} onPress={() => setLightboxOpen(false)}>
              <Text style={ph.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ReactionRow({
  reactions,
  onReact,
}: {
  reactions?: Array<{ emoji: string; count: number; reacted_by_me: boolean }>;
  onReact?: (emoji: string) => void;
}) {
  if (!reactions?.length) return null;
  return (
    <View style={rx.row}>
      {reactions.map((r) => (
        <TouchableOpacity
          key={r.emoji}
          style={[rx.pill, r.reacted_by_me && rx.pillActive]}
          onPress={() => onReact?.(r.emoji)}
        >
          <Text style={rx.pillText}>{r.emoji} {r.count}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MessageItem({
  message,
  currentUserId,
  token,
  onLongPress,
  onReact,
}: {
  message: any;
  currentUserId: number;
  token: string | null;
  onLongPress?: (msg: any) => void;
  onReact?: (msgId: number, emoji: string) => void;
}) {
  const isOwn = message.sender_id === currentUserId;

  if (message.type === 'photo') {
    return <PhotoMessage message={message} isOwn={isOwn} token={token} />;
  }

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
        <Text style={vr.mood}>{(MOOD_EMOJI as any)[meta.mood] ?? '😊'} {meta.mood}</Text>
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

  const canMutate = isOwn && message.type === 'text' &&
    new Date(message.created_at).getTime() > Date.now() - 2 * 60 * 60 * 1000;

  return (
    <View style={[bubble.row, isOwn ? bubble.right : bubble.left]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={400}
      >
        <View style={[bubble.bubble, isOwn ? bubble.ownBubble : bubble.otherBubble]}>
          {!isOwn && message.sender && (
            <Text style={bubble.senderName}>{message.sender.name}</Text>
          )}
          <Text style={[bubble.text, isOwn ? bubble.ownText : bubble.otherText]}>
            {message.body}
          </Text>
          <Text style={[bubble.time, isOwn ? bubble.ownTime : bubble.otherTime]}>
            {format(new Date(message.created_at), 'h:mm a')}
            {message.edited_at ? ' · Edited' : ''}
          </Text>
        </View>
      </TouchableOpacity>
      <ReactionRow
        reactions={message.reactions}
        onReact={(emoji) => onReact?.(message.id, emoji)}
      />
    </View>
  );
}

export default function ClientMessagesScreen() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const [editModalMsg, setEditModalMsg] = useState<any>(null);
  const [editBody, setEditBody] = useState('');
  const [showEmojiBar, setShowEmojiBar] = useState(false);

  // Reaction picker modal state
  const [reactTarget, setReactTarget] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['mobile-client-conversation'],
    queryFn: () => api.get(`/conversations/${user?.id}`).then((r) => r.data),
    refetchInterval: 5_000,
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (data?.data?.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [data]);

  const send = useMutation({
    mutationFn: () => api.post(`/conversations/${user?.id}/messages`, { body: text }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['mobile-client-conversation'] });
    },
  });

  const sendPhoto = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      const form = new FormData();
      form.append('photo', {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as any);
      return api.post(`/conversations/${user?.id}/photo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobile-client-conversation'] }),
  });

  const editMsg = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api.patch(`/messages/${id}`, { body }),
    onSuccess: () => {
      setEditModalMsg(null);
      qc.invalidateQueries({ queryKey: ['mobile-client-conversation'] });
    },
  });

  const deleteMsg = useMutation({
    mutationFn: (id: number) => api.delete(`/messages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobile-client-conversation'] }),
  });

  const reactMsg = useMutation({
    mutationFn: ({ id, emoji }: { id: number; emoji: string }) =>
      api.post(`/messages/${id}/reactions`, { emoji }),
    onSuccess: () => {
      setReactTarget(null);
      qc.invalidateQueries({ queryKey: ['mobile-client-conversation'] });
    },
  });

  const handleLongPress = (msg: any) => {
    const canMutate = msg.sender_id === user?.id && msg.type === 'text' &&
      new Date(msg.created_at).getTime() > Date.now() - 2 * 60 * 60 * 1000;

    const options: any[] = [
      { text: '😊 React', onPress: () => setReactTarget(msg) },
    ];

    if (canMutate) {
      options.push(
        { text: '✏️ Edit', onPress: () => { setEditModalMsg(msg); setEditBody(msg.body ?? ''); } },
        {
          text: '🗑️ Delete',
          style: 'destructive',
          onPress: () => Alert.alert('Delete message?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMsg.mutate(msg.id) },
          ]),
        },
      );
    }

    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message options', undefined, options);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      sendPhoto.mutate(result.assets[0]);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F6F3EE' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={s.header}>
        <Text style={s.headerTitle}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color="#C9A24D" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={data?.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <MessageItem
              message={item}
              currentUserId={user?.id ?? 0}
              token={token}
              onLongPress={handleLongPress}
              onReact={(id, emoji) => reactMsg.mutate({ id, emoji })}
            />
          )}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={s.empty}>No messages yet. Say hi to Sophie! 🐾</Text>}
        />
      )}

      {/* Emoji quick-pick bar */}
      {showEmojiBar && (
        <View style={s.emojiBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {QUICK_EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                style={s.emojiBtn}
                onPress={() => setText(prev => prev + e)}
              >
                <Text style={s.emoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Edit modal */}
      <Modal visible={!!editModalMsg} transparent animationType="slide" onRequestClose={() => setEditModalMsg(null)}>
        <View style={em.overlay}>
          <View style={em.sheet}>
            <Text style={em.title}>Edit Message</Text>
            <TextInput
              style={em.input}
              value={editBody}
              onChangeText={setEditBody}
              multiline
              autoFocus
            />
            <View style={em.btnRow}>
              <TouchableOpacity style={em.cancelBtn} onPress={() => setEditModalMsg(null)}>
                <Text style={em.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={em.saveBtn}
                onPress={() => editMsg.mutate({ id: editModalMsg.id, body: editBody })}
                disabled={editMsg.isPending}
              >
                {editMsg.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={em.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reaction picker modal */}
      <Modal visible={!!reactTarget} transparent animationType="fade" onRequestClose={() => setReactTarget(null)}>
        <TouchableOpacity style={rx.overlay} activeOpacity={1} onPress={() => setReactTarget(null)}>
          <View style={rx.picker}>
            <Text style={rx.pickerTitle}>React with</Text>
            <View style={rx.pickerRow}>
              {REACTION_EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={rx.pickerBtn}
                  onPress={() => reactMsg.mutate({ id: reactTarget.id, emoji: e })}
                >
                  <Text style={rx.pickerEmoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={s.inputRow}>
        <TouchableOpacity style={s.iconBtn} onPress={pickPhoto} disabled={sendPhoto.isPending}>
          {sendPhoto.isPending
            ? <ActivityIndicator color="#C8BFB6" size="small" />
            : <Text style={s.iconBtnText}>📷</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowEmojiBar(v => !v)}>
          <Text style={s.iconBtnText}>😊</Text>
        </TouchableOpacity>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="#C8BFB6"
          multiline
        />
        <TouchableOpacity
          style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]}
          onPress={() => send.mutate()}
          disabled={!text.trim() || send.isPending}
        >
          {send.isPending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.sendIcon}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header:        { backgroundColor: '#3B2F2A', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle:   { color: '#F6F3EE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  loading:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:         { textAlign: 'center', color: '#C8BFB6', marginTop: 40, fontSize: 14 },
  emojiBar:      { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F6F3EE', paddingHorizontal: 8, paddingVertical: 6 },
  emojiBtn:      { paddingHorizontal: 6 },
  emoji:         { fontSize: 26 },
  inputRow:      { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F6F3EE', alignItems: 'flex-end' },
  iconBtn:       { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  iconBtnText:   { fontSize: 22 },
  input:         { flex: 1, borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#3B2F2A', maxHeight: 100 },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#C9A24D', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#C8BFB6' },
  sendIcon:      { color: '#fff', fontSize: 18, fontWeight: '700' },
});

const bubble = StyleSheet.create({
  row:        { marginVertical: 2 },
  left:       { alignItems: 'flex-start' },
  right:      { alignItems: 'flex-end' },
  bubble:     { maxWidth: '75%', borderRadius: 18, padding: 12 },
  ownBubble:  { backgroundColor: '#C9A24D', borderBottomRightRadius: 4 },
  otherBubble:{ backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  text:       { fontSize: 14, lineHeight: 20 },
  ownText:    { color: '#fff' },
  otherText:  { color: '#3B2F2A' },
  senderName: { fontSize: 11, fontWeight: '700', color: '#C8BFB6', marginBottom: 3 },
  time:       { fontSize: 10, marginTop: 4 },
  ownTime:    { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  otherTime:  { color: '#C8BFB6' },
});

const ph = StyleSheet.create({
  thumb:   { width: Math.min(220, SCREEN_WIDTH * 0.6), height: 180, borderRadius: 16, backgroundColor: '#E5DDD0' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center' },
  full:    { width: SCREEN_WIDTH - 32, height: SCREEN_WIDTH - 32, borderRadius: 12 },
  btnRow:  { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn:     { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: '#3B2F2A', fontWeight: '700', fontSize: 15 },
});

const vr = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#C9A24D', marginHorizontal: 4, shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
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

const em = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  title:      { fontSize: 16, fontWeight: '700', color: '#3B2F2A', marginBottom: 12 },
  input:      { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 12, padding: 12, fontSize: 14, color: '#3B2F2A', minHeight: 80, maxHeight: 160 },
  btnRow:     { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#C8BFB6', fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: '#C9A24D', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveText:   { color: '#fff', fontWeight: '700' },
});

const rx = StyleSheet.create({
  row:         { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  pill:        { backgroundColor: '#F6F3EE', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#C8BFB6' },
  pillActive:  { backgroundColor: 'rgba(201,162,77,0.15)', borderColor: '#C9A24D' },
  pillText:    { fontSize: 13, color: '#3B2F2A' },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  picker:      { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', width: 300 },
  pickerTitle: { fontSize: 14, fontWeight: '700', color: '#3B2F2A', marginBottom: 14 },
  pickerRow:   { flexDirection: 'row', gap: 8 },
  pickerBtn:   { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F3EE', borderRadius: 22 },
  pickerEmoji: { fontSize: 24 },
});
