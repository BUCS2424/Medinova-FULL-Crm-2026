import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import { FeatureProvider } from "./contexts/FeatureContext";
import { BrandingProvider } from "./contexts/BrandingContext";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import LeadsPage from "./pages/LeadsPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import OrdersPage from "./pages/OrdersPage";
import SuppliersPage from "./pages/SuppliersPage";
import DocumentsPage from "./pages/DocumentsPage";
import UsersPage from "./pages/UsersPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import DoctorPortalPage from "./pages/DoctorPortalPage";
import DoctorsPage from "./pages/DoctorsPage";
import InsuranceVerificationPage from "./pages/InsuranceVerificationPage";
import DevSettingsPage from "./pages/DevSettingsPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import ProductCatalogPage from "./pages/ProductCatalogPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import LocationsPage from "./pages/LocationsPage";
import LocationDetailPage from "./pages/LocationDetailPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import FaxCenterPage from "./pages/FaxCenterPage";
import NewsletterPage from "./pages/NewsletterPage";
import WriteReviewPage from "./pages/WriteReviewPage";
import UserProfilePage from "./pages/UserProfilePage";
import AdminChatWindowPage from "./pages/AdminChatWindowPage";
import SupportTicketsPage from "./pages/SupportTicketsPage";
import RoundRobinSettingsPage from "./pages/RoundRobinSettingsPage";
import VoiceSettingsPage from "./pages/VoiceSettingsPage";
import VoicemailSettingsPage from "./pages/VoicemailSettingsPage";
import VoicemailInboxPage from "./pages/VoicemailInboxPage";
import TelnyxSettingsPage from "./pages/TelnyxSettingsPage";
import PatientSigningPage from "./pages/PatientSigningPage";
import PatientPortalPage from "./pages/PatientPortalPage";
import LegalDocumentPage from "./pages/LegalDocumentPage";
import DialerWindowPage from "./pages/DialerWindowPage";
import ConsentAuditPage from "./pages/ConsentAuditPage";
import VideoRoomPage from "./pages/VideoRoomPage";
import CampaignPage from "./pages/CampaignPage";
import MedicareResourcesPage from "./pages/MedicareResourcesPage";
import StayUpToDatePage from "./pages/StayUpToDatePage";

