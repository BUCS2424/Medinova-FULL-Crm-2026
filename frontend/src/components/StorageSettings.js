import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  HardDrive,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Pencil,
  X,
  Eye,
  EyeOff,
  TestTube,
  Cloud,
  Key,
  Database,
  Folder
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function StorageSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ configured: false, connected: false });
  
  // Storage Settings (iDrive E2)
  const [storageSettings, setStorageSettings] = useState({
    endpoint: '',
    access_key: '',
    secret_key: '',
    bucket_name: '',
    folder_path: '',
    region: 'us-east-1'
  });

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('dme_token')}`
  });

  useEffect(() => {
    fetchStorageSettings();
  }, []);

  const fetchStorageSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        axios.get(`${API_URL}/api/dev/settings/storage`, { headers: getHeaders() }).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/api/storage/status`, { headers: getHeaders() }).catch(() => ({ data: { configured: false, connected: false } }))
      ]);

      if (settingsRes.data && Object.keys(settingsRes.data).length > 0) {
        setStorageSettings(prev => ({ ...prev, ...settingsRes.data }));
        const hasStorageData = !!(settingsRes.data.endpoint || settingsRes.data.bucket_name);
        setHasData(hasStorageData);
        // If no data, start in edit mode
        if (!hasStorageData) {
          setEditMode(true);
        }
      } else {
        setEditMode(true);
      }

      setConnectionStatus(statusRes.data);
    } catch (error) {
      console.error('Error fetching storage settings:', error);
      toast.error('Failed to load storage settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    // Validate required fields
    if (!storageSettings.endpoint || !storageSettings.access_key || !storageSettings.secret_key || !storageSettings.bucket_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/dev/settings/storage`, storageSettings, { headers: getHeaders() });
      toast.success('Storage settings saved and locked');
      setEditMode(false);
      setHasData(true);
      fetchStorageSettings(); // Refresh to get connection status
    } catch (error) {
      console.error('Error saving storage settings:', error);
      toast.error(error.response?.data?.detail || 'Failed to save storage settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await axios.post(`${API_URL}/api/dev/settings/storage/test`, {}, { headers: getHeaders() });
      if (res.data.success) {
        toast.success('Connection successful! Storage is working.');
        setConnectionStatus({ configured: true, connected: true });
      } else {
        toast.error(res.data.message || 'Connection test failed');
        setConnectionStatus(prev => ({ ...prev, connected: false }));
      }
    } catch (error) {
      console.error('Storage test failed:', error);
      toast.error(error.response?.data?.detail || 'Connection test failed');
      setConnectionStatus(prev => ({ ...prev, connected: false }));
    } finally {
      setTesting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    fetchStorageSettings(); // Reset to saved values
  };

  const maskValue = (value) => {
    if (!value) return '';
    if (value.length <= 8) return '••••••••';
    return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="w-6 h-6" />
            Storage Configuration
          </h2>
          <p className="text-muted-foreground">iDrive E2 S3-compatible cloud storage</p>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus.connected ? (
            <Badge className="bg-green-500 gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Connected
            </Badge>
          ) : connectionStatus.configured ? (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="w-3 h-3" />
              Not Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Cloud className="w-3 h-3" />
              Not Configured
            </Badge>
          )}
        </div>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-500" />
                iDrive E2 Credentials
              </CardTitle>
              <CardDescription>
                Configure your iDrive E2 storage for file uploads, faxes, and documents
              </CardDescription>
            </div>
            
            {/* Lock/Edit Toggle */}
            {hasData && (
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <>
                    <Badge variant="outline" className="gap-1">
                      <Lock className="w-3 h-3" />
                      Locked
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditMode(true)}
                      data-testid="edit-storage-btn"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge className="bg-amber-500 gap-1">
                      <Pencil className="w-3 h-3" />
                      Editing
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Locked View */}
          {!editMode && hasData ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Cloud className="w-3 h-3" />
                    Endpoint URL
                  </Label>
                  <div className="px-3 py-2 bg-muted/50 rounded-md border text-sm min-h-[38px] flex items-center font-mono">
                    {storageSettings.endpoint || <span className="text-muted-foreground italic">Not set</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    Bucket Name
                  </Label>
                  <div className="px-3 py-2 bg-muted/50 rounded-md border text-sm min-h-[38px] flex items-center font-mono">
                    {storageSettings.bucket_name || <span className="text-muted-foreground italic">Not set</span>}
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    Access Key
                  </Label>
                  <div className="px-3 py-2 bg-muted/50 rounded-md border text-sm min-h-[38px] flex items-center font-mono">
                    {showSecrets ? storageSettings.access_key : maskValue(storageSettings.access_key)}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    Secret Key
                  </Label>
                  <div className="px-3 py-2 bg-muted/50 rounded-md border text-sm min-h-[38px] flex items-center font-mono">
                    {showSecrets ? storageSettings.secret_key : maskValue(storageSettings.secret_key)}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Folder className="w-3 h-3" />
                    Folder Path (optional)
                  </Label>
                  <div className="px-3 py-2 bg-muted/50 rounded-md border text-sm min-h-[38px] flex items-center font-mono">
                    {storageSettings.folder_path || <span className="text-muted-foreground italic">Root folder</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Region</Label>
                  <div className="px-3 py-2 bg-muted/50 rounded-md border text-sm min-h-[38px] flex items-center font-mono">
                    {storageSettings.region || 'us-east-1'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSecrets(!showSecrets)}
                >
                  {showSecrets ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  {showSecrets ? 'Hide' : 'Show'} Keys
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <TestTube className="w-4 h-4 mr-1" />}
                  Test Connection
                </Button>
              </div>
            </div>
          ) : (
            /* Edit View */
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                <p className="text-blue-800 dark:text-blue-200">
                  <strong>iDrive E2 Only:</strong> Enter your iDrive E2 S3-compatible storage credentials. Get your keys from the iDrive E2 dashboard.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    Endpoint URL *
                  </Label>
                  <Input
                    value={storageSettings.endpoint}
                    onChange={(e) => setStorageSettings(prev => ({ ...prev, endpoint: e.target.value }))}
                    placeholder="https://xxxxxx.e2.us-east-1.idrivee2.com"
                    data-testid="storage-endpoint-input"
                  />
                  <p className="text-xs text-muted-foreground">Your iDrive E2 endpoint URL</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Bucket Name *
                  </Label>
                  <Input
                    value={storageSettings.bucket_name}
                    onChange={(e) => setStorageSettings(prev => ({ ...prev, bucket_name: e.target.value }))}
                    placeholder="my-bucket-name"
                    data-testid="storage-bucket-input"
                  />
                  <p className="text-xs text-muted-foreground">Your iDrive E2 bucket name</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Access Key *
                  </Label>
                  <Input
                    type={showSecrets ? 'text' : 'password'}
                    value={storageSettings.access_key}
                    onChange={(e) => setStorageSettings(prev => ({ ...prev, access_key: e.target.value }))}
                    placeholder="Your access key"
                    data-testid="storage-access-key-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Secret Key *
                  </Label>
                  <Input
                    type={showSecrets ? 'text' : 'password'}
                    value={storageSettings.secret_key}
                    onChange={(e) => setStorageSettings(prev => ({ ...prev, secret_key: e.target.value }))}
                    placeholder="Your secret key"
                    data-testid="storage-secret-key-input"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    Folder Path (optional)
                  </Label>
                  <Input
                    value={storageSettings.folder_path}
                    onChange={(e) => setStorageSettings(prev => ({ ...prev, folder_path: e.target.value }))}
                    placeholder="uploads/"
                    data-testid="storage-folder-input"
                  />
                  <p className="text-xs text-muted-foreground">Optional subfolder for all uploads</p>
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Input
                    value={storageSettings.region}
                    onChange={(e) => setStorageSettings(prev => ({ ...prev, region: e.target.value }))}
                    placeholder="us-east-1"
                    data-testid="storage-region-input"
                  />
                  <p className="text-xs text-muted-foreground">Usually us-east-1 for iDrive E2</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSecrets(!showSecrets)}
                >
                  {showSecrets ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  {showSecrets ? 'Hide' : 'Show'} Keys
                </Button>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="flex-1"
                  data-testid="save-storage-btn"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save & Lock
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing || !storageSettings.endpoint || !storageSettings.access_key}
                >
                  {testing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <TestTube className="w-4 h-4 mr-1" />}
                  Test
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>What is this used for?</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>File uploads (documents, images, faxes)</li>
                <li>Patient document storage</li>
                <li>Fax document archiving</li>
                <li>Logo and asset storage</li>
              </ul>
              <p className="pt-2">
                <strong>Note:</strong> Only iDrive E2 S3-compatible storage is supported. 
                Get your credentials from the <a href="https://www.idrive.com/e2/" target="_blank" rel="noopener noreferrer" className="text-primary underline">iDrive E2 Dashboard</a>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
