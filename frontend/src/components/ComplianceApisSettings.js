import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { Shield, Save, Loader2, ExternalLink, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ComplianceApisSettings() {
  const [config, setConfig] = useState({
    jornaya_campaign_id: '',
    trustedform_api_key: '',
    jornaya_configured: false,
    trustedform_configured: false,
    updated_at: null,
    updated_by: null
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTfKey, setShowTfKey] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/compliance/config`, { headers: getHeaders() });
      setConfig(response.data);
    } catch (error) {
      console.error('Failed to load compliance config');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/compliance/config`, {
        jornaya_campaign_id: config.jornaya_campaign_id,
        trustedform_api_key: config.trustedform_api_key
      }, { headers: getHeaders() });
      toast.success('Compliance API settings saved');
      fetchConfig();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="compliance-apis-settings">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Compliance APIs
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure Jornaya LeadiD and TrustedForm for TCPA-compliant lead tracking
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-lg border ${config.jornaya_configured ? 'bg-green-50 border-green-200' : 'bg-muted border-border'}`}>
          <div className="flex items-center gap-2 mb-1">
            {config.jornaya_configured ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
            <span className="font-medium text-sm">Jornaya LeadiD</span>
          </div>
          <p className="text-xs text-muted-foreground">{config.jornaya_configured ? 'Configured — tracking active on all forms' : 'Not configured'}</p>
        </div>
        <div className={`p-4 rounded-lg border ${config.trustedform_configured ? 'bg-green-50 border-green-200' : 'bg-muted border-border'}`}>
          <div className="flex items-center gap-2 mb-1">
            {config.trustedform_configured ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
            <span className="font-medium text-sm">TrustedForm</span>
          </div>
          <p className="text-xs text-muted-foreground">{config.trustedform_configured ? 'Configured — certificates captured on all forms' : 'Not configured'}</p>
        </div>
      </div>

      {/* Jornaya Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jornaya LeadiD</CardTitle>
          <CardDescription>TCPA-compliant lead tracking. Captures a unique token on every form submission as proof of consent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Campaign ID</Label>
            <Input
              data-testid="jornaya-campaign-id-input"
              value={config.jornaya_campaign_id}
              onChange={(e) => setConfig(prev => ({ ...prev, jornaya_campaign_id: e.target.value }))}
              placeholder="Enter your Jornaya Campaign ID"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Get your Campaign ID from <a href="https://www.jornaya.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">jornaya.com</a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* TrustedForm Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">TrustedForm (ActiveProspect)</CardTitle>
          <CardDescription>Captures timestamped certificates with session replay and bot detection on every form submission.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>API Key (v4)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  data-testid="trustedform-api-key-input"
                  type={showTfKey ? 'text' : 'password'}
                  value={config.trustedform_api_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, trustedform_api_key: e.target.value }))}
                  placeholder="Enter your TrustedForm API v4 key"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowTfKey(!showTfKey)}
                >
                  {showTfKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Get your API key from <a href="https://activeprospect.com/trustedform" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">activeprospect.com/trustedform</a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} data-testid="save-compliance-config-btn">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Compliance Settings
      </Button>

      {config.updated_at && (
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(config.updated_at).toLocaleString()} by {config.updated_by}
        </p>
      )}

      {/* Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> Once configured and enabled in Feature Flags, the Jornaya and TrustedForm scripts are automatically injected into every public form — including the homepage, all 28,000+ location pages, eligibility modals, and product inquiry forms. Tokens are captured with every lead submission and stored for TCPA audit compliance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
