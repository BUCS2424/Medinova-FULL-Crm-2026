import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { Activity, Save, Loader2, RefreshCw, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function WaystarSettings() {
  const [config, setConfig] = useState({
    client_id: '', client_secret: '', organization_id: '', environment: 'sandbox',
    configured: false, updated_at: null, updated_by: null
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const [showSecret, setShowSecret] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const [configRes, statusRes] = await Promise.all([
        axios.get(`${API_URL}/api/waystar/config`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/waystar/status`, { headers: getHeaders() }).catch(() => ({ data: null }))
      ]);
      setConfig(configRes.data);
      if (statusRes.data) setStatus(statusRes.data);
    } catch (error) { console.error('Failed to load Waystar config'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/waystar/config`, {
        client_id: config.client_id,
        client_secret: config.client_secret,
        organization_id: config.organization_id,
        environment: config.environment
      }, { headers: getHeaders() });
      toast.success('Waystar settings saved');
      fetchConfig();
    } catch (error) { toast.error('Failed to save Waystar settings'); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await axios.get(`${API_URL}/api/waystar/status`, { headers: getHeaders() });
      setStatus(res.data);
      toast[res.data.connected ? 'success' : 'error'](res.data.connected ? 'Connected to Waystar!' : `Connection failed: ${res.data.message}`);
    } catch (error) { toast.error('Failed to test connection'); }
    finally { setTesting(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="waystar-settings">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Waystar Integration
        </h2>
        <p className="text-sm text-muted-foreground">Healthcare revenue cycle management — eligibility, claims, prior auth, and payments</p>
      </div>

      {/* Status */}
      {status && (
        <div className={`p-4 rounded-lg ${status.connected ? 'bg-green-50 border border-green-200' : status.configured ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : status.configured ? 'bg-yellow-500' : 'bg-gray-400'}`} />
            <span className="font-medium">{status.connected ? 'Connected to Waystar' : status.configured ? 'Configured — Connection Failed' : 'Not Configured'}</span>
            <Badge variant="outline" className="ml-2">{config.environment === 'production' ? 'Production' : 'Sandbox'}</Badge>
          </div>
          {!status.connected && status.message && status.message !== 'Not configured' && (
            <p className="text-sm text-muted-foreground mt-1">{status.message}</p>
          )}
        </div>
      )}

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Credentials</CardTitle>
          <CardDescription>
            Get your credentials from the <a href="https://www.waystar.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Waystar Partner Portal</a>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Environment</Label>
            <Select value={config.environment} onValueChange={(v) => setConfig({ ...config, environment: v })}>
              <SelectTrigger data-testid="waystar-env-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Client ID</Label>
            <Input data-testid="waystar-client-id" value={config.client_id} onChange={(e) => setConfig({ ...config, client_id: e.target.value })} placeholder="Enter Waystar Client ID" />
          </div>
          <div className="space-y-2">
            <Label>Client Secret</Label>
            <div className="relative">
              <Input data-testid="waystar-client-secret" type={showSecret ? 'text' : 'password'} value={config.client_secret} onChange={(e) => setConfig({ ...config, client_secret: e.target.value })} placeholder="Enter Waystar Client Secret" className="pr-10" />
              <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Organization ID / NPI</Label>
            <Input data-testid="waystar-org-id" value={config.organization_id} onChange={(e) => setConfig({ ...config, organization_id: e.target.value })} placeholder="Your organization ID or NPI" />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleTest} disabled={testing || !config.client_id || !config.client_secret} data-testid="test-waystar-btn">
          {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : <><RefreshCw className="w-4 h-4 mr-2" /> Test Connection</>}
        </Button>
        <Button onClick={handleSave} disabled={saving} data-testid="save-waystar-btn">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save Settings</>}
        </Button>
      </div>

      {config.updated_at && (
        <p className="text-xs text-muted-foreground">Last updated: {new Date(config.updated_at).toLocaleString()} by {config.updated_by}</p>
      )}

      {/* Features */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <h4 className="font-medium mb-2">Available Features</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li><strong>Eligibility Verification (270/271)</strong> — Real-time patient insurance eligibility checks</li>
            <li><strong>Claims Status (276/277)</strong> — Track claim adjudication and payment status</li>
            <li><strong>Prior Authorization (278)</strong> — Submit and monitor prior auth requests</li>
            <li><strong>Patient Payments</strong> — Process credit card and ACH payments</li>
            <li><strong>Remittance (835)</strong> — Auto-post payments to accounting</li>
            <li><strong>Denial Management</strong> — Auto-route denials with appeal data</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
