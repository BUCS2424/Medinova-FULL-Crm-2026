import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import RichTextEditor from './RichTextEditor';
import { 
  Mail, 
  Users, 
  Send, 
  Plus, 
  Trash2, 
  Edit2, 
  Download, 
  Upload, 
  Search,
  Sparkles,
  FileText,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  List,
  Settings,
  Wand2,
  Eye,
  Copy,
  ChevronRight,
  MailPlus,
  UserPlus,
  FolderPlus
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function NewsletterManager() {
  // State
  const [activeTab, setActiveTab] = useState('campaigns');
  const [lists, setLists] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [selectedList, setSelectedList] = useState('');
  const [subscriberPage, setSubscriberPage] = useState(1);
  const [subscriberTotal, setSubscriberTotal] = useState(0);
  
  // Dialog states
  const [showListDialog, setShowListDialog] = useState(false);
  const [showSubscriberDialog, setShowSubscriberDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  
  // Form states
  const [editingList, setEditingList] = useState(null);
  const [listForm, setListForm] = useState({ name: '', description: '' });
  const [subscriberForm, setSubscriberForm] = useState({ email: '', first_name: '', last_name: '', lists: [] });
  const [campaignForm, setCampaignForm] = useState({ subject: '', content: '', list_ids: [] });
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  
  // AI states
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSubject, setAiSubject] = useState('');
  
  // Auto-newsletter settings
  const [autoSettings, setAutoSettings] = useState({ enabled: false, frequency_days: 5, list_ids: [] });
  
  const fileInputRef = useRef(null);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchSubscribers();
  }, [selectedList, subscriberSearch, subscriberPage]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchLists(),
      fetchCampaigns(),
      fetchStats(),
      fetchAutoSettings()
    ]);
    setLoading(false);
  };

  const fetchLists = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/newsletter/lists`, { headers: getHeaders() });
      setLists(response.data);
    } catch (error) {
      console.error('Failed to fetch lists:', error);
    }
  };

  const fetchSubscribers = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedList) params.append('list_id', selectedList);
      if (subscriberSearch) params.append('search', subscriberSearch);
      params.append('page', subscriberPage);
      params.append('limit', 25);
      
      const response = await axios.get(`${API_URL}/api/newsletter/subscribers?${params}`, { headers: getHeaders() });
      setSubscribers(response.data.subscribers);
      setSubscriberTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch subscribers:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/newsletter/campaigns`, { headers: getHeaders() });
      setCampaigns(response.data);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/newsletter/stats`, { headers: getHeaders() });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchAutoSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/newsletter/settings/auto`, { headers: getHeaders() });
      setAutoSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch auto settings:', error);
    }
  };

  // List CRUD
  const handleSaveList = async () => {
    try {
      if (editingList) {
        await axios.put(`${API_URL}/api/newsletter/lists/${editingList.id}`, listForm, { headers: getHeaders() });
        toast.success('List updated');
      } else {
        await axios.post(`${API_URL}/api/newsletter/lists`, listForm, { headers: getHeaders() });
        toast.success('List created');
      }
      setShowListDialog(false);
      setEditingList(null);
      setListForm({ name: '', description: '' });
      fetchLists();
    } catch (error) {
      toast.error('Failed to save list');
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm('Delete this list? Subscribers will be removed from it.')) return;
    try {
      await axios.delete(`${API_URL}/api/newsletter/lists/${listId}`, { headers: getHeaders() });
      toast.success('List deleted');
      fetchLists();
    } catch (error) {
      toast.error('Failed to delete list');
    }
  };

  // Subscriber CRUD
  const handleSaveSubscriber = async () => {
    try {
      await axios.post(`${API_URL}/api/newsletter/subscribers`, subscriberForm, { headers: getHeaders() });
      toast.success('Subscriber added');
      setShowSubscriberDialog(false);
      setSubscriberForm({ email: '', first_name: '', last_name: '', lists: [] });
      fetchSubscribers();
      fetchStats();
    } catch (error) {
      toast.error('Failed to add subscriber');
    }
  };

  const handleDeleteSubscriber = async (subscriberId) => {
    if (!window.confirm('Delete this subscriber?')) return;
    try {
      await axios.delete(`${API_URL}/api/newsletter/subscribers/${subscriberId}`, { headers: getHeaders() });
      toast.success('Subscriber deleted');
      fetchSubscribers();
      fetchStats();
    } catch (error) {
      toast.error('Failed to delete subscriber');
    }
  };

  // Import/Export
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!selectedList) {
      toast.error('Please select a list first');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('list_id', selectedList);
    
    try {
      const response = await axios.post(`${API_URL}/api/newsletter/subscribers/import`, formData, { 
        headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' }
      });
      toast.success(response.data.message);
      fetchSubscribers();
      fetchStats();
    } catch (error) {
      toast.error('Import failed');
    }
    
    e.target.value = '';
  };

  const handleExport = async () => {
    try {
      const params = selectedList ? `?list_id=${selectedList}` : '';
      const response = await axios.get(`${API_URL}/api/newsletter/subscribers/export${params}`, { 
        headers: getHeaders(),
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `subscribers_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  // Campaign CRUD
  const handleSaveCampaign = async () => {
    try {
      if (editingCampaign) {
        await axios.put(`${API_URL}/api/newsletter/campaigns/${editingCampaign.id}`, campaignForm, { headers: getHeaders() });
        toast.success('Campaign updated');
      } else {
        await axios.post(`${API_URL}/api/newsletter/campaigns`, campaignForm, { headers: getHeaders() });
        toast.success('Campaign created');
      }
      setShowCampaignDialog(false);
      setEditingCampaign(null);
      setCampaignForm({ subject: '', content: '', list_ids: [] });
      fetchCampaigns();
    } catch (error) {
      toast.error('Failed to save campaign');
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await axios.delete(`${API_URL}/api/newsletter/campaigns/${campaignId}`, { headers: getHeaders() });
      toast.success('Campaign deleted');
      fetchCampaigns();
    } catch (error) {
      toast.error('Failed to delete campaign');
    }
  };

  const handleSendCampaign = async (campaignId) => {
    if (!window.confirm('Send this newsletter to all subscribers in the selected lists?')) return;
    try {
      const response = await axios.post(`${API_URL}/api/newsletter/campaigns/${campaignId}/send`, {}, { headers: getHeaders() });
      toast.success(response.data.message);
      fetchCampaigns();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send');
    }
  };

  // AI Generation
  const handleAIGenerate = async () => {
    if (!aiSubject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    
    setAiGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/api/newsletter/ai/generate`, {
        subject: aiSubject,
        tone: 'professional',
        include_products: true,
        list_ids: campaignForm.list_ids
      }, { headers: getHeaders() });
      
      setCampaignForm(prev => ({
        ...prev,
        subject: response.data.subject || aiSubject,
        content: response.data.content
      }));
      
      toast.success('Newsletter content generated!');
    } catch (error) {
      toast.error('AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  };

  // Auto settings
  const handleSaveAutoSettings = async () => {
    try {
      const formData = new FormData();
      formData.append('enabled', autoSettings.enabled);
      formData.append('frequency_days', autoSettings.frequency_days);
      formData.append('list_ids', autoSettings.list_ids.join(','));
      
      await axios.post(`${API_URL}/api/newsletter/settings/auto`, formData, { headers: getHeaders() });
      toast.success('Auto-newsletter settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
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
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Newsletter Manager
          </h2>
          <p className="text-sm text-muted-foreground">
            Create, manage, and send newsletters to your subscribers
          </p>
        </div>
        <Button onClick={fetchAll} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{stats?.total_subscribers || 0}</p>
                <p className="text-xs text-blue-600">Total Subscribers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                <List className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats?.total_lists || 0}</p>
                <p className="text-xs text-purple-600">Mailing Lists</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats?.total_campaigns || 0}</p>
                <p className="text-xs text-amber-600">Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{stats?.sent_campaigns || 0}</p>
                <p className="text-xs text-green-600">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <MailPlus className="w-4 h-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Subscribers
          </TabsTrigger>
          <TabsTrigger value="lists" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Lists
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Auto Settings
          </TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Email Campaigns</h3>
            <Button onClick={() => {
              setEditingCampaign(null);
              setCampaignForm({ subject: '', content: '', list_ids: [] });
              setAiSubject('');
              setShowCampaignDialog(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>

          <div className="space-y-3">
            {campaigns.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No campaigns yet. Create your first newsletter!</p>
                </CardContent>
              </Card>
            ) : campaigns.map(campaign => (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{campaign.subject}</h4>
                        <Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'}>
                          {campaign.status === 'sent' ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1" /> Sent</>
                          ) : (
                            <><Clock className="w-3 h-3 mr-1" /> Draft</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Created: {new Date(campaign.created_at).toLocaleDateString()}
                        {campaign.sent_at && ` • Sent: ${new Date(campaign.sent_at).toLocaleDateString()}`}
                        {campaign.sent_count > 0 && ` • ${campaign.sent_count} delivered`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setPreviewContent(campaign.content);
                          setShowPreviewDialog(true);
                        }}
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {campaign.status !== 'sent' && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setEditingCampaign(campaign);
                              setCampaignForm({
                                subject: campaign.subject,
                                content: campaign.content,
                                list_ids: campaign.list_ids || []
                              });
                              setShowCampaignDialog(true);
                            }}
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="default"
                            size="sm"
                            onClick={() => handleSendCampaign(campaign.id)}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Send
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Subscribers Tab */}
        <TabsContent value="subscribers" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search subscribers..."
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select 
                value={selectedList} 
                onChange={(e) => setSelectedList(e.target.value)}
                className="h-10 px-3 border rounded-md bg-background"
              >
                <option value="">All Lists</option>
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => {
                setSubscriberForm({ email: '', first_name: '', last_name: '', lists: selectedList ? [selectedList] : [] });
                setShowSubscriberDialog(true);
              }}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Source</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Lists</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No subscribers found
                      </td>
                    </tr>
                  ) : subscribers.map(sub => (
                    <tr key={sub.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{sub.email}</td>
                      <td className="p-3">{sub.first_name} {sub.last_name}</td>
                      <td className="p-3">
                        <Badge variant="outline">{sub.source || 'manual'}</Badge>
                      </td>
                      <td className="p-3">
                        {sub.is_active ? (
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Unsubscribed</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {sub.lists?.length || 0} lists
                      </td>
                      <td className="p-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteSubscriber(sub.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {subscriberTotal > 25 && (
            <div className="flex justify-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={subscriberPage === 1}
                onClick={() => setSubscriberPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="py-2 px-4 text-sm">
                Page {subscriberPage} of {Math.ceil(subscriberTotal / 25)}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                disabled={subscriberPage >= Math.ceil(subscriberTotal / 25)}
                onClick={() => setSubscriberPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Lists Tab */}
        <TabsContent value="lists" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Mailing Lists</h3>
            <Button onClick={() => {
              setEditingList(null);
              setListForm({ name: '', description: '' });
              setShowListDialog(true);
            }}>
              <FolderPlus className="w-4 h-4 mr-2" />
              New List
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {lists.length === 0 ? (
              <Card className="col-span-2 bg-muted/50">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <List className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No lists yet. Create your first mailing list!</p>
                </CardContent>
              </Card>
            ) : lists.map(list => (
              <Card key={list.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{list.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setEditingList(list);
                          setListForm({ name: list.name, description: list.description || '' });
                          setShowListDialog(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteList(list.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{list.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subscribers</span>
                    <Badge variant="secondary">{list.subscriber_count || 0}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Auto Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                AI Auto-Newsletter Settings
              </CardTitle>
              <CardDescription>
                Automatically generate and send newsletters featuring random products
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Auto Newsletter</p>
                  <p className="text-sm text-muted-foreground">
                    AI will generate and send newsletters automatically
                  </p>
                </div>
                <Button 
                  variant={autoSettings.enabled ? 'default' : 'outline'}
                  onClick={() => setAutoSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                >
                  {autoSettings.enabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency (days)</Label>
                  <Input 
                    type="number"
                    min={1}
                    max={30}
                    value={autoSettings.frequency_days}
                    onChange={(e) => setAutoSettings(prev => ({ 
                      ...prev, 
                      frequency_days: parseInt(e.target.value) || 5 
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to send auto-newsletters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Target Lists</Label>
                  <select 
                    multiple
                    value={autoSettings.list_ids}
                    onChange={(e) => setAutoSettings(prev => ({
                      ...prev,
                      list_ids: Array.from(e.target.selectedOptions, o => o.value)
                    }))}
                    className="w-full h-24 border rounded-md p-2"
                  >
                    {lists.map(list => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Hold Ctrl/Cmd to select multiple lists
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveAutoSettings} className="w-full">
                Save Auto-Newsletter Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* List Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingList ? 'Edit List' : 'Create New List'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>List Name</Label>
              <Input 
                value={listForm.name}
                onChange={(e) => setListForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., VIP Customers"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={listForm.description}
                onChange={(e) => setListForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What is this list for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowListDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveList}>Save List</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscriber Dialog */}
      <Dialog open={showSubscriberDialog} onOpenChange={setShowSubscriberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subscriber</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input 
                type="email"
                value={subscriberForm.email}
                onChange={(e) => setSubscriberForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input 
                  value={subscriberForm.first_name}
                  onChange={(e) => setSubscriberForm(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input 
                  value={subscriberForm.last_name}
                  onChange={(e) => setSubscriberForm(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Add to Lists</Label>
              <select 
                multiple
                value={subscriberForm.lists}
                onChange={(e) => setSubscriberForm(prev => ({
                  ...prev,
                  lists: Array.from(e.target.selectedOptions, o => o.value)
                }))}
                className="w-full h-24 border rounded-md p-2"
              >
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubscriberDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSubscriber}>Add Subscriber</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'Create Newsletter Campaign'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* AI Generator */}
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wand2 className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-purple-700">AI Newsletter Writer</span>
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter a topic and let AI write your newsletter..."
                    value={aiSubject}
                    onChange={(e) => setAiSubject(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleAIGenerate} 
                    disabled={aiGenerating}
                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    {aiGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Generate</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Subject Line *</Label>
              <Input 
                value={campaignForm.subject}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Your newsletter subject"
              />
            </div>

            <div className="space-y-2">
              <Label>Send to Lists *</Label>
              <select 
                multiple
                value={campaignForm.list_ids}
                onChange={(e) => setCampaignForm(prev => ({
                  ...prev,
                  list_ids: Array.from(e.target.selectedOptions, o => o.value)
                }))}
                className="w-full h-20 border rounded-md p-2"
              >
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.name} ({list.subscriber_count || 0} subscribers)</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Newsletter Content</Label>
              <RichTextEditor 
                value={campaignForm.content}
                onChange={(content) => setCampaignForm(prev => ({ ...prev, content }))}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>Cancel</Button>
            <Button 
              variant="outline"
              onClick={() => {
                setPreviewContent(campaignForm.content);
                setShowPreviewDialog(true);
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSaveCampaign}>
              {editingCampaign ? 'Update Campaign' : 'Save as Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Newsletter Preview</DialogTitle>
          </DialogHeader>
          <div 
            className="border rounded-lg p-6 bg-white"
            dangerouslySetInnerHTML={{ __html: previewContent }}
          />
          <DialogFooter>
            <Button onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
