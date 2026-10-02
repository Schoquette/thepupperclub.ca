import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

const SOURCE_BADGE: Record<string, 'gray' | 'blue' | 'gold'> = {
  manual: 'gray', import: 'blue', receipt_scan: 'gold',
};

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manual', import: 'Imported', receipt_scan: 'Scanned',
};

interface ExpenseForm {
  expense_date: string;
  item: string;
  vendor: string;
  category: string;
  subtotal: string;
  gst: string;
  pst: string;
}

const BLANK_FORM: ExpenseForm = {
  expense_date: '', item: '', vendor: '', category: '', subtotal: '', gst: '', pst: '',
};

function computeTotal(form: ExpenseForm): number {
  const subtotal = parseFloat(form.subtotal) || 0;
  const gst = parseFloat(form.gst) || 0;
  const pst = parseFloat(form.pst) || 0;
  return subtotal + gst + pst;
}

function ExpenseFields({ form, setForm, categories }: { form: ExpenseForm; setForm: React.Dispatch<React.SetStateAction<ExpenseForm>>; categories: string[] }) {
  return (
    <div className="space-y-4">
      <Input
        label="Date"
        type="date"
        value={form.expense_date}
        onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
      />
      <Input
        label="Item / Description"
        value={form.item}
        onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
        placeholder="e.g. Poop bags (bulk)"
      />
      <Input
        label="Vendor"
        value={form.vendor}
        onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
        placeholder="e.g. Costco"
      />
      <Select
        label="Category"
        value={form.category}
        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        options={categories.map(c => ({ value: c, label: c }))}
      />
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Subtotal"
          type="number"
          step="0.01"
          value={form.subtotal}
          onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))}
        />
        <Input
          label="GST"
          type="number"
          step="0.01"
          value={form.gst}
          onChange={e => setForm(f => ({ ...f, gst: e.target.value }))}
        />
        <Input
          label="PST"
          type="number"
          step="0.01"
          value={form.pst}
          onChange={e => setForm(f => ({ ...f, pst: e.target.value }))}
        />
      </div>
      <div className="flex items-center justify-between bg-cream rounded-lg px-4 py-3">
        <span className="text-sm font-semibold text-espresso">Total</span>
        <span className="text-lg font-bold text-espresso">${computeTotal(form).toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function AdminAccountingPage() {
  const qc = useQueryClient();
  const [monthFilter, setMonthFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);

  const filterParams = {
    month: monthFilter || undefined,
    vendor: vendorFilter || undefined,
    category: categoryFilter || undefined,
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['accounting-dashboard'] });
    qc.invalidateQueries({ queryKey: ['accounting-expenses'] });
    qc.invalidateQueries({ queryKey: ['accounting-vendors'] });
  };

  const { data: dashboard } = useQuery({
    queryKey: ['accounting-dashboard', monthFilter, vendorFilter, categoryFilter],
    queryFn: () => api.get('/admin/accounting/dashboard', { params: filterParams }).then(r => r.data.data),
  });

  const { data: vendors } = useQuery({
    queryKey: ['accounting-vendors'],
    queryFn: () => api.get('/admin/accounting/vendors').then(r => r.data.data ?? []),
  });

  const { data: categoryRows } = useQuery({
    queryKey: ['accounting-categories'],
    queryFn: () => api.get('/admin/accounting/categories').then(r => r.data.data ?? []),
  });
  const categories: string[] = (categoryRows ?? []).map((c: any) => c.name);

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-expenses', monthFilter, vendorFilter, categoryFilter],
    queryFn: () => api.get('/admin/accounting/expenses', { params: filterParams }).then(r => r.data),
  });

  const hasActiveFilters = !!(monthFilter || vendorFilter || categoryFilter);
  const monthLabel = monthFilter
    ? format(new Date(`${monthFilter}-01T00:00:00`), 'MMMM yyyy')
    : 'This Month';
  const filteredTotal = Number(dashboard?.filtered_total ?? 0);
  const filteredCount = dashboard?.filtered_count ?? data?.data?.length ?? 0;

  // ── Add/Edit modal ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState<{ id: number } | 'new' | null>(null);
  const [form, setForm] = useState<ExpenseForm>(BLANK_FORM);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [formSource, setFormSource] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState('');

  const openAdd = () => {
    setEditing('new');
    setForm({ ...BLANK_FORM, category: categories[0] ?? '' });
    setReceiptFile(null); setFormSource(undefined); setFormError('');
  };
  const openEdit = (exp: any) => {
    setEditing({ id: exp.id });
    setForm({
      expense_date: exp.expense_date ? String(exp.expense_date).slice(0, 10) : '',
      item: exp.item ?? '',
      vendor: exp.vendor ?? '',
      category: exp.category ?? 'Other',
      subtotal: exp.subtotal != null ? String(exp.subtotal) : '',
      gst: exp.gst != null ? String(exp.gst) : '',
      pst: exp.pst != null ? String(exp.pst) : '',
    });
    setReceiptFile(null); setFormSource(undefined); setFormError('');
  };
  const closeForm = () => { setEditing(null); setForm(BLANK_FORM); setReceiptFile(null); setFormSource(undefined); setFormError(''); };

  // Blank fields are omitted entirely rather than sent as '' -- Laravel's
  // `nullable` rule only skips validation for an absent field, not an empty
  // string, so appending '' for a `date`/`numeric` field would 422.
  const appendExpenseFields = (fd: FormData, f: ExpenseForm) => {
    if (f.expense_date) fd.append('expense_date', f.expense_date);
    if (f.item) fd.append('item', f.item);
    if (f.vendor) fd.append('vendor', f.vendor);
    if (f.category) fd.append('category', f.category);
    if (f.subtotal) fd.append('subtotal', f.subtotal);
    if (f.gst) fd.append('gst', f.gst);
    if (f.pst) fd.append('pst', f.pst);
  };

  const buildExpenseFormData = () => {
    const fd = new FormData();
    appendExpenseFields(fd, form);
    if (receiptFile) fd.append('receipt', receiptFile);
    if (formSource) fd.append('source', formSource);
    return fd;
  };

  const fdConfig = { headers: { 'Content-Type': 'multipart/form-data' } };

  const saveExpense = useMutation({
    mutationFn: () => {
      const fd = buildExpenseFormData();
      return editing && editing !== 'new'
        ? api.post(`/admin/accounting/expenses/${editing.id}`, fd, fdConfig)
        : api.post('/admin/accounting/expenses', fd, fdConfig);
    },
    onSuccess: () => { invalidateAll(); closeForm(); },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Failed to save expense.'),
  });

  const deleteExpense = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/accounting/expenses/${id}`),
    onSuccess: () => invalidateAll(),
  });

  // ── Export ──────────────────────────────────────────────────────────────
  const [downloading, setDownloading] = useState(false);
  const downloadExport = async (fmt: 'csv' | 'pdf') => {
    setDownloading(true);
    try {
      const response = await api.get('/admin/accounting/export', {
        params: { ...filterParams, format: fmt },
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses_${monthFilter || 'all'}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadReceipt = async (expenseId: number) => {
    try {
      const response = await api.get(`/admin/accounting/expenses/${expenseId}/receipt`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      window.open(url, '_blank');
    } catch {
      alert('Could not load receipt.');
    }
  };

  const downloadImportTemplate = async () => {
    try {
      const response = await api.get('/admin/accounting/import-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'expense_import_template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Could not download template.');
    }
  };

  // ── Import modal ────────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const importExpenses = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/admin/accounting/import', fd, fdConfig).then(r => r.data);
    },
    onSuccess: (result) => { setImportResult(result); invalidateAll(); },
    onError: (e: any) => setImportResult({ failed: e.response?.data?.message ?? 'Import failed.', inserted: 0, incomplete: 0, defaulted_to_other: 0, auto_categorized: 0 }),
  });

  const closeImport = () => { setShowImport(false); setImportResult(null); };

  // ── Manage Categories modal ─────────────────────────────────────────────
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [categoryError, setCategoryError] = useState('');

  const invalidateCategories = () => {
    qc.invalidateQueries({ queryKey: ['accounting-categories'] });
    invalidateAll();
  };

  const addCategory = useMutation({
    mutationFn: (name: string) => api.post('/admin/accounting/categories', { name }),
    onSuccess: () => { setNewCategoryName(''); setCategoryError(''); invalidateCategories(); },
    onError: (e: any) => setCategoryError(e.response?.data?.message ?? 'Failed to add category.'),
  });

  const renameCategory = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.patch(`/admin/accounting/categories/${id}`, { name }),
    onSuccess: () => { setRenamingId(null); setCategoryError(''); invalidateCategories(); },
    onError: (e: any) => setCategoryError(e.response?.data?.message ?? 'Failed to rename category.'),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/accounting/categories/${id}`),
    onSuccess: () => { setCategoryError(''); invalidateCategories(); },
    onError: (e: any) => setCategoryError(e.response?.data?.message ?? 'Failed to delete category.'),
  });

  // ── Scan Receipt modal ──────────────────────────────────────────────────
  const [showScan, setShowScan] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanForm, setScanForm] = useState<ExpenseForm>(BLANK_FORM);
  const [scanMessage, setScanMessage] = useState('');
  const [scanConfirming, setScanConfirming] = useState(false);
  const [scanSaveError, setScanSaveError] = useState('');

  const closeScan = () => {
    setShowScan(false); setScanFile(null); setScanPreview(null);
    setScanForm(BLANK_FORM); setScanMessage(''); setScanConfirming(false); setScanSaveError('');
  };

  const extractReceipt = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('receipt', file);
      return api.post('/admin/accounting/receipts/extract', fd, fdConfig).then(r => r.data);
    },
    onSuccess: (res) => {
      if (res.success) {
        setScanForm({
          expense_date: res.data.date ?? '',
          item: res.data.item ?? '',
          vendor: res.data.vendor ?? '',
          category: res.data.category ?? categories[0] ?? '',
          subtotal: res.data.subtotal != null ? String(res.data.subtotal) : '',
          gst: res.data.gst != null ? String(res.data.gst) : '',
          pst: res.data.pst != null ? String(res.data.pst) : '',
        });
      } else {
        setScanMessage(res.message);
        setScanForm(BLANK_FORM);
      }
      setScanConfirming(true);
    },
    onError: () => {
      setScanMessage("Couldn't read this receipt automatically. Please enter the details manually.");
      setScanForm(BLANK_FORM);
      setScanConfirming(true);
    },
  });

  const onScanFileSelect = (file: File) => {
    setScanFile(file);
    setScanPreview(URL.createObjectURL(file));
    setScanMessage('');
    extractReceipt.mutate(file);
  };

  const saveScannedExpense = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      appendExpenseFields(fd, scanForm);
      if (scanFile) fd.append('receipt', scanFile);
      fd.append('source', 'receipt_scan');
      return api.post('/admin/accounting/expenses', fd, fdConfig);
    },
    onSuccess: () => { invalidateAll(); closeScan(); },
    onError: (e: any) => setScanSaveError(e.response?.data?.message ?? 'Failed to save expense.'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">Accounting</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowScan(true)}>📷 Scan Receipt</Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>Import Spreadsheet</Button>
          <Button size="sm" onClick={openAdd}>+ Add Expense</Button>
        </div>
      </div>

      {/* Summary cards */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card padding="sm">
            <div className="text-2xl font-bold text-espresso">${Number(dashboard.total_this_month ?? 0).toFixed(2)}</div>
            <div className="text-xs text-taupe mt-0.5">Total This Month</div>
          </Card>
          <Card padding="sm">
            <div className="text-2xl font-bold text-espresso">${filteredTotal.toFixed(2)}</div>
            <div className="text-xs text-taupe mt-0.5">Filtered Total ({monthLabel})</div>
          </Card>
        </div>
      )}

      {/* By-category breakdown */}
      {dashboard?.by_category?.length > 0 && (
        <Card padding="sm">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowCategoryBreakdown(s => !s)}
          >
            <span className="font-semibold text-espresso text-sm">By Category</span>
            <span className="text-taupe text-sm">{showCategoryBreakdown ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showCategoryBreakdown && (
            <div className="mt-3 space-y-2">
              {dashboard.by_category.map((row: any) => (
                <div key={row.category} className="flex items-center justify-between text-sm">
                  <span className="text-espresso">{row.category}</span>
                  <span className="font-medium text-espresso">${Number(row.total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="text-sm border border-taupe/50 rounded-lg px-3 py-2 bg-white text-espresso focus:ring-1 focus:ring-gold"
        />

        <select
          value={vendorFilter}
          onChange={e => setVendorFilter(e.target.value)}
          className="text-sm border border-taupe/50 rounded-lg px-3 py-2 bg-white text-espresso focus:ring-1 focus:ring-gold"
        >
          <option value="">All Vendors</option>
          {vendors?.map((v: string) => <option key={v} value={v}>{v}</option>)}
        </select>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm border border-taupe/50 rounded-lg px-3 py-2 bg-white text-espresso focus:ring-1 focus:ring-gold"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <Button variant="outline" size="sm" onClick={() => setShowCategoryManager(true)}>Manage Categories</Button>

        {hasActiveFilters && (
          <button
            onClick={() => { setMonthFilter(''); setVendorFilter(''); setCategoryFilter(''); }}
            className="text-xs text-taupe hover:text-espresso underline"
          >
            Clear filters
          </button>
        )}

        <div className="flex-1" />

        <Button variant="outline" size="sm" loading={downloading} onClick={() => downloadExport('csv')}>Export CSV</Button>
        <Button variant="outline" size="sm" loading={downloading} onClick={() => downloadExport('pdf')}>Export PDF</Button>
      </div>

      {/* Table */}
      {isLoading ? <PageLoader /> : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream text-left">
                  <th className="px-6 py-4 font-semibold text-espresso">Date</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Item</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Vendor</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Category</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Total</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Source</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((exp: any) => (
                  <tr key={exp.id} className="border-b border-cream last:border-0 hover:bg-cream/50">
                    <td className="px-6 py-4 text-xs text-taupe">
                      {exp.expense_date ? format(new Date(String(exp.expense_date).slice(0, 10) + 'T00:00:00'), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-6 py-4">{exp.item || <span className="text-taupe italic">—</span>}</td>
                    <td className="px-6 py-4">{exp.vendor || <span className="text-taupe italic">—</span>}</td>
                    <td className="px-6 py-4 text-xs text-taupe">{exp.category}</td>
                    <td className="px-6 py-4 font-semibold">${Number(exp.total).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <Badge variant={SOURCE_BADGE[exp.source] ?? 'gray'}>{SOURCE_LABEL[exp.source] ?? exp.source}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {exp.receipt_path && (
                        <button onClick={() => downloadReceipt(exp.id)} className="text-blue text-xs hover:underline mr-3">Receipt</button>
                      )}
                      <button onClick={() => openEdit(exp)} className="text-blue text-xs hover:underline mr-3">Edit</button>
                      <button
                        onClick={() => { if (confirm('Delete this expense?')) deleteExpense.mutate(exp.id); }}
                        className="text-red-500 text-xs hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {!!data?.data?.length && (
                <tfoot>
                  <tr className="border-t-2 border-taupe/30 bg-cream/40">
                    <td className="px-6 py-3 font-semibold text-espresso" colSpan={4}>
                      Total ({filteredCount} expense{filteredCount === 1 ? '' : 's'})
                    </td>
                    <td className="px-6 py-3 font-bold text-espresso" colSpan={3}>${filteredTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {!data?.data?.length && (
            <div className="text-center py-12 text-taupe">No expenses found.</div>
          )}
        </Card>
      )}

      {/* Add/Edit modal */}
      <Modal open={!!editing} onClose={closeForm} title={editing === 'new' ? 'Add Expense' : 'Edit Expense'} size="md">
        <div className="space-y-4">
          <ExpenseFields form={form} setForm={setForm} categories={categories} />
          <div>
            <label className="block text-sm font-semibold text-espresso mb-1">Receipt (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              loading={saveExpense.isPending}
              onClick={() => saveExpense.mutate()}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import modal */}
      <Modal open={showImport} onClose={closeImport} title="Import Spreadsheet" size="md">
        <div className="space-y-4">
          <p className="text-sm text-taupe">
            Upload a CSV or Excel file with columns: date, item, vendor, category, subtotal, gst, pst.
            Rows with missing info are still imported — fill in the gaps later from the list.
            Rows with a missing or unrecognized category are auto-categorized based on vendor/item, falling back to "Other" if nothing fits.
          </p>
          <button onClick={downloadImportTemplate} className="text-sm text-blue hover:underline">
            Download template
          </button>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) { setImportResult(null); importExpenses.mutate(file); }
            }}
            className="text-sm block"
          />
          {importExpenses.isPending && <p className="text-sm text-taupe">Importing…</p>}
          {importResult && (
            <div className="space-y-2">
              {importResult.failed ? (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{importResult.failed}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-espresso">
                    {importResult.inserted} expense{importResult.inserted === 1 ? '' : 's'} imported
                    {importResult.defaulted_to_other > 0 && `, ${importResult.defaulted_to_other} categorized as "Other"`}
                  </p>
                  {importResult.auto_categorized > 0 && (
                    <p className="text-sm text-taupe">
                      {importResult.auto_categorized} expense{importResult.auto_categorized === 1 ? ' was' : 's were'} auto-categorized based on vendor/item — double-check these from the list.
                    </p>
                  )}
                  {importResult.incomplete > 0 && (
                    <p className="text-sm text-taupe">
                      {importResult.incomplete} of those {importResult.incomplete === 1 ? 'is' : 'are'} missing some details (date, item, vendor, or subtotal) — edit them from the list to fill in the rest.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={closeImport}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Manage Categories modal */}
      <Modal open={showCategoryManager} onClose={() => { setShowCategoryManager(false); setCategoryError(''); setRenamingId(null); }} title="Manage Categories" size="sm">
        <div className="space-y-4">
          {categoryError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{categoryError}</p>}
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {(categoryRows ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 py-1.5 border-b border-cream last:border-0">
                {renamingId === c.id ? (
                  <>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      className="flex-1 border border-taupe/50 rounded px-2 py-1 text-sm"
                    />
                    <button
                      className="text-xs text-gold hover:text-espresso font-medium"
                      onClick={() => renameValue.trim() && renameCategory.mutate({ id: c.id, name: renameValue.trim() })}
                    >
                      Save
                    </button>
                    <button className="text-xs text-taupe hover:text-espresso" onClick={() => setRenamingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-espresso">{c.name}</span>
                    <button
                      className="text-xs text-blue hover:underline"
                      onClick={() => { setRenamingId(c.id); setRenameValue(c.name); setCategoryError(''); }}
                    >
                      Rename
                    </button>
                    {c.name !== 'Other' && (
                      <button
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => { if (confirm(`Delete "${c.name}"? Expenses using it will move to "Other".`)) deleteCategory.mutate(c.id); }}
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-cream">
            <input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="flex-1 border border-taupe/50 rounded-lg px-3 py-2 text-sm"
            />
            <Button
              size="sm"
              loading={addCategory.isPending}
              disabled={!newCategoryName.trim()}
              onClick={() => addCategory.mutate(newCategoryName.trim())}
            >
              Add
            </Button>
          </div>
        </div>
      </Modal>

      {/* Scan Receipt modal */}
      <Modal open={showScan} onClose={closeScan} title="Scan Receipt" size="md">
        <div className="space-y-4">
          {!scanConfirming ? (
            <>
              <p className="text-sm text-taupe">Take or upload a photo of a receipt — we'll try to read the details for you to confirm.</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e => { const file = e.target.files?.[0]; if (file) onScanFileSelect(file); }}
                className="text-sm block"
              />
              {extractReceipt.isPending && <p className="text-sm text-taupe">Reading receipt…</p>}
            </>
          ) : (
            <>
              {scanPreview && (
                <img src={scanPreview} alt="Receipt preview" className="max-h-48 rounded-lg mx-auto" />
              )}
              {scanMessage && (
                <p className="text-sm text-taupe bg-cream rounded-lg px-3 py-2">{scanMessage}</p>
              )}
              <ExpenseFields form={scanForm} setForm={setScanForm} categories={categories} />
              {scanSaveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{scanSaveError}</p>}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeScan}>Cancel</Button>
                <Button
                  loading={saveScannedExpense.isPending}
                  onClick={() => saveScannedExpense.mutate()}
                >
                  Confirm & Save
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
