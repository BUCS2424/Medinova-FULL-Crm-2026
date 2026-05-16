import { useState, useEffect, useCallback } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  ArrowLeft,
  Loader2,
  FileInput,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Globe,
  Activity,
  TrendingUp,
  Clock,
  Eye,
  Code
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LEAD_TYPES = [
  // Healthcare
  'medicare',
  'health_insurance',
  'medicaid',
  'dental',
  'vision',
  // Insurance
  'auto_insurance',
  'life_insurance',
  'home_insurance',
  'commercial_insurance',
  // Home Services
  'solar',
  'roofing',
  'hvac',
  'windows',
  'home_security',
  // Other
  'legal',
  'education',
  'finance',
  'debt_relief',
  'tax_services',
  'general'
];

export default function LeadIntakeHub() {
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Stats
  const [stats, setStats] = useState({
    total_leads: 0,
    today_leads: 0,
    week_leads: 0,
    month_leads: 0,
    total_duplicates: 0,
    assigned_leads: 0,
    unassigned_leads: 0,
    active_api_keys: 0
  });
  
  // API Keys
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKey, setNewKey] = useState({
    name: '',
    source_name: '',
    allowed_lead_types: [],
    rate_limit: 1000
  });
  const [createdKey, setCreatedKey] = useState(null);
  const [creating, setCreating] = useState(false);
  
  // Leads
  const [leads, setLeads] = useState([]);
  const [leadFilters, setLeadFilters] = useState({
    status: 'all',
    lead_type: 'all',
    state: '',
    is_duplicate: 'all'
  });
  const [loadingLeads, setLoadingLeads] = useState(false);
  
  // Duplicates
  const [duplicates, setDuplicates] = useState([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);

  // Domains
  const [domains, setDomains] = useState([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const ANALYTICS_BASE_URL = 'https://a2ganalytics.com';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('dme_token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch stats
      const statsRes = await axios.get(`${API_URL}/api/lead-intake/stats`, { headers });
      setStats(statsRes.data);

      // Fetch API keys
      const keysRes = await axios.get(`${API_URL}/api/lead-intake/api-keys`, { headers });
      setApiKeys(keysRes.data.api_keys || []);

    } catch (error) {
      console.error('Error fetching lead intake data:', error);
      toast.error('Failed to load lead intake data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLeads = async () => {
    try {
      setLoadingLeads(true);
      const token = localStorage.getItem('dme_token');
      const params = { limit: 100 };
      
      if (leadFilters.status !== 'all') params.status = leadFilters.status;
      if (leadFilters.lead_type !== 'all') params.lead_type = leadFilters.lead_type;
      if (leadFilters.state) params.state = leadFilters.state;
      if (leadFilters.is_duplicate !== 'all') params.is_duplicate = leadFilters.is_duplicate === 'true';

      const res = await axios.get(`${API_URL}/api/lead-intake/leads`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setLeads(res.data.leads || []);
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchDuplicates = async () => {
    try {
      setLoadingDuplicates(true);
      const token = localStorage.getItem('dme_token');
      const res = await axios.get(`${API_URL}/api/lead-intake/duplicates`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 100 }
      });
      setDuplicates(res.data.duplicates || []);
    } catch (error) {
      toast.error('Failed to load duplicates');
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const fetchDomains = async () => {
    try {
      setLoadingDomains(true);
      const token = localStorage.getItem('dme_token');
      const res = await axios.get(`${API_URL}/api/lead-intake/domains`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDomains(res.data.domains || []);
    } catch (error) {
      toast.error('Failed to load domains');
    } finally {
      setLoadingDomains(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'leads') {
      fetchLeads();
    } else if (activeTab === 'duplicates') {
      fetchDuplicates();
    } else if (activeTab === 'domains') {
      fetchDomains();
    }
  }, [activeTab]);

  const handleCreateKey = async () => {
    if (!newKey.name || !newKey.source_name) {
      toast.error('Name and Source Name are required');
      return;
    }

    try {
      setCreating(true);
      const token = localStorage.getItem('dme_token');
      const res = await axios.post(
        `${API_URL}/api/lead-intake/api-keys`,
        newKey,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setCreatedKey(res.data);
      toast.success('API key created successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleKey = async (keyId, isActive) => {
    try {
      const token = localStorage.getItem('dme_token');
      await axios.put(
        `${API_URL}/api/lead-intake/api-keys/${keyId}/toggle`,
        { is_active: isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, is_active: isActive } : k));
      toast.success(`API key ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to toggle API key');
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to delete this API key?')) return;

    try {
      const token = localStorage.getItem('dme_token');
      await axios.delete(
        `${API_URL}/api/lead-intake/api-keys/${keyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success('API key deleted');
    } catch (error) {
      toast.error('Failed to delete API key');
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      toast.error('Please enter a domain name');
      return;
    }

    try {
      setAddingDomain(true);
      const token = localStorage.getItem('dme_token');
      
      // Clean the domain (remove http/https if present)
      const cleanDomain = newDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      await axios.post(
        `${API_URL}/api/lead-intake/domains`,
        { domain: cleanDomain },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Domain added successfully');
      setNewDomain('');
      setShowAddDomain(false);
      fetchDomains();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add domain');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleDeleteDomain = async (domainId) => {
    if (!window.confirm('Are you sure you want to delete this domain?')) return;

    try {
      const token = localStorage.getItem('dme_token');
      await axios.delete(
        `${API_URL}/api/lead-intake/domains/${domainId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setDomains(prev => prev.filter(d => d.id !== domainId));
      toast.success('Domain deleted');
    } catch (error) {
      toast.error('Failed to delete domain');
    }
  };

  const getAnalyticsUrl = (domain) => {
    return `${ANALYTICS_BASE_URL}/${domain}`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-lime-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="admin-lead-intake-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileInput className="w-6 h-6 text-lime-600" />
              Lead Intake Hub
            </h1>
            <p className="text-muted-foreground">Manage external form submissions and API keys</p>
          </div>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_leads}</p>
                <p className="text-sm text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.today_leads}</p>
                <p className="text-sm text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_duplicates}</p>
                <p className="text-sm text-muted-foreground">Duplicates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Key className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active_api_keys}</p>
                <p className="text-sm text-muted-foreground">Active Keys</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="integration">Integration Guide</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Lead Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>This Week</span>
                  <Badge variant="outline">{stats.week_leads} leads</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>This Month</span>
                  <Badge variant="outline">{stats.month_leads} leads</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Assigned</span>
                  <Badge className="bg-green-100 text-green-800">{stats.assigned_leads}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Unassigned</span>
                  <Badge variant="secondary">{stats.unassigned_leads}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('api-keys')}>
                  <Key className="w-4 h-4 mr-2" />
                  Manage API Keys
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('leads')}>
                  <Users className="w-4 h-4 mr-2" />
                  View All Leads
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('duplicates')}>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  View Duplicates
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('integration')}>
                  <Code className="w-4 h-4 mr-2" />
                  Integration Guide
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Domains Tab */}
        <TabsContent value="domains" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Lead Source Domains
                  </CardTitle>
                  <CardDescription>Manage domains that send leads to the platform</CardDescription>
                </div>
                <Dialog open={showAddDomain} onOpenChange={setShowAddDomain}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setNewDomain('')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Domain
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Domain</DialogTitle>
                      <DialogDescription>
                        Add a domain that will send leads to this platform
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Domain Name</Label>
                        <Input
                          placeholder="e.g., www.mylandingpage.com"
                          value={newDomain}
                          onChange={(e) => setNewDomain(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter the domain without http:// or https://
                        </p>
                      </div>
                      {newDomain && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <Label className="text-xs text-blue-700">Analytics URL Preview</Label>
                          <p className="text-sm font-mono text-blue-800 mt-1 break-all">
                            {getAnalyticsUrl(newDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''))}
                          </p>
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDomain(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddDomain} disabled={addingDomain || !newDomain.trim()}>
                          {addingDomain ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Add Domain
                        </Button>
                      </DialogFooter>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDomains ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : domains.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No domains added yet</p>
                  <p className="text-sm">Add domains to track lead sources and view analytics</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Analytics URL</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <a
                              href={`https://${domain.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {domain.domain}
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded max-w-[300px] truncate">
                              {getAnalyticsUrl(domain.domain)}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => copyToClipboard(getAnalyticsUrl(domain.domain))}
                              title="Copy URL"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <a
                              href={getAnalyticsUrl(domain.domain)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open Analytics"
                            >
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600">
                                <Activity className="w-4 h-4" />
                              </Button>
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(domain.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteDomain(domain.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Analytics Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                About Analytics URLs
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Each domain automatically gets an analytics URL at <strong>a2ganalytics.com</strong>. 
                This URL tracks:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Lead submissions from this domain</li>
                <li>Conversion rates</li>
                <li>Lead quality metrics</li>
                <li>Real-time traffic data</li>
              </ul>
              <p className="text-xs mt-3">
                Click the <Activity className="w-3 h-3 inline text-blue-600" /> icon next to any domain to open its analytics dashboard.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Manage API keys for external form submissions</CardDescription>
                </div>
                <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setCreatedKey(null); setNewKey({ name: '', source_name: '', domain_name: '', allowed_lead_types: [], rate_limit: 1000 }); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create API Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{createdKey ? 'API Key Created' : 'Create New API Key'}</DialogTitle>
                      <DialogDescription>
                        {createdKey 
                          ? 'Save this key securely. It will not be shown again.'
                          : 'Create an API key for external form submissions'}
                      </DialogDescription>
                    </DialogHeader>
                    
                    {createdKey ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <Label className="text-green-800 font-medium">Your API Key</Label>
                          <div className="flex items-center gap-2 mt-2">
                            <code className="flex-1 p-2 bg-white border rounded text-sm break-all">
                              {createdKey.api_key}
                            </code>
                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(createdKey.api_key)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-orange-600 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Copy this key now. You won't be able to see it again!
                        </p>
                        <DialogFooter>
                          <Button onClick={() => { setShowCreateKey(false); setCreatedKey(null); }}>
                            Done
                          </Button>
                        </DialogFooter>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Key Name *</Label>
                          <Input
                            placeholder="e.g., Landing Page Form"
                            value={newKey.name}
                            onChange={(e) => setNewKey(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Source Name *</Label>
                          <Input
                            placeholder="e.g., medicare-landing-page"
                            value={newKey.source_name}
                            onChange={(e) => setNewKey(prev => ({ ...prev, source_name: e.target.value }))}
                          />
                          <p className="text-xs text-muted-foreground">Identifier for tracking lead sources</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Domain Name</Label>
                          <Input
                            placeholder="e.g., www.mylandingpage.com"
                            value={newKey.domain_name}
                            onChange={(e) => setNewKey(prev => ({ ...prev, domain_name: e.target.value }))}
                          />
                          <p className="text-xs text-muted-foreground">Website domain where this API key will be used</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Rate Limit (requests/hour)</Label>
                          <Input
                            type="number"
                            value={newKey.rate_limit}
                            onChange={(e) => setNewKey(prev => ({ ...prev, rate_limit: parseInt(e.target.value) || 1000 }))}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCreateKey(false)}>Cancel</Button>
                          <Button onClick={handleCreateKey} disabled={creating}>
                            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Create Key
                          </Button>
                        </DialogFooter>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No API keys created yet</p>
                  <p className="text-sm">Create an API key to start receiving leads from external forms</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Key Prefix</TableHead>
                      <TableHead>Requests</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{key.source_name}</code>
                        </TableCell>
                        <TableCell>
                          {key.domain_name ? (
                            <a 
                              href={`https://${key.domain_name.replace(/^https?:\/\//, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                            >
                              <Globe className="w-3 h-3" />
                              {key.domain_name.replace(/^https?:\/\//, '')}
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{key.key_prefix}...</code>
                        </TableCell>
                        <TableCell>{key.request_count?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {key.last_request_at ? formatDate(key.last_request_at) : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={key.is_active ? 'default' : 'secondary'}>
                            {key.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={key.is_active}
                              onCheckedChange={(checked) => handleToggleKey(key.id, checked)}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteKey(key.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>All Leads</CardTitle>
                  <CardDescription>Leads received from external forms</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={leadFilters.status} onValueChange={(v) => setLeadFilters(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={leadFilters.lead_type} onValueChange={(v) => setLeadFilters(prev => ({ ...prev, lead_type: v }))}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Lead Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {LEAD_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="State"
                    className="w-[80px]"
                    value={leadFilters.state}
                    onChange={(e) => setLeadFilters(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                    maxLength={2}
                  />
                  <Button onClick={fetchLeads} disabled={loadingLeads}>
                    {loadingLeads ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Filter'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingLeads ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No leads found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Confirmation ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id} className={lead.is_duplicate ? 'bg-orange-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono">{lead.confirmation_id}</code>
                            {lead.is_duplicate && (
                              <Badge variant="outline" className="text-orange-600">DUP</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {lead.first_name} {lead.last_name}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {lead.email || 'N/A'}
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {lead.phone || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {lead.state || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{lead.lead_type?.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <code className="text-xs block">{lead.source_name}</code>
                            {lead.landing_page_url && (
                              <a 
                                href={lead.landing_page_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate max-w-[150px]"
                                title={lead.landing_page_url}
                              >
                                <Globe className="w-3 h-3 flex-shrink-0" />
                                {new URL(lead.landing_page_url).hostname}
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={lead.routing_status === 'assigned' ? 'default' : 'secondary'}>
                            {lead.routing_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(lead.submitted_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Duplicate Leads</CardTitle>
                  <CardDescription>Leads with matching email or phone within 30 days</CardDescription>
                </div>
                <Button onClick={fetchDuplicates} disabled={loadingDuplicates} variant="outline">
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingDuplicates ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDuplicates ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : duplicates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-green-500" />
                  <p>No duplicates found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Confirmation ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Original Lead</TableHead>
                      <TableHead>Previous Vendors</TableHead>
                      <TableHead>Detected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicates.map((dup) => (
                      <TableRow key={dup.id}>
                        <TableCell>
                          <code className="text-xs font-mono">{dup.confirmation_id}</code>
                        </TableCell>
                        <TableCell className="font-medium">
                          {dup.first_name} {dup.last_name}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{dup.email}</div>
                            <div className="text-muted-foreground">{dup.phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{dup.original_lead_id?.slice(0, 8)}...</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{dup.previous_vendors?.length || 0} vendor(s)</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(dup.duplicate_detected_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integration Guide Tab */}
        <TabsContent value="integration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integration Guide</CardTitle>
              <CardDescription>How to send leads from your HTML forms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">1. Create an API Key</h3>
                <p className="text-muted-foreground mb-2">
                  Go to the "API Keys" tab and create a new API key for your form/landing page.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">2. Send a POST Request</h3>
                <p className="text-muted-foreground mb-2">
                  Send lead data to the API endpoint with your API key:
                </p>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">{`POST ${API_URL}/api/lead-intake/submit
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "555-123-4567",
  "state": "CA",
  "city": "Los Angeles",
  "zip_code": "90001",
  "lead_type": "medicare",
  "tcpa_consent": true,
  "landing_page_url": "https://yoursite.com/medicare-form"
}`}</pre>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. Handle the Response</h3>
                <p className="text-muted-foreground mb-2">
                  The API returns a confirmation ID that buyers will see:
                </p>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">{`{
  "success": true,
  "confirmation_id": "VRM-20260312-A1B2C3D4",
  "lead_id": "uuid-here",
  "is_duplicate": false,
  "routing_status": "assigned",
  "assigned_count": 2,
  "message": "Lead assigned to 2 client(s)"
}`}</pre>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4. Available Lead Fields</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm mb-1">Required Fields</h4>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      <li>first_name</li>
                      <li>last_name</li>
                      <li>email or phone</li>
                      <li>state (2-letter code)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-1">Important Fields</h4>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      <li><strong>lead_type</strong> - Category (see below)</li>
                      <li><strong>landing_page_url</strong> - Form source URL</li>
                      <li>tcpa_consent, consent_text</li>
                      <li>jornaya_lead_id</li>
                      <li>trustedform_cert_url</li>
                      <li>custom_fields (object)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">5. Lead Types</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Use one of these values for the <code className="bg-gray-100 px-1 rounded">lead_type</code> field:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-medium text-sm mb-2 text-blue-600">Healthcare</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>medicare</li>
                      <li>health_insurance</li>
                      <li>medicaid</li>
                      <li>dental</li>
                      <li>vision</li>
                    </ul>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-medium text-sm mb-2 text-green-600">Insurance</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>auto_insurance</li>
                      <li>life_insurance</li>
                      <li>home_insurance</li>
                      <li>commercial_insurance</li>
                    </ul>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-medium text-sm mb-2 text-orange-600">Home Services</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>solar</li>
                      <li>roofing</li>
                      <li>hvac</li>
                      <li>windows</li>
                      <li>home_security</li>
                    </ul>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-medium text-sm mb-2 text-purple-600">Other</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>legal</li>
                      <li>education</li>
                      <li>finance</li>
                      <li>debt_relief</li>
                      <li>tax_services</li>
                      <li>general</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">6. JavaScript Example</h3>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">{`// HTML Form Submit Handler
document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  
  try {
    const response = await fetch('${API_URL}/api/lead-intake/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your_api_key_here'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Show confirmation to user
      alert('Thank you! Your confirmation ID: ' + result.confirmation_id);
    }
  } catch (error) {
    console.error('Error submitting lead:', error);
  }
});`}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
