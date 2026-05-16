import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Phone,
  Send,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Clock,
  FileText,
  User,
  Eye,
  EyeOff,
  Zap,
  History,
  AlertCircle,
  ExternalLink,
  Lock,
  Pencil
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function FaxSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [apiKey, setApiKey] = useState('');
  const [faxNumber, setFaxNumber] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  
  // Send fax state
  const [sendingFax, setSendingFax] = useState(false);
  const [faxForm, setFaxForm] = useState({
    recipientName: '',
    recipientFaxNumber: '',
    documentType: 'other',
    fileUrl: '',
    notes: ''
  });
  
  // Fax history state
  const [faxHistory, setFaxHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    fetchSettings();
    fetchFaxHistory();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/fax/settings`, { headers: getHeaders() });
      setSettings(response.data);
      setIsEnabled(response.data.is_enabled);
      if (response.data.fax_number) {
        setFaxNumber(response.data.fax_number);
      }
      // If settings are configured, start in locked mode
      if (response.data.is_configured) {
        setIsEditing(false);
      } else {
        setIsEditing(true); // Allow editing if not configured yet
      }
    } catch (error) {
      toast.error('Failed to fetch fax settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchFaxHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${API_URL}/api/fax/history?limit=20`, { headers: getHeaders() });
      setFaxHistory(response.data.faxes || []);
    } catch (error) {
      console.error('Failed to fetch fax history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const payload = {};
      if (apiKey) payload.telnyx_api_key = apiKey;
      if (faxNumber) payload.telnyx_fax_number = faxNumber;
      if (connectionId) payload.telnyx_connection_id = connectionId;
      payload.is_enabled = isEnabled;
      
      await axios.post(`${API_URL}/api/fax/settings`, payload, { headers: getHeaders() });
      toast.success('Fax settings saved and locked');
      setApiKey(''); // Clear the API key field after saving
      setIsEditing(false); // Lock the form after save
      fetchSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setTestResult(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setApiKey('');
    // Reset to saved values
    if (settings?.fax_number) {
      setFaxNumber(settings.fax_number);
    }
    setIsEnabled(settings?.is_enabled || false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await axios.post(`${API_URL}/api/fax/test-connection`, {}, { headers: getHeaders() });
      setTestResult(response.data);
      if (response.data.success) {
        toast.success('Connection successful!');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      setTestResult({ success: false, message: error.response?.data?.detail || 'Connection test failed' });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSendFax = async (e) => {
    e.preventDefault();
    
    if (!faxForm.recipientFaxNumber || !faxForm.recipientName || !faxForm.fileUrl) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setSendingFax(true);
    try {
      const response = await axios.post(`${API_URL}/api/fax/send`, {
        recipient_fax_number: faxForm.recipientFaxNumber,
        recipient_name: faxForm.recipientName,
        document_type: faxForm.documentType,
        file_url: faxForm.fileUrl,
        notes: faxForm.notes
      }, { headers: getHeaders() });
      
      toast.success(`Fax queued! ID: ${response.data.fax_id}`);
      setFaxForm({
        recipientName: '',
        recipientFaxNumber: '',
        documentType: 'other',
        fileUrl: '',
        notes: ''
      });
      fetchFaxHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send fax');
    } finally {
      setSendingFax(false);
    }
  };

  const handleRefreshStatus = async (faxId) => {
    try {
      await axios.post(`${API_URL}/api/fax/refresh-status/${faxId}`, {}, { headers: getHeaders() });
      toast.success('Status refreshed');
      fetchFaxHistory();
    } catch (error) {
      toast.error('Failed to refresh status');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      queued: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      sending: { color: 'bg-blue-100 text-blue-800', icon: Send },
      delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle }
    };
    
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', icon: Clock };
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} capitalize flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const documentTypes = [
    { value: 'medical_record', label: 'Medical Record' },
    { value: 'insurance_form', label: 'Insurance Form' },
    { value: 'authorization', label: 'Prior Authorization' },
    { value: 'equipment_quote', label: 'Equipment Quote' },
    { value: 'order_confirmation', label: 'Order Confirmation' },
    { value: 'other', label: 'Other' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="fax-settings">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="w-6 h-6" />
            HIPAA-Compliant Fax
          </h2>
          <p className="text-muted-foreground">Send secure faxes via Telnyx T.38 protocol</p>
        </div>
        <div className="flex items-center gap-2">
          {settings?.is_configured ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Configured
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-800">
              <AlertCircle className="w-3 h-3 mr-1" />
              Not Configured
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={activeTab === 'settings' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('settings')}
          data-testid="fax-tab-settings"
        >
          <Settings className="w-4 h-4 mr-2" />
          Configuration
        </Button>
        <Button 
          variant={activeTab === 'send' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('send')}
          disabled={!settings?.is_enabled}
          data-testid="fax-tab-send"
        >
          <Send className="w-4 h-4 mr-2" />
          Send Fax
        </Button>
        <Button 
          variant={activeTab === 'history' ? 'default' : 'ghost'}
          onClick={() => { setActiveTab('history'); fetchFaxHistory(); }}
          data-testid="fax-tab-history"
        >
          <History className="w-4 h-4 mr-2" />
          History
        </Button>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Telnyx Configuration */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {isEditing ? <Settings className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  Telnyx Configuration
                </CardTitle>
                <CardDescription>
                  {isEditing 
                    ? 'Configure your Telnyx API credentials for fax services'
                    : 'Settings are locked. Click Edit to modify.'}
                </CardDescription>
              </div>
              {settings?.is_configured && !isEditing && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleEditClick}
                  data-testid="edit-fax-settings-btn"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Locked View */}
              {!isEditing && settings?.is_configured ? (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <Label className="text-muted-foreground text-xs">API Key</Label>
                        <p className="font-mono text-sm">••••••••••••••••</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Configured
                      </Badge>
                    </div>
                    
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <Label className="text-muted-foreground text-xs">Fax Phone Number</Label>
                      <p className="font-medium">{settings.fax_number || 'Not set'}</p>
                    </div>
                    
                    {settings.has_connection_id && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <Label className="text-muted-foreground text-xs">Connection ID</Label>
                        <p className="font-mono text-sm">••••••••</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <Label className="text-muted-foreground text-xs">Fax Service</Label>
                        <p className="font-medium">{settings.is_enabled ? 'Enabled' : 'Disabled'}</p>
                      </div>
                      <Badge className={settings.is_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {settings.is_enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={handleTestConnection} 
                      disabled={testing}
                      className="w-full"
                      data-testid="test-fax-connection-btn"
                    >
                      {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                      Test Connection
                    </Button>
                  </div>

                  {testResult && (
                    <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span className="font-medium">{testResult.message}</span>
                      </div>
                      {testResult.balance && (
                        <p className="text-sm mt-1">Account Balance: {testResult.balance} {testResult.currency}</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Edit Mode */
                <>
                  <div className="space-y-2">
                    <Label>Telnyx API Key</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder={settings?.has_api_key ? '••••••••••••••••' : 'Enter your Telnyx API key'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        data-testid="telnyx-api-key-input"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a 
                        href="https://portal.telnyx.com/#/app/api-keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center"
                      >
                        Telnyx Mission Control <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Fax Phone Number (From)</Label>
                    <Input
                      placeholder="+1 (555) 123-4567"
                      value={faxNumber}
                      onChange={(e) => setFaxNumber(e.target.value)}
                      data-testid="telnyx-fax-number-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your Telnyx provisioned fax number in E.164 format
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Connection ID (Optional)</Label>
                    <Input
                      placeholder="Enter connection ID if using Programmable Fax App"
                      value={connectionId}
                      onChange={(e) => setConnectionId(e.target.value)}
                      data-testid="telnyx-connection-id-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      From your Telnyx Programmable Fax Application
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="space-y-1">
                      <Label>Enable Fax Service</Label>
                      <p className="text-xs text-muted-foreground">Allow sending faxes from this system</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={setIsEnabled}
                      data-testid="fax-enabled-switch"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    {settings?.is_configured && (
                      <Button 
                        variant="outline" 
                        onClick={handleCancelEdit}
                        data-testid="cancel-edit-btn"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button 
                      onClick={handleSaveSettings} 
                      disabled={saving} 
                      className="flex-1" 
                      data-testid="save-fax-settings-btn"
                    >
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                      Save & Lock
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                About Telnyx Fax
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900">HIPAA Compliant</h4>
                  <p className="text-sm text-blue-700">
                    T.38 real-time fax protocol ensures PHI is never stored on intermediate servers during transmission.
                  </p>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900">Secure Transmission</h4>
                  <p className="text-sm text-green-700">
                    Encrypted signaling and media with error correction for reliable delivery of medical documents.
                  </p>
                </div>
                
                <div className="p-3 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-900">Webhook Updates</h4>
                  <p className="text-sm text-purple-700">
                    Real-time status updates notify you when faxes are delivered or if delivery fails.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Setup Steps:</h4>
                <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
                  <li>Create a Telnyx account at portal.telnyx.com</li>
                  <li>Purchase a fax-enabled phone number</li>
                  <li>Create a Programmable Fax Application</li>
                  <li>Generate an API key (API v2)</li>
                  <li>Enter credentials above and enable the service</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Send Fax Tab */}
      {activeTab === 'send' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send New Fax
            </CardTitle>
            <CardDescription>
              Send a HIPAA-compliant fax to a healthcare provider or insurance company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendFax} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Recipient Name *</Label>
                  <Input
                    placeholder="Dr. Smith's Office"
                    value={faxForm.recipientName}
                    onChange={(e) => setFaxForm(prev => ({ ...prev, recipientName: e.target.value }))}
                    required
                    data-testid="fax-recipient-name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Recipient Fax Number *</Label>
                  <Input
                    placeholder="+1 (555) 123-4567"
                    value={faxForm.recipientFaxNumber}
                    onChange={(e) => setFaxForm(prev => ({ ...prev, recipientFaxNumber: e.target.value }))}
                    required
                    data-testid="fax-recipient-number"
                  />
                  <p className="text-xs text-muted-foreground">E.164 format recommended (e.g., +15551234567)</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select
                  value={faxForm.documentType}
                  onValueChange={(value) => setFaxForm(prev => ({ ...prev, documentType: value }))}
                >
                  <SelectTrigger data-testid="fax-document-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Document URL (PDF) *</Label>
                <Input
                  type="url"
                  placeholder="https://example.com/document.pdf"
                  value={faxForm.fileUrl}
                  onChange={(e) => setFaxForm(prev => ({ ...prev, fileUrl: e.target.value }))}
                  required
                  data-testid="fax-file-url"
                />
                <p className="text-xs text-muted-foreground">
                  Must be a publicly accessible URL to a PDF file. Use cloud storage or upload first.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Additional context about this fax..."
                  value={faxForm.notes}
                  onChange={(e) => setFaxForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  data-testid="fax-notes"
                />
              </div>

              <Button type="submit" disabled={sendingFax} className="w-full" data-testid="send-fax-btn">
                {sendingFax ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Send Fax</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Fax History
              </span>
              <Button variant="outline" size="sm" onClick={fetchFaxHistory} disabled={loadingHistory}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingHistory ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : faxHistory.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No faxes sent yet</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Recipient</th>
                      <th className="text-left p-3 font-medium">Fax Number</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {faxHistory.map((fax) => (
                      <tr key={fax.id} className="hover:bg-muted/30">
                        <td className="p-3">
                          {getStatusBadge(fax.status)}
                        </td>
                        <td className="p-3 font-medium">{fax.recipient_name}</td>
                        <td className="p-3 font-mono text-xs">{fax.recipient_fax_number}</td>
                        <td className="p-3 capitalize">{fax.document_type?.replace('_', ' ')}</td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(fax.created_at).toLocaleDateString()}{' '}
                          {new Date(fax.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 text-right">
                          {fax.fax_id && fax.status !== 'delivered' && fax.status !== 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRefreshStatus(fax.fax_id)}
                              title="Refresh status"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
