import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Switch, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const SIZES = ['small', 'medium', 'large', 'extra_large'] as const;
const SIZE_LABELS: Record<string, string> = {
  small: 'Small', medium: 'Medium', large: 'Large', extra_large: 'XL',
};

export default function ClientDogsScreen() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState('');
  const [size, setSize] = useState<string>('medium');
  const [sex, setSex] = useState<string>('male');
  const [colour, setColour] = useState('');
  const [spayedNeutered, setSpayedNeutered] = useState(false);
  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('');

  const { data: dogs, isLoading } = useQuery({
    queryKey: ['mobile-client-dogs'],
    queryFn: () => api.get('/client/dogs').then(r => r.data.data ?? []),
  });

  const addDog = useMutation({
    mutationFn: () => api.post('/client/dogs', {
      name, breed, dob: dob || undefined, size, sex,
      colour: colour || undefined,
      spayed_neutered: spayedNeutered,
      vet_name: vetName || undefined,
      vet_phone: vetPhone || undefined,
    }),
    onSuccess: () => {
      setShowAdd(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ['mobile-client-dogs'] });
      Alert.alert('Dog Added!', `${name} has been added to your profile. Sophie will review and activate their profile shortly.`);
    },
    onError: () => Alert.alert('Error', 'Could not add dog. Please try again.'),
  });

  const resetForm = () => {
    setName(''); setBreed(''); setDob(''); setSize('medium');
    setSex('male'); setColour(''); setSpayedNeutered(false);
    setVetName(''); setVetPhone('');
  };

  const sizeInitials: Record<string, string> = {
    small: 'S', medium: 'M', large: 'L', extra_large: 'XL',
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My Dogs</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Add Dog</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color="#C9A24D" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {!dogs?.length ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyIcon}>🐕</Text>
              <Text style={s.emptyTitle}>No dogs yet</Text>
              <Text style={s.emptyText}>Add your dog to get started with The Pupper Club!</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAdd(true)}>
                <Text style={s.emptyBtnText}>Add My Dog</Text>
              </TouchableOpacity>
            </View>
          ) : (
            dogs.map((dog: any) => (
              <View key={dog.id} style={s.dogCard}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{sizeInitials[dog.size] ?? 'M'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.dogNameRow}>
                    <Text style={s.dogName}>{dog.name}</Text>
                    {!dog.is_active && (
                      <View style={s.pendingBadge}>
                        <Text style={s.pendingText}>Pending Review</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.dogBreed}>{dog.breed}</Text>
                  <View style={s.dogMeta}>
                    <Text style={s.metaTag}>{SIZE_LABELS[dog.size] ?? dog.size}</Text>
                    <Text style={s.metaTag}>{dog.sex}</Text>
                    {dog.spayed_neutered && <Text style={s.metaTag}>Spayed/Neutered</Text>}
                  </View>
                  {dog.has_expired_vaccinations && (
                    <Text style={s.vaccWarning}>⚠️ Vaccination records need updating</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add Dog Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={m.container}>
          <View style={m.handle} />
          <Text style={m.title}>Add a Dog</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={m.label}>Dog's Name *</Text>
            <TextInput style={m.input} value={name} onChangeText={setName} placeholder="e.g. Biscuit" placeholderTextColor="#C8BFB6" />

            <Text style={m.label}>Breed *</Text>
            <TextInput style={m.input} value={breed} onChangeText={setBreed} placeholder="e.g. Golden Retriever" placeholderTextColor="#C8BFB6" />

            <Text style={m.label}>Date of Birth (optional)</Text>
            <TextInput style={m.input} value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" placeholderTextColor="#C8BFB6" />

            <Text style={m.label}>Size</Text>
            <View style={m.optionRow}>
              {SIZES.map(sz => (
                <TouchableOpacity
                  key={sz}
                  style={[m.option, size === sz && m.optionActive]}
                  onPress={() => setSize(sz)}
                >
                  <Text style={[m.optionText, size === sz && m.optionTextActive]}>
                    {SIZE_LABELS[sz]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.label}>Sex</Text>
            <View style={m.optionRow}>
              {['male', 'female'].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[m.option, sex === s && m.optionActive]}
                  onPress={() => setSex(s)}
                >
                  <Text style={[m.optionText, sex === s && m.optionTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.label}>Colour/Markings (optional)</Text>
            <TextInput style={m.input} value={colour} onChangeText={setColour} placeholder="e.g. Golden with white paws" placeholderTextColor="#C8BFB6" />

            <View style={m.switchRow}>
              <Text style={m.switchLabel}>Spayed / Neutered</Text>
              <Switch
                value={spayedNeutered}
                onValueChange={setSpayedNeutered}
                trackColor={{ true: '#C9A24D', false: '#C8BFB6' }}
                thumbColor="#fff"
              />
            </View>

            <Text style={m.sectionHeader}>Vet Information</Text>

            <Text style={m.label}>Vet Name (optional)</Text>
            <TextInput style={m.input} value={vetName} onChangeText={setVetName} placeholder="e.g. Dr. Smith" placeholderTextColor="#C8BFB6" />

            <Text style={m.label}>Vet Phone (optional)</Text>
            <TextInput style={m.input} value={vetPhone} onChangeText={setVetPhone} placeholder="604-555-0100" placeholderTextColor="#C8BFB6" keyboardType="phone-pad" />

            <TouchableOpacity
              style={[m.submitBtn, (!name.trim() || !breed.trim() || addDog.isPending) && m.submitDisabled]}
              onPress={() => addDog.mutate()}
              disabled={!name.trim() || !breed.trim() || addDog.isPending}
            >
              {addDog.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={m.submitText}>Add {name || 'Dog'}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={m.cancelBtn} onPress={() => { setShowAdd(false); resetForm(); }}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header:        { backgroundColor: '#3B2F2A', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle:   { color: '#F6F3EE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  addBtn:        { backgroundColor: '#C9A24D', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  addBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  loading:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:       { padding: 20, paddingBottom: 40 },
  emptyCard:     { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:     { fontSize: 64, marginBottom: 12 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: '#3B2F2A', marginBottom: 6 },
  emptyText:     { fontSize: 14, color: '#C8BFB6', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  emptyBtn:      { backgroundColor: '#C9A24D', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  dogCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', gap: 14, alignItems: 'center', shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  avatar:        { width: 56, height: 56, borderRadius: 28, backgroundColor: '#C9A24D', justifyContent: 'center', alignItems: 'center' },
  avatarText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  dogNameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  dogName:       { fontSize: 17, fontWeight: '700', color: '#3B2F2A' },
  dogBreed:      { fontSize: 13, color: '#C8BFB6', marginBottom: 6 },
  dogMeta:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaTag:       { fontSize: 11, fontWeight: '600', color: '#3B2F2A', backgroundColor: '#F6F3EE', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, textTransform: 'capitalize' },
  pendingBadge:  { backgroundColor: '#fef3c7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  pendingText:   { fontSize: 10, fontWeight: '700', color: '#d97706' },
  vaccWarning:   { fontSize: 11, color: '#dc2626', marginTop: 6 },
});

const m = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F6F3EE', padding: 20, paddingTop: 12 },
  handle:          { width: 40, height: 4, backgroundColor: '#C8BFB6', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:           { fontSize: 20, fontWeight: '700', color: '#3B2F2A', marginBottom: 24 },
  sectionHeader:   { fontSize: 15, fontWeight: '700', color: '#3B2F2A', marginTop: 20, marginBottom: 4, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F6F3EE' },
  label:           { fontSize: 13, fontWeight: '700', color: '#3B2F2A', marginBottom: 6, marginTop: 14 },
  input:           { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 10, padding: 12, fontSize: 14, color: '#3B2F2A', backgroundColor: '#fff' },
  optionRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option:          { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  optionActive:    { backgroundColor: '#C9A24D', borderColor: '#C9A24D' },
  optionText:      { fontSize: 13, color: '#3B2F2A', fontWeight: '500' },
  optionTextActive:{ color: '#fff', fontWeight: '700' },
  switchRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F6F3EE' },
  switchLabel:     { fontSize: 14, color: '#3B2F2A', fontWeight: '600' },
  submitBtn:       { backgroundColor: '#C9A24D', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitDisabled:  { opacity: 0.5 },
  submitText:      { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn:       { padding: 16, alignItems: 'center', marginTop: 4 },
  cancelText:      { color: '#C8BFB6', fontSize: 14 },
});
