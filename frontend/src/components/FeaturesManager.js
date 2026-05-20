import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Settings,
  ToggleLeft,
  Loader2,
  Save,
  RefreshCw,
  Shield,
  Users,
  FileText,
  Phone,
  MapPin,
  ShoppingCart,
  CreditCard,
  Bell,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  Globe,
  MessageSquare,
  Calendar,
  BarChart3,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  UserPlus,
  Star,
  Printer,
  PhoneCall
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Feature definitions with metadata
const FEATURE_DEFINITIONS = [
  {
    id: 'patient_portal',
    name: 'Patient Portal',
    description: 'Allow patients to log in, view their information, and manage their account',
    category: 'core',
    icon: Users,
    defaultEnabled: true,
    impact: 'high'
  },
  {
    id: 'user_registration',
    name: 'User Registration',
    description: 'Allow new users to register accounts through the public registration page',
    category: 'core',
    icon: UserPlus,
    defaultEnabled: true,
    impact: 'high'
  },
  {
    id: 'doctor_portal',
    name: 'Doctor Portal',
    description: 'Enable doctor login and patient management features',
    category: 'core',
    icon: Shield,
    defaultEnabled: true,
    impact: 'high'
  },
  {
    id: 'testimonials',
    name: 'Testimonials',
    description: 'Display customer testimonials and reviews on the public website',
    category: 'marketing',
    icon: Star,
    defaultEnabled: true,
    impact: 'low'
  },
  {
    id: 'phone_dialer',
    name: 'Phone / Voice Dialer',
    description: 'Browser-based phone system with IVR menus, call recording, and round-robin routing via Telnyx',
    category: 'communication',
    icon: PhoneCall,
    defaultEnabled: false,
    impact: 'high',
    requiresConfig: true,
    configPath: '/admin/voice-settings'
  },
  {
    id: 'fax_center',
    name: 'Fax Center',
    description: 'HIPAA-compliant faxing via Telnyx for sending and receiving medical faxes',
    category: 'communication',
    icon: Printer,
    defaultEnabled: true,
    impact: 'high',
    requiresConfig: true,
    configPath: '/admin/voice-settings'
  },
  {
    id: 'location_pages',
    name: 'Location Pages',
    description: 'SEO-optimized service area pages for states, counties, and cities',
    category: 'marketing',
    icon: MapPin,
    defaultEnabled: true,
    impact: 'low'
  },
  {
    id: 'product_catalog',
    name: 'Product Catalog',
    description: 'Public product catalog with categories and search',
    category: 'ecommerce',
    icon: ShoppingCart,
    defaultEnabled: true,
    impact: 'medium'
  },
  {
    id: 'online_orders',
    name: 'Online Orders',
    description: 'Allow patients to place orders through the portal',
    category: 'ecommerce',
    icon: CreditCard,
    defaultEnabled: false,
    impact: 'high'
  },
  {
    id: 'notifications',
    name: 'Email Notifications',
    description: 'Send email notifications for orders, appointments, and updates',
    category: 'communication',
    icon: Bell,
    defaultEnabled: false,
    impact: 'medium'
  },
  {
    id: 'sms_notifications',
    name: 'SMS Notifications',
    description: 'Send SMS alerts via Telnyx for important updates and communication',
    category: 'communication',
    icon: MessageSquare,
    defaultEnabled: false,
    impact: 'medium',
    requiresConfig: true,
    configPath: '/dev-settings'
  },
  {
    id: 'live_chat',
    name: 'Live Chat (Joffry AI)',
    description: 'AI-powered chat widget with live agent handoff for customer support',
    category: 'communication',
    icon: MessageSquare,
    defaultEnabled: true,
    impact: 'high'
  },
  {
    id: 'appointment_scheduling',
    name: 'Appointment Scheduling',
    description: 'Allow patients to schedule appointments online',
    category: 'scheduling',
    icon: Calendar,
    defaultEnabled: false,
    impact: 'medium'
  },
  {
    id: 'analytics_dashboard',
    name: 'Analytics Dashboard',
    description: 'Advanced analytics and reporting for admins',
    category: 'analytics',
    icon: BarChart3,
    defaultEnabled: true,
    impact: 'low'
  },
  {
    id: 'document_upload',
    name: 'Document Upload',
    description: 'Allow patients and doctors to upload documents',
    category: 'documents',
    icon: Upload,
    defaultEnabled: true,
    impact: 'medium'
  },
  {
    id: 'document_esign',
    name: 'E-Signatures',
    description: 'Electronic signature capture for forms and documents',
    category: 'documents',
    icon: FileText,
    defaultEnabled: true,
    impact: 'high'
  },
  {
    id: 'patient_tutorial',
    name: 'Patient Onboarding Tutorial',
    description: 'Interactive tutorial for new patients on first login',
    category: 'engagement',
    icon: Sparkles,
    defaultEnabled: true,
    impact: 'low'
  },
  {
    id: 'ai_template_editor',
    name: 'AI Template Editor',
    description: 'AI-powered assistance for editing page templates',
    category: 'ai',
    icon: Zap,
    defaultEnabled: true,
    impact: 'low'
  },
  {
    id: 'doctors_directory',
    name: 'Doctors Directory',
    description: 'Show doctors directory in the main navigation for all users',
    category: 'core',
    icon: Shield,
    defaultEnabled: false,
    impact: 'medium'
  },
  {
    id: 'public_website',
    name: 'Public Website',
    description: 'Public-facing landing page and marketing content',
    category: 'marketing',
    icon: Globe,
    defaultEnabled: true,
    impact: 'high'
  },
  {
    id: 'jornaya_tracking',
    name: 'Jornaya LeadiD Tracking',
    description: 'TCPA-compliant lead tracking with Jornaya universal LeadiD tokens on all public forms',
    category: 'compliance',
    icon: Shield,
    defaultEnabled: false,
    impact: 'high',
    requiresConfig: true,
    configPath: '/admin-settings?tab=compliance'
  },
  {
    id: 'trustedform_cert',
    name: 'TrustedForm Certification',
    description: 'ActiveProspect TrustedForm certificate capture with session replay and bot detection on all public forms',
    category: 'compliance',
    icon: Lock,
    defaultEnabled: false,
    impact: 'high',
    requiresConfig: true,
    configPath: '/admin-settings?tab=compliance'
  },
  {
    id: 'availity_integration',
    name: 'Availity Healthcare',
    description: 'Healthcare eligibility verification and benefits lookup via Availity API',
    category: 'compliance',
    icon: Shield,
    defaultEnabled: false,
    impact: 'high',
    requiresConfig: true,
    configPath: '/admin-settings?tab=availity'
  },
  {
    id: 'waystar_integration',
    name: 'Waystar RCM',
    description: 'Healthcare revenue cycle management — eligibility, claims, prior auth, payments, and denials via Waystar API',
    category: 'compliance',
    icon: Shield,
    defaultEnabled: false,
    impact: 'high',
    requiresConfig: true,
    configPath: '/admin-settings?tab=waystar'
  },
  {
    id: 'officeally_integration',
    name: 'Office Ally EDI',
    description: 'EDI clearinghouse — eligibility, claims submission, and remittance to 6,000+ payers via Office Ally',
    category: 'compliance',
    icon: Shield,
    defaultEnabled: false,
    impact: 'high',
    requiresConfig: true,
    configPath: '/admin-settings?tab=officeally'
  },
  {
    id: 'video_conferencing',
    name: 'Video Conferencing',
    description: 'Native WebRTC video meetings for patient telehealth consultations with screen sharing and AI clinical assistant',
    category: 'communication',
    icon: PhoneCall,
    defaultEnabled: false,
    impact: 'high'
  },
  {
    id: 'marketing_campaigns',
    name: 'Marketing Campaigns',
    description: 'Create custom landing pages for PPC, social, and email campaigns with lead tracking and conversion analytics',
    category: 'marketing',
    icon: Globe,
    defaultEnabled: false,
    impact: 'high',
    requiresConfig: true,
    configPath: '/admin-settings?tab=marketing-campaigns'
  },
  {
    id: 'lead_intake_hub',
    name: 'Lead Intake Hub',
    description: 'API keys and embeddable forms for collecting leads from external websites with TCPA/HIPAA consent',
    category: 'marketing',
    icon: Globe,
    defaultEnabled: false,
    impact: 'high',
    requiresConfig: true,
    configPath: '/admin-settings?tab=lead-intake'
  }
];

