import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { Database, Save, Loader2, RefreshCw } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AvailitySettings() {
  const [config, setConfig] = useState({
    client_id: '', client_secret: '', environment: 'test',
    provider_npi: '', provider_tax_id: '', organization_name: ''
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/availity/config`, { headers: getHeaders() });
      setConfig({
        client_id: res.data.client_id || '', client_secret: res.data.client_secret || '',
        environment: res.data.environment || 'test', provider_npi: res.data.provider_npi || '',
        provider_tax_id: res.data.provider_tax_id || '', organization_name: res.data.organization_name || ''
      });
      const statusRes = await axios.get(`${API_URL}/api/availity/status`, { headers: getHeaders() });
      setStatus(statusRes.data);
    } catch (error) { console.error('Failed to load Availity config'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/availity/config`, config, { headers: getHeaders() });
      toast.success('Availity settings saved');
      loadConfig();
    } catch (error) { toast.error('Failed to save Availity settings'); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await axios.get(`${API_URL}/api/availity/status`, { headers: getHeaders() });
      setStatus(res.data);
      toast[res.data.connected ? 'success' : 'error'](res.data.connected ? 'Connected to Availity!' : `Connection failed: ${res.data.message}`);
    } catch (error) { toast.error('Failed to test connection'); }
    finally { setTesting(false); }
  };

  return (
    <div className="space-y-6" data-testid="availity-settings">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Database className="w-5 h-5" />
          Availity Integration
        </h2>
        <p className="text-sm text-muted-foreground">Healthcare eligibility verification and benefits lookup</p>
      </div>

      {status && (
        <div className={`p-4 rounded-lg ${status.connected ? 'bg-green-50 border border-green-200' : status.configured ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : status.configured ? 'bg-yellow-500' : 'bg-gray-400'}`} />
            <span className="font-medium">{status.connected ? 'Connected to Availity' : status.configured ? 'Configured - Connection Failed' : 'Not Configured'}</span>
            <Badge variant="outline" className="ml-2">{status.environment === 'production' ? 'Production' : 'Test'}</Badge>
          </div>
          {!status.connected && status.message && <p className="text-sm text-muted-foreground mt-1">{status.message}</p>}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Credentials</CardTitle>
          <CardDescription>
            Register at <a href="https://developer.availity.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">developer.availity.com</a> to obtain your Client ID and Client Secret.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Environment</Label>
            <Select value={config.environment} onValueChange={(v) => setConfig({ ...config, environment: v })}>
              <SelectTrigger data-testid="availity-environment-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test (tst.api.availity.com)</SelectItem>
                <SelectItem value="production">Production (api.availity.com)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Client ID (API Key)</Label>
            <Input data-testid="availity-client-id-input" value={config.client_id} onChange={(e) => setConfig({ ...config, client_id: e.target.value })} placeholder="Enter your Availity Client ID" />
          </div>
          <div className="space-y-2">
            <Label>Client Secret</Label>
            <Input data-testid="availity-client-secret-input" type="password" value={config.client_secret} onChange={(e) => setConfig({ ...config, client_secret: e.target.value })} placeholder="Enter your Availity Client Secret" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <Input data-testid="availity-org-name-input" value={config.organization_name} onChange={(e) => setConfig({ ...config, organization_name: e.target.value })} placeholder="e.g., MediNova Medical Supplies" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider NPI</Label>
              <Input data-testid="availity-npi-input" value={config.provider_npi} onChange={(e) => setConfig({ ...config, provider_npi: e.target.value })} placeholder="10-digit NPI" maxLength={10} />
            </div>
            <div className="space-y-2">
              <Label>Provider Tax ID (EIN)</Label>
              <Input data-testid="availity-tax-id-input" value={config.provider_tax_id} onChange={(e) => setConfig({ ...config, provider_tax_id: e.target.value })} placeholder="e.g., 12-3456789" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleTest} disabled={testing || !config.client_id || !config.client_secret} data-testid="test-availity-connection-btn">
          {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : <><RefreshCw className="w-4 h-4 mr-2" /> Test Connection</>}
        </Button>
        <Button onClick={handleSave} disabled={saving} data-testid="save-availity-btn">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save Settings</>}
        </Button>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <h4 className="font-medium mb-2">Available Features</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li><strong>Eligibility Verification (270/271)</strong> — Check patient insurance coverage</li>
            <li><strong>Member ID Card</strong> — Retrieve member ID cards in PDF or PNG format</li>
            <li><strong>Payer List</strong> — Get list of supported insurance payers</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
