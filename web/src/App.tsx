import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import SetPasswordPage from './pages/auth/SetPasswordPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Admin pages
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/DashboardPage';
import AdminClientsPage from './pages/admin/ClientsPage';
import AdminClientDetailPage from './pages/admin/ClientDetailPage';
import AdminCalendarPage from './pages/admin/CalendarPage';
import AdminServiceRequestsPage from './pages/admin/ServiceRequestsPage';
import AdminInboxPage from './pages/admin/InboxPage';
import AdminConversationPage from './pages/admin/ConversationPage';
import AdminInvoicesPage from './pages/admin/InvoicesPage';
import AdminInvoiceDetailPage from './pages/admin/InvoiceDetailPage';
import AdminInvoiceCreatePage from './pages/admin/InvoiceCreatePage';
import AdminIntakeFormPage from './pages/admin/IntakeFormPage';
import AdminReportCardsPage from './pages/admin/ReportCardsPage';
import AdminReportCardFormPage from './pages/admin/ReportCardFormPage';
import AdminBroadcastPage from './pages/admin/BroadcastPage';
import AdminAuditLogsPage from './pages/admin/AuditLogsPage';

// Client pages
import ClientLayout from './components/client/ClientLayout';
import ClientDashboardPage from './pages/client/DashboardPage';
import ClientOnboardingPage from './pages/client/OnboardingPage';
import ClientProfilePage from './pages/client/ProfilePage';
import ClientDogsPage from './pages/client/DogsPage';
import ClientAppointmentsPage from './pages/client/AppointmentsPage';
import ClientMessagesPage from './pages/client/MessagesPage';
import ClientInvoicesPage from './pages/client/InvoicesPage';
import ClientBillingPage from './pages/client/BillingPage';
import ClientReportCardsPage from './pages/client/ReportCardsPage';

function RequireAuth({ children, role }: { children: React.ReactNode; role?: 'admin' | 'client' }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

      {/* Root redirect */}
      <Route
        path="/"
        element={
          user?.role === 'admin'
            ? <Navigate to="/admin" replace />
            : user?.role === 'client'
            ? <Navigate to="/client" replace />
            : <Navigate to="/login" replace />
        }
      />

      {/* Admin */}
      <Route path="/admin" element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="clients" element={<AdminClientsPage />} />
        <Route path="clients/:id" element={<AdminClientDetailPage />} />
        <Route path="clients/:id/intake" element={<AdminIntakeFormPage />} />
        <Route path="calendar" element={<AdminCalendarPage />} />
        <Route path="service-requests" element={<AdminServiceRequestsPage />} />
        <Route path="inbox" element={<AdminInboxPage />} />
        <Route path="inbox/:clientId" element={<AdminConversationPage />} />
        <Route path="invoices" element={<AdminInvoicesPage />} />
        <Route path="invoices/new" element={<AdminInvoiceCreatePage />} />
        <Route path="invoices/:id" element={<AdminInvoiceDetailPage />} />
        <Route path="report-cards" element={<AdminReportCardsPage />} />
        <Route path="report-cards/new" element={<AdminReportCardFormPage />} />
        <Route path="report-cards/:id" element={<AdminReportCardFormPage />} />
        <Route path="broadcast" element={<AdminBroadcastPage />} />
        <Route path="audit-logs" element={<AdminAuditLogsPage />} />
      </Route>

      {/* Client */}
      <Route path="/client" element={<RequireAuth role="client"><ClientLayout /></RequireAuth>}>
        <Route index element={<ClientDashboardPage />} />
        <Route path="onboarding" element={<ClientOnboardingPage />} />
        <Route path="profile" element={<ClientProfilePage />} />
        <Route path="dogs" element={<ClientDogsPage />} />
        <Route path="appointments" element={<ClientAppointmentsPage />} />
        <Route path="messages" element={<ClientMessagesPage />} />
        <Route path="invoices" element={<ClientInvoicesPage />} />
        <Route path="billing" element={<ClientBillingPage />} />
        <Route path="report-cards" element={<ClientReportCardsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