// Components
import Layout from "./components/Layout";
import ChatWidget from "./components/ChatWidget";

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false, superAdminOnly = false }) => {
  const { isAuthenticated, loading, isAdmin, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (superAdminOnly && user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Public Route Component (redirects if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      
      {/* Doctor Portal - Public (uses magic link auth) */}
      <Route
        path="/doctor-portal"
        element={<DoctorPortalPage />}
      />

      {/* Public Product Catalog */}
      <Route
        path="/products"
        element={<ProductCatalogPage />}
      />
      
      {/* Category Page (SEO - /products/:categorySlug) */}
      <Route
        path="/products/category/:categorySlug"
        element={<ProductCatalogPage />}
      />

      {/* Individual Product Detail Page (SEO - /products/:categorySlug/:productSlug) */}
      <Route
        path="/products/:categorySlug/:productSlug"
        element={<ProductDetailPage />}
      />

      {/* Legacy Individual Product Detail Page (SEO) */}
      <Route
        path="/products/:productSlug"
        element={<ProductDetailPage />}
      />

      {/* Public Service Areas / Locations */}
      <Route
        path="/locations"
        element={<LocationsPage />}
      />
      
      {/* Location detail pages - fallback when Nginx doesn't proxy /locations/*.html */}
      <Route
        path="/locations/:slug"
        element={<LocationDetailPage />}
      />

      {/* Public Medicare Resources Page */}
      <Route
        path="/medicare-resources"
        element={<MedicareResourcesPage />}
      />

      {/* Video Room - public access for participants */}
      <Route
        path="/video-room/:meetingId"
        element={<VideoRoomPage />}
      />

      {/* Campaign Landing Pages */}
      <Route
        path="/c/:slug"
        element={<CampaignPage />}
      />

      {/* Public Write Review Page */}
      <Route
        path="/write-review"
        element={<WriteReviewPage />}
      />

      {/* Admin Chat Window - Opens in separate browser window */}
      <Route
        path="/admin-chat-window"
        element={<AdminChatWindowPage />}
      />

      {/* Dialer Window - Opens in separate browser window */}
      <Route
        path="/dialer-window"
        element={<DialerWindowPage />}
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients"
        element={
          <ProtectedRoute>
            <PatientsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:patientId"
        element={
          <ProtectedRoute>
            <PatientDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:leadId"
        element={
          <ProtectedRoute>
            <LeadDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute>
            <SuppliersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <DocumentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctors"
        element={
          <ProtectedRoute>
            <DoctorsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/insurance-verification"
        element={
          <ProtectedRoute>
            <InsuranceVerificationPage />
          </ProtectedRoute>
        }
      />

      {/* Admin Only Routes */}
      <Route
        path="/users"
        element={
          <ProtectedRoute adminOnly>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute adminOnly>
            <AuditLogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dev-settings"
        element={
          <ProtectedRoute superAdminOnly>
            <DevSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-settings"
        element={
          <ProtectedRoute adminOnly>
            <AdminSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/voice-settings"
        element={
          <ProtectedRoute superAdminOnly>
            <TelnyxSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/voicemail-settings"
        element={
          <ProtectedRoute adminOnly>
            <VoicemailSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/voicemail-inbox"
        element={
          <ProtectedRoute>
            <VoicemailInboxPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/consent-audit"
        element={
          <ProtectedRoute adminOnly>
            <ConsentAuditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute adminOnly>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />

      {/* Fax Center - accessible to admin, sales_manager, super_admin */}
      <Route
        path="/fax-center"
        element={
          <ProtectedRoute>
            <FaxCenterPage />
          </ProtectedRoute>
        }
      />

      {/* Newsletter - accessible to admin, super_admin */}
      <Route
        path="/newsletter"
        element={
          <ProtectedRoute adminOnly>
            <NewsletterPage />
          </ProtectedRoute>
        }
      />

      {/* User Profile - accessible to all authenticated users */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <UserProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Support Tickets */}
      <Route
        path="/support-tickets"
        element={
          <ProtectedRoute>
            <SupportTicketsPage />
          </ProtectedRoute>
        }
      />

      {/* Stay Up To Date - Healthcare Resources */}
      <Route
        path="/stay-up-to-date"
        element={
          <ProtectedRoute>
            <StayUpToDatePage />
          </ProtectedRoute>
        }
      />

      {/* Round Robin Settings - Super Admin only */}
      <Route
        path="/chat-round-robin"
        element={
          <ProtectedRoute adminOnly>
            <RoundRobinSettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Settings */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Patient Document Signing (Public - via email link) */}
      <Route path="/patient/sign/:token" element={<PatientSigningPage />} />
      
      {/* Patient Portal (Protected - logged in patients) */}
      <Route 
        path="/patient/documents" 
        element={
          <ProtectedRoute>
            <PatientPortalPage />
          </ProtectedRoute>
        }
      />

      {/* Legal Documents (Public) */}
      <Route path="/legal/:slug" element={<LegalDocumentPage />} />

      {/* Default - show landing page */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Catch-all - redirect unknown routes to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Only show customer chat widget on public pages (not on admin dashboard)
function PublicChatWidget() {
  const { isAuthenticated } = useAuth();
  const location = window.location.pathname;
  
  // List of public pages where the chat widget should appear
  const publicPages = ['/', '/products', '/locations', '/write-review', '/doctor-portal', '/medicare-resources', '/video-room', '/c'];
  const isPublicPage = publicPages.some(page => location === page || location.startsWith('/products/') || location.startsWith('/locations/') || location.startsWith('/medicare-resources') || location.startsWith('/video-room/') || location.startsWith('/c/'));
  
  // Pages where chat widget should never appear
  const excludedPages = ['/dialer-window', '/admin-chat-window'];
  const isExcludedPage = excludedPages.some(page => location === page || location.startsWith(page));
  
  // Don't show on excluded pages
  if (isExcludedPage) {
    return null;
  }
  
  // Don't show on dashboard/admin pages (when user is authenticated and not on public pages)
  if (isAuthenticated && !isPublicPage) {
    return null;
  }
  
  return <ChatWidget />;
}

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <SidebarProvider>
            <AuthProvider>
              <FeatureProvider>
                <BrandingProvider>
                  <AppRoutes />
                  <PublicChatWidget />
                  <Toaster position="top-right" richColors />
                </BrandingProvider>
              </FeatureProvider>
            </AuthProvider>
          </SidebarProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
