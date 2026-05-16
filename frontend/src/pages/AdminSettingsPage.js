import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import axios from 'axios';
import AnalyticsPage from './AnalyticsPage';
import UsersPage from './UsersPage';
import AuditLogsPage from './AuditLogsPage';
import AccountingDashboard from '../components/AccountingDashboard';
import InsuranceDirectory from '../components/InsuranceDirectory';
import SuppliersPage from './SuppliersPage';
import DoctorsPage from './DoctorsPage';
import RoleManagement from '../components/RoleManagement';
import DirectorySubmissionManager from '../components/DirectorySubmissionManager';
import ReviewsManager from '../components/ReviewsManager';
import ChatDashboard from '../components/ChatDashboard';
import PhoneCDRDashboard from '../components/PhoneCDRDashboard';
import ComplianceApisSettings from '../components/ComplianceApisSettings';
import AvailitySettings from '../components/AvailitySettings';
import WaystarSettings from '../components/WaystarSettings';
import OfficeAllySettings from '../components/OfficeAllySettings';
import MarketingCampaigns from '../components/MarketingCampaigns';
import LeadIntakeHub from '../components/LeadIntakeHub';
import {
  BarChart3,
  Users,
  CreditCard,
  Bell,
  Shield,
  Mail,
  MessageSquare,
  Megaphone,
  FileText,
  Sliders,
  Store,
  Truck,
  ScrollText,
  Calculator,
  Building2,
  Package,
  Stethoscope,
  Key,
  Globe,
  Star,
  MessageCircle,
  RotateCcw,
  EyeOff,
  Phone,
  Voicemail,
  Scale
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
// Admin settings menu items
const adminMenuItems = [
  { id: 'analytics', icon: BarChart3, label: 'Site Analytics', description: 'Traffic & visitor insights' },
  { id: 'consent-audit', icon: Scale, label: 'Consent Audit', description: 'TCPA compliance records', link: '/admin/consent-audit' },
  { id: 'compliance', icon: Shield, label: 'Compliance APIs', description: 'Jornaya & TrustedForm' },
  { id: 'availity', icon: Building2, label: 'Availity', description: 'Healthcare eligibility' },
  { id: 'waystar', icon: Shield, label: 'Waystar', description: 'Revenue cycle management' },
  { id: 'officeally', icon: Building2, label: 'Office Ally', description: 'EDI clearinghouse' },
  { id: 'chat', icon: MessageCircle, label: 'Chat Dashboard', description: 'Live chat & Joffry AI' },
  { id: 'phone', icon: Phone, label: 'Phone', description: 'Call logs & usage stats' },
  { id: 'voicemail', icon: Voicemail, label: 'Voicemail', description: 'Voicemail greetings', link: '/admin/voicemail-settings' },
  { id: 'round-robin', icon: RotateCcw, label: 'Round Robin', description: 'Chat agent rotation', link: '/chat-round-robin' },
  { id: 'accounting', icon: Calculator, label: 'Accounting', description: 'Income, expenses & reports' },
  { id: 'reviews', icon: Star, label: 'Reviews', description: 'Customer testimonials' },
  { id: 'doctors', icon: Stethoscope, label: 'Doctors', description: 'Referring physicians' },
  { id: 'suppliers', icon: Package, label: 'Suppliers', description: 'Vendor & inventory management' },
  { id: 'insurance', icon: Building2, label: 'Insurance Directory', description: 'Payer contacts & info' },
  { id: 'directory-submission', icon: Globe, label: 'Directory Submission', description: 'Submit to business directories' },
  { id: 'marketing-campaigns', icon: Megaphone, label: 'Marketing Campaigns', description: 'PPC & campaign landing pages' },
  { id: 'lead-intake', icon: Key, label: 'Lead Intake Hub', description: 'External form API keys & embeds' },
  { id: 'users', icon: Users, label: 'User Management', description: 'Manage staff & permissions' },
  { id: 'roles', icon: Key, label: 'Role Management', description: 'Roles & permissions' },
  { id: 'audit-logs', icon: ScrollText, label: 'Audit Logs', description: 'System activity history' },
  { id: 'billing', icon: CreditCard, label: 'Billing', description: 'Subscription & payments', disabled: true },
  { id: 'notifications', icon: Bell, label: 'Notifications', description: 'Alert preferences', disabled: true },
  { id: 'security', icon: Shield, label: 'Security', description: 'Login & 2FA settings', disabled: true },
  { id: 'email', icon: Mail, label: 'Email Templates', description: 'Customize notifications', disabled: true },
  { id: 'sms', icon: MessageSquare, label: 'SMS Settings', description: 'Twilio configuration', disabled: true },
  { id: 'marketing', icon: Megaphone, label: 'Marketing', description: 'Campaigns & automation', disabled: true },
  { id: 'reports', icon: FileText, label: 'Reports', description: 'Export & scheduling', disabled: true },
  { id: 'integrations', icon: Sliders, label: 'Integrations', description: 'Third-party connections', disabled: true },
  { id: 'store', icon: Store, label: 'Store Settings', description: 'Business info & branding', disabled: true },
  { id: 'shipping', icon: Truck, label: 'Shipping', description: 'Delivery & fulfillment', disabled: true },
];

// Feature-controlled items
const FEATURE_CONTROLLED_ITEMS = {
  'reviews': 'testimonials',
  'compliance': ['jornaya_tracking', 'trustedform_cert'],
  'availity': 'availity_integration',
  'waystar': 'waystar_integration',
  'officeally': 'officeally_integration',
  'marketing-campaigns': 'marketing_campaigns',
  'lead-intake': 'lead_intake_hub',
  'phone': 'phone_dialer',
  'voicemail': 'phone_dialer'
};

export default function AdminSettingsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = searchParams.get('tab');
  // Initialize with tab param if valid, otherwise default to 'analytics'
  const initialTab = tabParam && adminMenuItems.find(item => item.id === tabParam) ? tabParam : 'analytics';
  const [activeSection, setActiveSection] = useState(initialTab);
  const [featureFlags, setFeatureFlags] = useState({});

  useEffect(() => {
    fetchFeatureFlags();
  }, []);

  const fetchFeatureFlags = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/features`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeatureFlags(response.data.features || {});
    } catch (error) {
      console.error('Failed to fetch feature flags');
    }
  };

  const isFeatureEnabled = (itemId) => {
    const featureId = FEATURE_CONTROLLED_ITEMS[itemId];
    if (!featureId) return true; // Not feature-controlled
    // If array, show only if ALL of the features are enabled
    if (Array.isArray(featureId)) {
      return featureId.every(fid => featureFlags[fid] === true);
    }
    return featureFlags[featureId] === true;
  };

  const handleMenuClick = (item) => {
    if (item.link) {
      navigate(item.link);
    } else if (!item.disabled) {
      setActiveSection(item.id);
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'analytics':
        return <AnalyticsPage embedded />;
      case 'chat':
        return <ChatDashboard />;
      case 'phone':
        return <PhoneCDRDashboard />;
      case 'accounting':
        return <AccountingDashboard />;
      case 'reviews':
        return <ReviewsManager />;
      case 'doctors':
        return <DoctorsPage embedded />;
      case 'suppliers':
        return <SuppliersPage embedded />;
      case 'insurance':
        return <InsuranceDirectory />;
      case 'directory-submission':
        return <DirectorySubmissionManager />;
      case 'users':
        return <UsersPage embedded />;
      case 'roles':
        return <RoleManagement />;
      case 'audit-logs':
        return <AuditLogsPage embedded />;
      case 'compliance':
        return <ComplianceApisSettings />;
      case 'availity':
        return <AvailitySettings />;
      case 'waystar':
        return <WaystarSettings />;
      case 'officeally':
        return <OfficeAllySettings />;
      case 'marketing-campaigns':
        return <MarketingCampaigns />;
      case 'lead-intake':
        return <LeadIntakeHub />;
      case 'billing':
        return <ComingSoonCard title="Billing & Subscription" description="Manage your subscription plan, payment methods, and billing history." />;
      case 'notifications':
        return <ComingSoonCard title="Notification Preferences" description="Configure how and when you receive alerts and updates." />;
      case 'security':
        return <ComingSoonCard title="Security Settings" description="Manage two-factor authentication, password policies, and login history." />;
      case 'email':
        return <ComingSoonCard title="Email Templates" description="Customize email notifications sent to patients, doctors, and staff." />;
      case 'sms':
        return <ComingSoonCard title="SMS Settings" description="Configure Twilio integration for SMS notifications and magic links." />;
      case 'marketing':
        return <ComingSoonCard title="Marketing & Campaigns" description="Create and manage marketing campaigns and automated sequences." />;
      case 'reports':
        return <ComingSoonCard title="Reports & Exports" description="Generate custom reports and schedule automated data exports." />;
      case 'integrations':
        return <ComingSoonCard title="Third-Party Integrations" description="Connect with NikoHealth, insurance verification, and other services." />;
      case 'store':
        return <ComingSoonCard title="Store Settings" description="Update business information, logo, and branding preferences." />;
      case 'shipping':
        return <ComingSoonCard title="Shipping & Fulfillment" description="Configure delivery options and fulfillment workflows." />;
      default:
        return <AnalyticsPage embedded />;
    }
  };

  return (
    <div className="flex gap-6" data-testid="admin-settings-page">
      {/* Admin Side Menu */}
      <div className="w-64 flex-shrink-0">
        <div className="sticky top-20 space-y-2">
          <div className="mb-4">
            <h2 className="font-semibold text-sm uppercase text-muted-foreground">Admin Settings</h2>
          </div>
          {adminMenuItems.map((item) => {
            const featureEnabled = isFeatureEnabled(item.id);
            
            // HIDE completely if feature is disabled (not just show "Off" badge)
            if (!featureEnabled) {
              return null;
            }
            
            return (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item)}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                activeSection === item.id && !item.link
                  ? 'bg-primary text-primary-foreground' 
                  : item.disabled 
                    ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                    : 'hover:bg-muted text-foreground'
              }`}
              data-testid={`admin-menu-${item.id}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.label}</p>
                <p className={`text-xs truncate ${activeSection === item.id && !item.link ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {item.description}
                </p>
              </div>
              {item.disabled && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Soon</Badge>
              )}
            </button>
          )})}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
}

// Coming Soon placeholder card
function ComingSoonCard({ title, description }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary" className="text-sm">Coming Soon</Badge>
          <p className="text-sm text-muted-foreground mt-4">
            This feature is currently under development and will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
