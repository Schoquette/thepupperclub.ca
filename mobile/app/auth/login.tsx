import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      router.replace(user.role === 'admin' ? '/admin/' : '/client/');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.paw}>🐾</Text>
        <Text style={styles.brand}>THE PUPPER CLUB</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#C8BFB6"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#C8BFB6"
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F6F3EE' },
  inner:       { flexGrow: 1, justifyContent: 'center', padding: 24 },
  paw:         { textAlign: 'center', fontSize: 48, marginBottom: 8 },
  brand:       { textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#3B2F2A', letterSpacing: 2 },
  subtitle:    { textAlign: 'center', color: '#C8BFB6', marginTop: 4, marginBottom: 32, fontSize: 14 },
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#3B2F2A', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  label:       { fontSize: 13, fontWeight: '600', color: '#3B2F2A', marginBottom: 6 },
  input:       { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#3B2F2A' },
  error:       { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginTop: 12, color: '#dc2626', fontSize: 13 },
  button:      { backgroundColor: '#C9A24D', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.7 },
  buttonText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  link:        { textAlign: 'center', color: '#6492D8', marginTop: 16, fontSize: 13 },
});
