import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

export default function ClientProfileScreen() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  const [phone, setPhone]           = useState('');
  const [address, setAddress]       = useState('');
  const [city, setCity]             = useState('');
  const [province, setProvince]     = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [emergencyName, setEmergencyName]   = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRel, setEmergencyRel]     = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['mobile-client-profile'],
    queryFn: () => api.get('/client/profile').then(r => r.data.data),
  });

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? '');
      setAddress(profile.address ?? '');
      setCity(profile.city ?? '');
      setProvince(profile.province ?? '');
      setPostalCode(profile.postal_code ?? '');
      setEmergencyName(profile.emergency_contact_name ?? '');
      setEmergencyPhone(profile.emergency_contact_phone ?? '');
      setEmergencyRel(profile.emergency_contact_relationship ?? '');
    }
  }, [profile]);

  const mark = (setter: (v: string) => void) => (v: string) => { setter(v); setDirty(true); };

  const save = useMutation({
    mutationFn: () => api.patch('/client/profile', {
      phone, address, city, province, postal_code: postalCode,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      emergency_contact_relationship: emergencyRel,
    }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['mobile-client-profile'] });
      Alert.alert('Saved', 'Your profile has been updated.');
    },
    onError: () => Alert.alert('Error', 'Could not save changes. Please try again.'),
  });

  const confirmLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (isLoading) {
    return <View style={s.loading}><ActivityIndicator color="#C9A24D" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My Profile</Text>
        {dirty && (
          <TouchableOpacity style={s.saveBtn} onPress={() => save.mutate()} disabled={save.isPending}>
            {save.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Account Info (read-only) */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>
          <View style={s.readRow}>
            <Text style={s.readLabel}>Name</Text>
            <Text style={s.readVal}>{user?.name}</Text>
          </View>
          <View style={[s.readRow, { borderBottomWidth: 0 }]}>
            <Text style={s.readLabel}>Email</Text>
            <Text style={s.readVal}>{user?.email}</Text>
          </View>
        </View>

        {/* Contact Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contact</Text>

          <Text style={s.label}>Phone</Text>
          <TextInput
            style={s.input}
            value={phone}
            onChangeText={mark(setPhone)}
            placeholder="604-555-0100"
            placeholderTextColor="#C8BFB6"
            keyboardType="phone-pad"
          />

          <Text style={s.label}>Street Address</Text>
          <TextInput
            style={s.input}
            value={address}
            onChangeText={mark(setAddress)}
            placeholder="123 Main St"
            placeholderTextColor="#C8BFB6"
          />

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>City</Text>
              <TextInput style={s.input} value={city} onChangeText={mark(setCity)} placeholder="Vancouver" placeholderTextColor="#C8BFB6" />
            </View>
            <View style={{ width: 80, marginLeft: 10 }}>
              <Text style={s.label}>Province</Text>
              <TextInput style={s.input} value={province} onChangeText={mark(setProvince)} placeholder="BC" placeholderTextColor="#C8BFB6" autoCapitalize="characters" maxLength={2} />
            </View>
          </View>

          <Text style={s.label}>Postal Code</Text>
          <TextInput
            style={s.input}
            value={postalCode}
            onChangeText={mark(setPostalCode)}
            placeholder="V6B 1A1"
            placeholderTextColor="#C8BFB6"
            autoCapitalize="characters"
          />
        </View>

        {/* Emergency Contact */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Emergency Contact</Text>

          <Text style={s.label}>Full Name</Text>
          <TextInput
            style={s.input}
            value={emergencyName}
            onChangeText={mark(setEmergencyName)}
            placeholder="Jane Doe"
            placeholderTextColor="#C8BFB6"
          />

          <Text style={s.label}>Phone</Text>
          <TextInput
            style={s.input}
            value={emergencyPhone}
            onChangeText={mark(setEmergencyPhone)}
            placeholder="604-555-0199"
            placeholderTextColor="#C8BFB6"
            keyboardType="phone-pad"
          />

          <Text style={s.label}>Relationship</Text>
          <TextInput
            style={s.input}
            value={emergencyRel}
            onChangeText={mark(setEmergencyRel)}
            placeholder="e.g. Partner, Parent, Neighbour"
            placeholderTextColor="#C8BFB6"
          />
        </View>

        {dirty && (
          <TouchableOpacity
            style={[s.saveFullBtn, save.isPending && { opacity: 0.6 }]}
            onPress={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.saveFullBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header:        { backgroundColor: '#3B2F2A', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle:   { color: '#F6F3EE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  saveBtn:       { backgroundColor: '#C9A24D', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  saveBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  loading:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F3EE' },
  content:       { padding: 20, paddingBottom: 60 },
  section:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: '#C9A24D', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  readRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F6F3EE' },
  readLabel:     { fontSize: 13, color: '#C8BFB6' },
  readVal:       { fontSize: 13, color: '#3B2F2A', fontWeight: '500' },
  label:         { fontSize: 12, fontWeight: '700', color: '#3B2F2A', marginBottom: 6, marginTop: 12 },
  input:         { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 10, padding: 12, fontSize: 14, color: '#3B2F2A', backgroundColor: '#F6F3EE' },
  row:           { flexDirection: 'row' },
  saveFullBtn:   { backgroundColor: '#C9A24D', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  saveFullBtnText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
  logoutBtn:     { borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  logoutText:    { color: '#dc2626', fontWeight: '600', fontSize: 14 },
});
