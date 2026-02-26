import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:    { bg: '#f3f4f6', text: '#6b7280' },
  sent:     { bg: '#fef9c3', text: '#a16207' },
  paid:     { bg: '#f0fdf4', text: '#16a34a' },
  overdue:  { bg: '#fef2f2', text: '#dc2626' },
  void:     { bg: '#f3f4f6', text: '#9ca3af' },
};

const TIP_OPTIONS = [
  { label: '10%', pct: 0.10 },
  { label: '15%', pct: 0.15 },
  { label: '20%', pct: 0.20 },
];

export default function ClientInvoicesScreen() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [tipModal, setTipModal] = useState<any>(null);
  const [tipAmount, setTipAmount] = useState(0);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['mobile-client-invoices'],
    queryFn: () => api.get('/client/invoices').then(r => r.data.data ?? []),
  });

  const pay = useMutation({
    mutationFn: (invoiceId: number) =>
      api.post(`/client/invoices/${invoiceId}/pay`),
    onSuccess: (_, invoiceId) => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['mobile-client-invoices'] });
      // Prompt for tip after payment
      const inv = invoices?.find((i: any) => i.id === invoiceId);
      if (inv) setTimeout(() => setTipModal(inv), 300);
      Alert.alert('Payment Successful', 'Thank you! Your invoice has been paid.');
    },
    onError: () => Alert.alert('Payment Failed', 'There was an issue processing your payment. Please try again.'),
  });

  const sendTip = useMutation({
    mutationFn: ({ invoiceId, amount }: { invoiceId: number; amount: number }) =>
      api.post(`/client/invoices/${invoiceId}/tip`, { amount }),
    onSuccess: () => {
      setTipModal(null);
      setTipAmount(0);
      qc.invalidateQueries({ queryKey: ['mobile-client-invoices'] });
      Alert.alert('Thank You!', 'Your tip has been sent. Sophie appreciates it! 🐾');
    },
  });

  const unpaid = invoices?.filter((i: any) => ['sent', 'overdue'].includes(i.status)) ?? [];
  const paid = invoices?.filter((i: any) => i.status === 'paid') ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F3EE' }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Invoices</Text>
      </View>

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color="#C9A24D" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {unpaid.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Outstanding</Text>
              {unpaid.map((inv: any) => (
                <TouchableOpacity key={inv.id} style={[s.card, s.cardUnpaid]} onPress={() => setSelected(inv)}>
                  <View style={s.cardRow}>
                    <View>
                      <Text style={s.invoiceNum}>{inv.invoice_number}</Text>
                      {inv.due_date && (
                        <Text style={s.dueDate}>Due {format(new Date(inv.due_date), 'MMM d, yyyy')}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.total}>${Number(inv.total ?? 0).toFixed(2)}</Text>
                      <View style={[s.badge, { backgroundColor: STATUS_COLORS[inv.status]?.bg }]}>
                        <Text style={[s.badgeText, { color: STATUS_COLORS[inv.status]?.text }]}>
                          {inv.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity style={s.payBtn} onPress={() => setSelected(inv)}>
                    <Text style={s.payBtnText}>Pay Now →</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          )}

          <Text style={[s.sectionTitle, unpaid.length > 0 && { marginTop: 24 }]}>
            {paid.length > 0 ? 'Paid Invoices' : 'No Invoices Yet'}
          </Text>
          {paid.map((inv: any) => (
            <View key={inv.id} style={s.card}>
              <View style={s.cardRow}>
                <View>
                  <Text style={s.invoiceNum}>{inv.invoice_number}</Text>
                  {inv.paid_at && (
                    <Text style={s.dueDate}>Paid {format(new Date(inv.paid_at), 'MMM d, yyyy')}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.total}>${Number(inv.total ?? 0).toFixed(2)}</Text>
                  <View style={[s.badge, { backgroundColor: '#f0fdf4' }]}>
                    <Text style={[s.badgeText, { color: '#16a34a' }]}>paid</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Invoice Detail / Pay Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={md.container}>
            <View style={md.handle} />
            <Text style={md.invoiceNum}>{selected.invoice_number}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selected.line_items?.map((item: any) => (
                <View key={item.id} style={md.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={md.lineDesc}>{item.description}</Text>
                    {item.quantity > 1 && (
                      <Text style={md.lineQty}>{item.quantity} × ${Number(item.unit_price).toFixed(2)}</Text>
                    )}
                  </View>
                  <Text style={md.lineAmt}>${Number(item.total).toFixed(2)}</Text>
                </View>
              ))}

              <View style={md.divider} />

              <View style={md.totalRow}>
                <Text style={md.totalLabel}>Subtotal</Text>
                <Text style={md.totalVal}>${Number(selected.subtotal).toFixed(2)}</Text>
              </View>
              <View style={md.totalRow}>
                <Text style={md.totalLabel}>GST (5%)</Text>
                <Text style={md.totalVal}>${Number(selected.gst).toFixed(2)}</Text>
              </View>
              {Number(selected.cc_surcharge) > 0 && (
                <View style={md.totalRow}>
                  <Text style={md.totalLabel}>CC Fee (2.9%)</Text>
                  <Text style={md.totalVal}>${Number(selected.cc_surcharge).toFixed(2)}</Text>
                </View>
              )}
              <View style={[md.totalRow, md.grandTotal]}>
                <Text style={md.grandLabel}>Total Due</Text>
                <Text style={md.grandVal}>${Number(selected.total).toFixed(2)}</Text>
              </View>

              <TouchableOpacity
                style={[md.payBtn, pay.isPending && { opacity: 0.6 }]}
                onPress={() => pay.mutate(selected.id)}
                disabled={pay.isPending}
              >
                {pay.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={md.payBtnText}>Pay ${Number(selected.total).toFixed(2)}</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={md.closeBtn} onPress={() => setSelected(null)}>
                <Text style={md.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Tip Modal */}
      <Modal visible={!!tipModal} animationType="fade" transparent>
        <View style={tp.overlay}>
          <View style={tp.sheet}>
            <Text style={tp.title}>Leave a Tip? 🐾</Text>
            <Text style={tp.subtitle}>Show Sophie some extra appreciation!</Text>

            <View style={tp.optionRow}>
              {TIP_OPTIONS.map(opt => {
                const amount = tipModal ? Number(tipModal.subtotal) * opt.pct : 0;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[tp.option, tipAmount === amount && tp.optionActive]}
                    onPress={() => setTipAmount(amount)}
                  >
                    <Text style={[tp.optPct, tipAmount === amount && tp.optTextActive]}>{opt.label}</Text>
                    <Text style={[tp.optAmt, tipAmount === amount && tp.optTextActive]}>
                      ${amount.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={tp.sendBtn}
              onPress={() => tipAmount > 0 && tipModal && sendTip.mutate({ invoiceId: tipModal.id, amount: tipAmount })}
              disabled={tipAmount === 0 || sendTip.isPending}
            >
              {sendTip.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={tp.sendBtnText}>
                    {tipAmount > 0 ? `Send $${tipAmount.toFixed(2)} Tip` : 'Select a Tip'}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={tp.skipBtn} onPress={() => { setTipModal(null); setTipAmount(0); }}>
              <Text style={tp.skipText}>No thanks</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header:       { backgroundColor: '#3B2F2A', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle:  { color: '#F6F3EE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  loading:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:      { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#3B2F2A', marginBottom: 12 },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#3B2F2A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardUnpaid:   { borderWidth: 1, borderColor: '#fecaca' },
  cardRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceNum:   { fontSize: 12, color: '#C8BFB6', fontFamily: 'monospace' },
  dueDate:      { fontSize: 12, color: '#C8BFB6', marginTop: 2 },
  total:        { fontSize: 20, fontWeight: '700', color: '#3B2F2A' },
  badge:        { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeText:    { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  payBtn:       { backgroundColor: '#C9A24D', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  payBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const md = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F6F3EE', padding: 20, paddingTop: 12 },
  handle:     { width: 40, height: 4, backgroundColor: '#C8BFB6', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  invoiceNum: { fontSize: 20, fontWeight: '700', color: '#3B2F2A', marginBottom: 20 },
  lineItem:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F6F3EE' },
  lineDesc:   { fontSize: 14, color: '#3B2F2A' },
  lineQty:    { fontSize: 12, color: '#C8BFB6', marginTop: 2 },
  lineAmt:    { fontSize: 14, fontWeight: '600', color: '#3B2F2A' },
  divider:    { height: 1, backgroundColor: '#C8BFB6', marginVertical: 16 },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { fontSize: 13, color: '#C8BFB6' },
  totalVal:   { fontSize: 13, color: '#3B2F2A' },
  grandTotal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#C8BFB6' },
  grandLabel: { fontSize: 16, fontWeight: '700', color: '#3B2F2A' },
  grandVal:   { fontSize: 20, fontWeight: '700', color: '#3B2F2A' },
  payBtn:     { backgroundColor: '#C9A24D', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 24 },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  closeBtn:   { padding: 16, alignItems: 'center' },
  closeBtnText: { color: '#C8BFB6', fontSize: 14 },
});

const tp = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title:         { fontSize: 20, fontWeight: '700', color: '#3B2F2A', textAlign: 'center', marginBottom: 6 },
  subtitle:      { fontSize: 14, color: '#C8BFB6', textAlign: 'center', marginBottom: 24 },
  optionRow:     { flexDirection: 'row', gap: 12, marginBottom: 20 },
  option:        { flex: 1, borderWidth: 1, borderColor: '#C8BFB6', borderRadius: 12, padding: 16, alignItems: 'center' },
  optionActive:  { backgroundColor: '#C9A24D', borderColor: '#C9A24D' },
  optPct:        { fontSize: 16, fontWeight: '700', color: '#3B2F2A' },
  optAmt:        { fontSize: 12, color: '#C8BFB6', marginTop: 2 },
  optTextActive: { color: '#fff' },
  sendBtn:       { backgroundColor: '#C9A24D', borderRadius: 12, padding: 16, alignItems: 'center' },
  sendBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipBtn:       { padding: 16, alignItems: 'center' },
  skipText:      { color: '#C8BFB6', fontSize: 14 },
});