const CATEGORIES = {
  core: { label: 'Core Features', color: 'bg-blue-100 text-blue-800' },
  communication: { label: 'Communication', color: 'bg-green-100 text-green-800' },
  ecommerce: { label: 'E-Commerce', color: 'bg-purple-100 text-purple-800' },
  marketing: { label: 'Marketing', color: 'bg-amber-100 text-amber-800' },
  documents: { label: 'Documents', color: 'bg-pink-100 text-pink-800' },
  scheduling: { label: 'Scheduling', color: 'bg-cyan-100 text-cyan-800' },
  analytics: { label: 'Analytics', color: 'bg-indigo-100 text-indigo-800' },
  engagement: { label: 'Engagement', color: 'bg-orange-100 text-orange-800' },
  ai: { label: 'AI Features', color: 'bg-violet-100 text-violet-800' },
  compliance: { label: 'Compliance', color: 'bg-red-100 text-red-800' }
};

const IMPACT_BADGES = {
  high: { label: 'High Impact', color: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium Impact', color: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'Low Impact', color: 'bg-gray-100 text-gray-700' }
};

export default function FeaturesManager() {
  const navigate = useNavigate();
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/features`, { headers: getHeaders() });
      setFeatures(response.data.features || {});
    } catch (error) {
      // If no features saved yet, use defaults
      const defaults = {};
      FEATURE_DEFINITIONS.forEach(f => {
        defaults[f.id] = f.defaultEnabled;
      });
      setFeatures(defaults);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (featureId, enabled) => {
    setFeatures(prev => ({
      ...prev,
      [featureId]: enabled
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/features`, { features }, { headers: getHeaders() });
      toast.success('Feature settings saved successfully');
      setHasChanges(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save features');
    } finally {
      setSaving(false);
    }
  };

  const handleEnableAll = () => {
    const allEnabled = {};
    FEATURE_DEFINITIONS.forEach(f => {
      allEnabled[f.id] = true;
    });
    setFeatures(allEnabled);
    setHasChanges(true);
  };

  const handleDisableAll = () => {
    const allDisabled = {};
    FEATURE_DEFINITIONS.forEach(f => {
      allDisabled[f.id] = false;
    });
    setFeatures(allDisabled);
    setHasChanges(true);
  };

  const handleResetDefaults = () => {
    const defaults = {};
    FEATURE_DEFINITIONS.forEach(f => {
      defaults[f.id] = f.defaultEnabled;
    });
    setFeatures(defaults);
    setHasChanges(true);
  };

  // Filter features
  const filteredFeatures = FEATURE_DEFINITIONS.filter(feature => {
    if (filterCategory !== 'all' && feature.category !== filterCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return feature.name.toLowerCase().includes(term) || 
             feature.description.toLowerCase().includes(term);
    }
    return true;
  });

  // Group by category
  const featuresByCategory = filteredFeatures.reduce((acc, feature) => {
    if (!acc[feature.category]) acc[feature.category] = [];
    acc[feature.category].push(feature);
    return acc;
  }, {});

  // Stats
  const enabledCount = FEATURE_DEFINITIONS.filter(f => features[f.id] ?? f.defaultEnabled).length;
  const totalCount = FEATURE_DEFINITIONS.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="features-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ToggleLeft className="w-6 h-6" />
            Feature Flags
          </h2>
          <p className="text-muted-foreground">Enable or disable features across your application</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm py-1 px-3">
            {enabledCount} / {totalCount} enabled
          </Badge>
          {hasChanges && (
            <Badge className="bg-amber-100 text-amber-800">
              <AlertCircle className="w-3 h-3 mr-1" />
              Unsaved changes
            </Badge>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <option key={key} value={key}>{cat.label}</option>
                ))}
              </select>
              
              {/* Search */}
              <div className="relative">
                <Input
                  placeholder="Search features..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-3"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleEnableAll}>
                <Eye className="w-4 h-4 mr-1" />
                Enable All
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisableAll}>
                <EyeOff className="w-4 h-4 mr-1" />
                Disable All
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetDefaults}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Reset Defaults
              </Button>
              <Button onClick={handleSave} disabled={saving || !hasChanges} data-testid="save-features-btn">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features by Category */}
      {Object.entries(featuresByCategory).map(([category, categoryFeatures]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge className={CATEGORIES[category]?.color}>
                {CATEGORIES[category]?.label || category}
              </Badge>
              <span className="text-sm font-normal text-muted-foreground">
                ({categoryFeatures.filter(f => features[f.id] ?? f.defaultEnabled).length}/{categoryFeatures.length} enabled)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y">
              {categoryFeatures.map((feature) => {
                const Icon = feature.icon;
                const isEnabled = features[feature.id] ?? feature.defaultEnabled;
                
                return (
                  <div
                    key={feature.id}
                    className={`flex items-center justify-between py-4 transition-colors ${
                      isEnabled ? '' : 'opacity-60'
                    }`}
                    data-testid={`feature-${feature.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${isEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`w-5 h-5 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{feature.name}</h3>
                          <Badge variant="outline" className={`text-xs ${IMPACT_BADGES[feature.impact]?.color}`}>
                            {IMPACT_BADGES[feature.impact]?.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {feature.requiresConfig && isEnabled && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(feature.configPath)}
                          className="text-xs"
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Configure
                        </Button>
                      )}
                      {isEnabled ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggle(feature.id, checked)}
                        data-testid={`toggle-${feature.id}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* No results */}
      {filteredFeatures.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No features found</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm 
                ? `No features match "${searchTerm}"`
                : 'No features in this category'
              }
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => { setSearchTerm(''); setFilterCategory('all'); }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-blue-900">About Feature Flags</h4>
            <p className="text-sm text-blue-700 mt-1">
              Feature flags allow you to enable or disable functionality without deploying new code. 
              Changes take effect immediately after saving. High-impact features may require a page 
              refresh to fully apply.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
