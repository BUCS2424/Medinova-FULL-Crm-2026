import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Settings,
  Image,
  HardDrive,
  Mail,
  Code,
  MessageSquare,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Monitor,
  Smartphone,
  Lock,
  Send,
  RefreshCw,
  Pencil,
  X,
  Upload,
  AlertTriangle,
  Globe
} from 'lucide-react';
import FileUpload from './FileUpload';
import { useBranding } from '../contexts/BrandingContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function GeneralSettingsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [testing, setTesting] = useState({});
  
  // Edit mode for each section (locked by default after data exists)
  const [editMode, setEditMode] = useState({
    site: false,
    email: false,
    code: false
  });

  // Has data flags (to determine if section should be locked)
  const [hasData, setHasData] = useState({
    site: false,
    storage: false,
    email: false,
    code: false
  });
  
  // Site Settings
  const [siteSettings, setSiteSettings] = useState({
    logo_url: '',
    logo_link_url: '/',
    dashboard_logo_url: '',
    dashboard_logo_link: '/dashboard',
    favicon_url: '',
    pwa_icon_url: '',
    site_domain: '',
    branding_version: null,
  });
  const { refreshBranding } = useBranding();

  // Email/SMTP Settings
  const [emailSettings, setEmailSettings] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
    use_tls: true
  });
  const [emailConnected, setEmailConnected] = useState(false);

  // Custom Code
  const [customCode, setCustomCode] = useState({
    head_code: '',
    body_start_code: '',
    body_end_code: ''
  });

  // System Messages
  const [systemMessages, setSystemMessages] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const appendVersion = (url, version) => {
    if (!url) return '';
    if (!version) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(version)}`;
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const fetchAllSettings = async () => {
    setLoading(true);
    try {
      const [siteRes, emailRes, codeRes, messagesRes] = await Promise.all([
        axios.get(`${API_URL}/api/dev/settings/site`, { headers: getHeaders() }).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/api/dev/settings/email`, { headers: getHeaders() }).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/api/dev/settings/custom-code`, { headers: getHeaders() }).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/api/dev/settings/system-messages`, { headers: getHeaders() }).catch(() => ({ data: [] })),
      ]);

      // Site settings
      if (siteRes.data && Object.keys(siteRes.data).length > 0) {
        setSiteSettings(prev => ({ ...prev, ...siteRes.data }));
        const hasSiteData = !!(siteRes.data.logo_url || siteRes.data.favicon_url);
        setHasData(prev => ({ ...prev, site: hasSiteData }));
      }

      // Email settings
      if (emailRes.data && Object.keys(emailRes.data).length > 0) {
        setEmailSettings(prev => ({ ...prev, ...emailRes.data }));
        setEmailConnected(emailRes.data.connected || false);
        const hasEmailData = !!(emailRes.data.smtp_host || emailRes.data.from_email);
        setHasData(prev => ({ ...prev, email: hasEmailData }));
      }

      // Custom code
      if (codeRes.data && Object.keys(codeRes.data).length > 0) {
        setCustomCode(prev => ({ ...prev, ...codeRes.data }));
        const hasCodeData = !!(codeRes.data.head_code || codeRes.data.body_start_code || codeRes.data.body_end_code);
        setHasData(prev => ({ ...prev, code: hasCodeData }));
      }

      if (Array.isArray(messagesRes.data)) {
        setSystemMessages(messagesRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSiteSettingsData = async (nextSettings, options = {}) => {
    const payload = {
      ...nextSettings,
      logo_url: nextSettings.logo_url || '',
      dashboard_logo_url: nextSettings.logo_url || '',
      favicon_url: nextSettings.favicon_url || '',
      pwa_icon_url: nextSettings.favicon_url || '',
      logo_link_url: nextSettings.logo_link_url || '/',
      dashboard_logo_link: '/dashboard',
    };

    const response = await axios.post(`${API_URL}/api/dev/settings/site`, payload, { headers: getHeaders() });
    const savedSettings = response.data?.settings || payload;

    setSiteSettings((prev) => ({ ...prev, ...savedSettings }));
    setHasData(prev => ({ ...prev, site: true }));
    setEditMode(prev => ({ ...prev, site: false }));

    refreshBranding(savedSettings);
    window.dispatchEvent(new CustomEvent('branding-updated', { detail: savedSettings }));

    if (!options.silent) {
      toast.success('Branding settings saved and synced');
    }
  };

  // Save Site Settings
  const handleSaveSiteSettings = async () => {
    setSaving(prev => ({ ...prev, site: true }));
    try {
      await saveSiteSettingsData(siteSettings);
    } catch (error) {
      toast.error('Failed to save site settings');
    } finally {
      setSaving(prev => ({ ...prev, site: false }));
    }
  };

  const handleSiteLogoUploadComplete = async (files) => {
    const uploadedFile = files?.[0];
    if (!uploadedFile?.url) return;

    const nextSettings = {
      ...siteSettings,
      logo_url: uploadedFile.url,
      dashboard_logo_url: uploadedFile.url,
      branding_version: String(Date.now()),
    };

    setSiteSettings(nextSettings);
    setSaving(prev => ({ ...prev, site: true }));
    try {
      await saveSiteSettingsData(nextSettings, { silent: true });
      toast.success('Logo replaced and synced instantly');
    } catch (error) {
      toast.error('Failed to save uploaded logo');
    } finally {
      setSaving(prev => ({ ...prev, site: false }));
    }
  };

  const handleSiteFaviconUploadComplete = async (files) => {
    const uploadedFile = files?.[0];
    if (!uploadedFile?.url) return;

    const nextSettings = {
      ...siteSettings,
      favicon_url: uploadedFile.url,
      pwa_icon_url: uploadedFile.url,
      branding_version: String(Date.now()),
    };

    setSiteSettings(nextSettings);
    setSaving(prev => ({ ...prev, site: true }));
    try {
      await saveSiteSettingsData(nextSettings, { silent: true });
      toast.success('Favicon replaced and synced instantly');
    } catch (error) {
      toast.error('Failed to save uploaded favicon');
    } finally {
      setSaving(prev => ({ ...prev, site: false }));
    }
  };

  // Save Email Settings
  const handleSaveEmailSettings = async () => {
    setSaving(prev => ({ ...prev, email: true }));
    try {
      await axios.post(`${API_URL}/api/dev/settings/email`, emailSettings, { headers: getHeaders() });
      toast.success('Email settings saved');
      setEditMode(prev => ({ ...prev, email: false }));
      setHasData(prev => ({ ...prev, email: true }));
    } catch (error) {
      toast.error('Failed to save email settings');
    } finally {
      setSaving(prev => ({ ...prev, email: false }));
    }
  };

  // Test Email
  const handleTestEmail = async () => {
    setTesting(prev => ({ ...prev, email: true }));
    try {
      const res = await axios.post(`${API_URL}/api/dev/settings/email/test`, {}, { headers: getHeaders() });
      if (res.data.success) {
        toast.success('Test email sent successfully!');
        setEmailConnected(true);
      } else {
        toast.error(res.data.message || 'Failed to send test email');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Test email failed');
    } finally {
      setTesting(prev => ({ ...prev, email: false }));
    }
  };

  // Save Custom Code
  const handleSaveCustomCode = async () => {
    setSaving(prev => ({ ...prev, code: true }));
    try {
      await axios.post(`${API_URL}/api/dev/settings/custom-code`, customCode, { headers: getHeaders() });
      toast.success('Custom code saved');
      setEditMode(prev => ({ ...prev, code: false }));
      setHasData(prev => ({ ...prev, code: true }));
    } catch (error) {
      toast.error('Failed to save custom code');
    } finally {
      setSaving(prev => ({ ...prev, code: false }));
    }
  };

  // Save System Message
  const handleSaveSystemMessage = async (message) => {
    setSaving(prev => ({ ...prev, [`message-${message.id}`]: true }));
    try {
      await axios.put(`${API_URL}/api/dev/settings/system-messages/${message.id}`, message, { headers: getHeaders() });
      toast.success('Message saved');
      setEditingMessage(null);
      fetchAllSettings();
    } catch (error) {
      toast.error('Failed to save message');
    } finally {
      setSaving(prev => ({ ...prev, [`message-${message.id}`]: false }));
    }
  };

  // Create new System Message
  const handleCreateSystemMessage = async () => {
    try {
      await axios.post(`${API_URL}/api/dev/settings/system-messages`, {
        key: 'new_message_' + Date.now(),
        title: 'New Message',
        content: '',
        type: 'info'
      }, { headers: getHeaders() });
      toast.success('Message created');
      fetchAllSettings();
    } catch (error) {
      toast.error('Failed to create message');
    }
  };

  // Delete System Message
  const handleDeleteSystemMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await axios.delete(`${API_URL}/api/dev/settings/system-messages/${messageId}`, { headers: getHeaders() });
      toast.success('Message deleted');
      fetchAllSettings();
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  // Cancel edit - reset to saved values
  const handleCancelEdit = (section) => {
    setEditMode(prev => ({ ...prev, [section]: false }));
    fetchAllSettings(); // Refresh to get saved values
  };

  // Locked display component
  const LockedField = ({ label, value, icon: Icon }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </Label>
      <div className="px-3 py-2 bg-muted/50 rounded-md border text-sm min-h-[38px] flex items-center">
        {value || <span className="text-muted-foreground italic">Not set</span>}
      </div>
    </div>
  );

  // Section header with lock/edit toggle
  const SectionHeader = ({ section, title, onSave, isSaving }) => {
    const isEditing = editMode[section];
    const hasExistingData = hasData[section];

    if (!hasExistingData) {
      // No data yet - show in edit mode
      return null;
    }

    return (
      <div className="flex items-center justify-between mb-4 pb-3 border-b">
        <div className="flex items-center gap-2">
          {!isEditing && (
            <Badge variant="outline" className="gap-1">
              <Lock className="w-3 h-3" />
              Locked
            </Badge>
          )}
          {isEditing && (
            <Badge className="bg-amber-500 gap-1">
              <Pencil className="w-3 h-3" />
              Editing
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setEditMode(prev => ({ ...prev, [section]: true }))}
              data-testid={`edit-${section}-btn`}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
          ) : (
            <>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleCancelEdit(section)}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button 
                size="sm"
                onClick={onSave}
                disabled={isSaving}
                data-testid={`save-${section}-btn`}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save & Lock
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="general-settings-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            General Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure site-wide settings, storage, email, and more
          </p>
        </div>
        <Button onClick={fetchAllSettings} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Accordion Sections */}
      <Accordion type="multiple" className="space-y-4" defaultValue={['site-settings']}>
        
        {/* Site Settings */}
        <AccordionItem value="site-settings" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4" data-testid="site-settings-trigger">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Image className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Site Settings</h3>
                  {hasData.site && !editMode.site && <Lock className="w-4 h-4 text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground font-normal">Logo, favicon, and PWA icon configuration</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <SectionHeader 
              section="site" 
              title="Site Settings"
              onSave={handleSaveSiteSettings}
              isSaving={saving.site}
            />
            
            {/* Locked View */}
            {hasData.site && !editMode.site ? (
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <LockedField label="Primary Logo URL" value={siteSettings.logo_url} icon={Image} />
                    <LockedField label="Favicon URL" value={siteSettings.favicon_url} icon={Smartphone} />
                    <LockedField label="Production Domain" value={siteSettings.site_domain} icon={Globe} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/30 min-h-[96px]" data-testid="site-logo-preview-locked">
                      {siteSettings.logo_url ? (
                        <img src={appendVersion(siteSettings.logo_url, siteSettings.branding_version)} alt="Logo" className="max-h-20 max-w-full object-contain" />
                      ) : (
                        <p className="text-sm text-muted-foreground">No logo configured</p>
                      )}
                    </div>
                    <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/30 h-16" data-testid="site-favicon-preview-locked">
                      {siteSettings.favicon_url ? (
                        <img src={appendVersion(siteSettings.favicon_url, siteSettings.branding_version)} alt="Favicon" className="w-8 h-8 object-contain" />
                      ) : (
                        <p className="text-xs text-muted-foreground">No favicon</p>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground border-t pt-3" data-testid="site-logo-sync-note-locked">
                  One primary logo + one favicon are synchronized across login pages, dashboard top/bottom, public pages, and favicon targets.
                </p>
              </div>
            ) : (
              /* Edit View */
              <div className="space-y-6 pt-2">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Upload className="w-4 h-4" />Primary Logo Upload</Label>
                      <div data-testid="site-logo-upload-dropzone">
                        <FileUpload
                          maxFiles={1}
                          accept="image/*"
                          folder="branding/logo"
                          autoUpload={true}
                          hideFileList={true}
                          onUploadComplete={handleSiteLogoUploadComplete}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><LinkIcon className="w-4 h-4" />Primary Logo URL</Label>
                      <Input value={siteSettings.logo_url} onChange={(e) => setSiteSettings(prev => ({ ...prev, logo_url: e.target.value, dashboard_logo_url: e.target.value }))} placeholder="https://example.com/logo.png" data-testid="logo-url-input" />
                      <p className="text-xs text-muted-foreground">Used everywhere logo appears (public + dashboard + login)</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Logo Link URL</Label>
                      <Input value={siteSettings.logo_link_url} onChange={(e) => setSiteSettings(prev => ({ ...prev, logo_link_url: e.target.value }))} placeholder="/" data-testid="logo-link-input" />
                    </div>
                  </div>

                  <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/30 min-h-[120px]" data-testid="site-logo-preview-edit">
                    {siteSettings.logo_url ? (
                      <img src={appendVersion(siteSettings.logo_url, siteSettings.branding_version)} alt="Logo preview" className="max-h-24 max-w-full object-contain" />
                    ) : (
                      <p className="text-sm text-muted-foreground">Logo preview</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Upload className="w-4 h-4" />Favicon Upload</Label>
                      <div data-testid="site-favicon-upload-dropzone">
                        <FileUpload
                          maxFiles={1}
                          accept="image/*"
                          folder="branding/favicon"
                          autoUpload={true}
                          hideFileList={true}
                          onUploadComplete={handleSiteFaviconUploadComplete}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">Favicon URL <Badge variant="outline" className="text-xs">32x32 recommended</Badge></Label>
                      <Input value={siteSettings.favicon_url} onChange={(e) => setSiteSettings(prev => ({ ...prev, favicon_url: e.target.value, pwa_icon_url: e.target.value }))} placeholder="https://example.com/favicon.ico" data-testid="favicon-url-input" />
                      <p className="text-xs text-muted-foreground">Used for favicon + app icon to avoid ghosted legacy icons</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/30 h-28" data-testid="site-favicon-preview-edit">
                    {siteSettings.favicon_url ? (
                      <img src={appendVersion(siteSettings.favicon_url, siteSettings.branding_version)} alt="Favicon preview" className="w-12 h-12 object-contain" />
                    ) : (
                      <p className="text-sm text-muted-foreground">Favicon preview</p>
                    )}
                  </div>
                </div>

                {/* Production Domain */}
                <div className="space-y-2 pt-4 border-t">
                  <Label className="flex items-center gap-2"><Globe className="w-4 h-4" />Production Domain <Badge variant="outline" className="text-xs">SEO Critical</Badge></Label>
                  <Input value={siteSettings.site_domain} onChange={(e) => setSiteSettings(prev => ({ ...prev, site_domain: e.target.value }))} placeholder="https://dmepros.com" data-testid="site-domain-input" />
                  <p className="text-xs text-muted-foreground">Used for generated location page links. Include https://</p>
                </div>

                <Button onClick={handleSaveSiteSettings} disabled={saving.site} data-testid="save-site-settings-btn">
                  {saving.site ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save & Sync Everywhere
                </Button>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>


        {/* Email / SMTP */}
        <AccordionItem value="email-settings" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4" data-testid="email-settings-trigger">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Email / SMTP</h3>
                  {emailConnected && <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>}
                  {hasData.email && !editMode.email && <Lock className="w-4 h-4 text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground font-normal">Custom SMTP configuration for site emails</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <SectionHeader 
              section="email" 
              title="Email Settings"
              onSave={handleSaveEmailSettings}
              isSaving={saving.email}
            />

            {/* Locked View */}
            {hasData.email && !editMode.email ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <LockedField label="SMTP Host" value={emailSettings.smtp_host} />
                  <LockedField label="SMTP Port" value={emailSettings.smtp_port} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <LockedField label="SMTP Username" value={emailSettings.smtp_username} />
                  <LockedField label="SMTP Password" value={emailSettings.smtp_password ? '••••••••' : ''} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <LockedField label="From Email" value={emailSettings.from_email} />
                  <LockedField label="From Name" value={emailSettings.from_name} />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={emailSettings.use_tls ? 'default' : 'secondary'}>
                    {emailSettings.use_tls ? 'TLS Enabled' : 'TLS Disabled'}
                  </Badge>
                </div>
                <Button onClick={handleTestEmail} disabled={testing.email} variant="outline" data-testid="test-email-btn">
                  {testing.email ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Test Email
                </Button>
              </div>
            ) : (
              /* Edit View */
              <div className="space-y-4 pt-2">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SMTP Host</Label>
                    <Input value={emailSettings.smtp_host} onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" data-testid="smtp-host-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Port</Label>
                    <Input value={emailSettings.smtp_port} onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_port: e.target.value }))} placeholder="587" data-testid="smtp-port-input" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SMTP Username</Label>
                    <Input value={emailSettings.smtp_username} onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_username: e.target.value }))} placeholder="your-email@gmail.com" data-testid="smtp-username-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Password</Label>
                    <Input type="password" value={emailSettings.smtp_password} onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_password: e.target.value }))} placeholder="App password" data-testid="smtp-password-input" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Email</Label>
                    <Input value={emailSettings.from_email} onChange={(e) => setEmailSettings(prev => ({ ...prev, from_email: e.target.value }))} placeholder="noreply@yoursite.com" data-testid="from-email-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>From Name</Label>
                    <Input value={emailSettings.from_name} onChange={(e) => setEmailSettings(prev => ({ ...prev, from_name: e.target.value }))} placeholder="DME PROS" data-testid="from-name-input" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="use-tls" checked={emailSettings.use_tls} onChange={(e) => setEmailSettings(prev => ({ ...prev, use_tls: e.target.checked }))} className="w-4 h-4" />
                  <Label htmlFor="use-tls" className="cursor-pointer">Use TLS encryption</Label>
                </div>

                {!hasData.email && (
                  <Button onClick={handleSaveEmailSettings} disabled={saving.email} data-testid="save-email-btn">
                    {saving.email ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save & Lock
                  </Button>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Custom Code */}
        <AccordionItem value="custom-code" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4" data-testid="custom-code-trigger">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                <Code className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Custom Code</h3>
                  {hasData.code && !editMode.code && <Lock className="w-4 h-4 text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground font-normal">Add code to &lt;head&gt;, body start, or body end</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <SectionHeader 
              section="code" 
              title="Custom Code"
              onSave={handleSaveCustomCode}
              isSaving={saving.code}
            />

            {/* Locked View */}
            {hasData.code && !editMode.code ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">&lt;head&gt; Code</Label>
                  <div className="px-3 py-2 bg-muted/50 rounded-md border font-mono text-sm min-h-[60px] whitespace-pre-wrap overflow-auto max-h-32">
                    {customCode.head_code || <span className="text-muted-foreground italic">Not set</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Body Start Code</Label>
                  <div className="px-3 py-2 bg-muted/50 rounded-md border font-mono text-sm min-h-[60px] whitespace-pre-wrap overflow-auto max-h-32">
                    {customCode.body_start_code || <span className="text-muted-foreground italic">Not set</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Body End Code</Label>
                  <div className="px-3 py-2 bg-muted/50 rounded-md border font-mono text-sm min-h-[60px] whitespace-pre-wrap overflow-auto max-h-32">
                    {customCode.body_end_code || <span className="text-muted-foreground italic">Not set</span>}
                  </div>
                </div>
              </div>
            ) : (
              /* Edit View */
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Code className="w-4 h-4" />&lt;head&gt; Code</Label>
                  <Textarea value={customCode.head_code} onChange={(e) => setCustomCode(prev => ({ ...prev, head_code: e.target.value }))} placeholder="<!-- Google Analytics, meta tags, etc. -->" className="font-mono text-sm min-h-[120px]" data-testid="head-code-input" />
                  <p className="text-xs text-muted-foreground">Injected into the &lt;head&gt; section</p>
                </div>

                <div className="space-y-2">
                  <Label>Body Start Code</Label>
                  <Textarea value={customCode.body_start_code} onChange={(e) => setCustomCode(prev => ({ ...prev, body_start_code: e.target.value }))} placeholder="<!-- Code after <body> -->" className="font-mono text-sm min-h-[100px]" data-testid="body-start-code-input" />
                  <p className="text-xs text-muted-foreground">Injected right after the opening &lt;body&gt; tag</p>
                </div>

                <div className="space-y-2">
                  <Label>Body End Code</Label>
                  <Textarea value={customCode.body_end_code} onChange={(e) => setCustomCode(prev => ({ ...prev, body_end_code: e.target.value }))} placeholder="<!-- Code before </body> -->" className="font-mono text-sm min-h-[100px]" data-testid="body-end-code-input" />
                  <p className="text-xs text-muted-foreground">Injected before the closing &lt;/body&gt; tag</p>
                </div>

                {!hasData.code && (
                  <Button onClick={handleSaveCustomCode} disabled={saving.code} data-testid="save-code-btn">
                    {saving.code ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save & Lock
                  </Button>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* System Messages */}
        <AccordionItem value="system-messages" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4" data-testid="system-messages-trigger">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900">
                <MessageSquare className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">System Messages</h3>
                <p className="text-sm text-muted-foreground font-normal">Edit all site messages with rich text editor</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Customize system messages displayed throughout the site</p>
                <Button onClick={handleCreateSystemMessage} size="sm" variant="outline">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add New Message
                </Button>
              </div>

              {systemMessages.length === 0 ? (
                <div className="p-8 text-center border rounded-lg bg-muted/30">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No system messages configured yet</p>
                  <Button onClick={handleCreateSystemMessage} className="mt-4">Create First Message</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {systemMessages.map((message) => (
                    <Card key={message.id} className="p-4">
                      {editingMessage?.id === message.id ? (
                        <div className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Message Key</Label>
                              <Input value={editingMessage.key} onChange={(e) => setEditingMessage(prev => ({ ...prev, key: e.target.value }))} placeholder="welcome_message" />
                            </div>
                            <div className="space-y-2">
                              <Label>Title</Label>
                              <Input value={editingMessage.title} onChange={(e) => setEditingMessage(prev => ({ ...prev, title: e.target.value }))} placeholder="Welcome Message" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <select value={editingMessage.type} onChange={(e) => setEditingMessage(prev => ({ ...prev, type: e.target.value }))} className="w-full px-3 py-2 border rounded-lg bg-background">
                              <option value="paragraph">Paragraph</option>
                              <option value="header1">Header 1</option>
                              <option value="header2">Header 2</option>
                              <option value="info">Info</option>
                              <option value="warning">Warning</option>
                              <option value="success">Success</option>
                              <option value="error">Error</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Content</Label>
                            <div className="border rounded-lg overflow-hidden">
                              <div className="flex gap-1 p-2 border-b bg-muted/30 flex-wrap">
                                <Button type="button" variant="ghost" size="sm" onClick={() => { const ta = document.getElementById('msg-content'); if (ta) { const start = ta.selectionStart; const end = ta.selectionEnd; const text = editingMessage.content; const selected = text.substring(start, end); if (selected) { setEditingMessage(prev => ({ ...prev, content: text.substring(0, start) + `<strong>${selected}</strong>` + text.substring(end) })); } } }}><strong>B</strong></Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => { const ta = document.getElementById('msg-content'); if (ta) { const start = ta.selectionStart; const end = ta.selectionEnd; const text = editingMessage.content; const selected = text.substring(start, end); if (selected) { setEditingMessage(prev => ({ ...prev, content: text.substring(0, start) + `<em>${selected}</em>` + text.substring(end) })); } } }}><em>I</em></Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => { const ta = document.getElementById('msg-content'); if (ta) { const start = ta.selectionStart; const end = ta.selectionEnd; const text = editingMessage.content; const selected = text.substring(start, end); if (selected) { setEditingMessage(prev => ({ ...prev, content: text.substring(0, start) + `<mark>${selected}</mark>` + text.substring(end) })); } } }}>Highlight</Button>
                                <select className="px-2 py-1 border rounded text-sm bg-background" onChange={(e) => { const ta = document.getElementById('msg-content'); if (ta && e.target.value) { const start = ta.selectionStart; const end = ta.selectionEnd; const text = editingMessage.content; const selected = text.substring(start, end); if (selected) { setEditingMessage(prev => ({ ...prev, content: text.substring(0, start) + `<span style="color:${e.target.value}">${selected}</span>` + text.substring(end) })); } } e.target.value = ''; }} defaultValue="">
                                  <option value="">Text Color</option>
                                  <option value="#ef4444">Red</option>
                                  <option value="#3b82f6">Blue</option>
                                  <option value="#22c55e">Green</option>
                                  <option value="#f59e0b">Orange</option>
                                  <option value="#8b5cf6">Purple</option>
                                </select>
                                <select className="px-2 py-1 border rounded text-sm bg-background" onChange={(e) => { const ta = document.getElementById('msg-content'); if (ta && e.target.value) { const start = ta.selectionStart; const end = ta.selectionEnd; const text = editingMessage.content; const selected = text.substring(start, end); if (selected) { setEditingMessage(prev => ({ ...prev, content: text.substring(0, start) + `<span style="font-size:${e.target.value}">${selected}</span>` + text.substring(end) })); } } e.target.value = ''; }} defaultValue="">
                                  <option value="">Font Size</option>
                                  <option value="0.75rem">Small</option>
                                  <option value="1rem">Normal</option>
                                  <option value="1.25rem">Large</option>
                                  <option value="1.5rem">X-Large</option>
                                </select>
                              </div>
                              <Textarea id="msg-content" value={editingMessage.content} onChange={(e) => setEditingMessage(prev => ({ ...prev, content: e.target.value }))} placeholder="Message content... (HTML supported)" className="min-h-[150px] border-0 rounded-none focus-visible:ring-0" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleSaveSystemMessage(editingMessage)} disabled={saving[`message-${message.id}`]}>
                              {saving[`message-${message.id}`] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                              Save & Lock
                            </Button>
                            <Button variant="outline" onClick={() => setEditingMessage(null)}>
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{message.key}</Badge>
                              <Badge>{message.type}</Badge>
                              <Lock className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <h4 className="font-medium">{message.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: message.content }} />
                          </div>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => setEditingMessage(message)}>
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteSystemMessage(message.id)}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}
