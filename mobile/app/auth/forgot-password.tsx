import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import api from '@/lib/api';
import { useRouter } from 'expo-router';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <Text style={s.paw}>🐾</Text>
        <Text style={s.brand}>THE PUPPER CLUB</Text>
        <Text style={s.subtitle}>Reset your password</Text>

        <View style={s.card}>
          {sent ? (
            <>
              <Text style={s.successIcon}>📧</Text>
              <Text style={s.successTitle}>Check your inbox</Text>
              <Text style={s.successBody}>
                We've sent a password reset link to {email}. It expires in 1 hour.
              </Text>
              <TouchableOpacity style={s.button} onPress={() => router.back()}>
                <Text style={s.buttonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.body}>
                Enter your email and we'll send you a link to reset your password.
              </Text>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#C8BFB6"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {error ? <Text style={s.error}>{error}</Text> : null}
              <TouchableOpacity style={[s.button, loading && s.disabled]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Send Reset Link</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={s.link}>Back to sign in</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F6F3EE' },
  inner:        { flex: 1, justifyContent: 'center', padding: 24 },
  paw:          { textAlign: 'center', fontSize: 40, marginBottom: 8 },
  brand:        { textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#3B2F2A', letterSpacing: 2 },
  subtitle:     { textAlign: 'center', color: '#C8BFB6', marginTop: 4, marginBottom: 28, fontSize: 14 },
  card:         { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#3B2F2A', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  body:         { fontSize: 14, color: '#C8BFB6', marginBottom: 20, lineHeight: 20 },
  label:        { fontSize: 13, fontWeight: '600', color: '#3B2F2A', marginBottom: 6 },
  input:        { borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#3B2F2A' },
  error:        { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 10, color: '#dc2626', fontSize: 13 },
  button:       { backgroundColor: '#C9A24D', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  disabled:     { opacity: 0.7 },
  buttonText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  link:         { textAlign: 'center', color: '#6492D8', marginTop: 16, fontSize: 13 },
  successIcon:  { textAlign: 'center', fontSize: 40, marginBottom: 12 },
  successTitle: { textAlign: 'center', fontWeight: '700', fontSize: 18, color: '#3B2F2A', marginBottom: 8 },
  successBody:  { textAlign: 'center', color: '#C8BFB6', fontSize: 14, lineHeight: 20 },
});
