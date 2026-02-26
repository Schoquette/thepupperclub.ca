import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import api from '@/lib/api';

export default function AdminClientsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data: clients, isLoading } = useQuery({
    queryKey: ['mobile-admin-clients'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data ?? []),
  });

  const filtered = (clients ?? []).filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const initials = (name: string) => name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const statusColor: Record<string, string> = {
    active: '#22c55e', pending: '#C9A24D', inactive: '#C8BFB6',
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Clients</Text>
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search clients..."
          placeholderTextColor="#C8BFB6"
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color="#C9A24D" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={s.empty}>{search ? 'No clients match your search.' : 'No clients yet.'}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.clientRow}
              onPress={() => router.push(`/admin/client/${item.id}`)}
            >
              <View style={[s.avatar, { backgroundColor: item.status === 'active' ? '#3B2F2A' : '#C8BFB6' }]}>
                <Text style={s.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.clientName}>{item.name}</Text>
                <Text style={s.clientEmail}>{item.email}</Text>
                {item.client_profile?.dogs_count > 0 && (
                  <Text style={s.clientMeta}>🐕 {item.client_profile.dogs_count} dog{item.client_profile.dogs_count > 1 ? 's' : ''}</Text>
                )}
              </View>
              <View style={[s.statusDot, { backgroundColor: statusColor[item.status] ?? '#C8BFB6' }]} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header:      { backgroundColor: '#3B2F2A', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { color: '#F6F3EE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  searchWrap:  { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F6F3EE' },
  search:      { backgroundColor: '#F6F3EE', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#3B2F2A' },
  loading:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:       { textAlign: 'center', color: '#C8BFB6', marginTop: 40, fontSize: 14 },
  clientRow:   { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#3B2F2A', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  avatar:      { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  clientName:  { fontSize: 15, fontWeight: '600', color: '#3B2F2A' },
  clientEmail: { fontSize: 12, color: '#C8BFB6', marginTop: 1 },
  clientMeta:  { fontSize: 11, color: '#C9A24D', marginTop: 3 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
});
