import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Megaphone, Plus, Loader2, ExternalLink, Trash2, Pause, Play,
  Eye, Users, Target, DollarSign, BarChart3, ArrowRight, Copy, Search
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function MarketingCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [limits, setLimits] = useState({ max_pages: 5, current_count: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [creating, setCreating] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [form, setForm] = useState({
    title: '', slug: '', source_type: 'homepage', source_id: null,
    utm_source: '', utm_medium: '', utm_campaign: '', meta_description: '', budget: ''
  });

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campRes, tmplRes, limRes] = await Promise.all([
        axios.get(`${API_URL}/api/campaigns/`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/campaigns/templates/available`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/campaigns/settings/limits`, { headers: getHeaders() }),
      ]);
      setCampaigns(campRes.data);
      setTemplates(tmplRes.data);
      setLimits(limRes.data);
    } catch (error) { console.error('Failed to load campaigns'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.title || !form.slug) { toast.error('Title and slug are required'); return; }
    setCreating(true);
    try {
      await axios.post(`${API_URL}/api/campaigns/`, {
        ...form,
        budget: form.budget ? parseFloat(form.budget) : null,
      }, { headers: getHeaders() });
      toast.success('Campaign page created!');
      setShowCreate(false);
      setForm({ title: '', slug: '', source_type: 'homepage', source_id: null, utm_source: '', utm_medium: '', utm_campaign: '', meta_description: '', budget: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create campaign');
    } finally { setCreating(false); }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await axios.put(`${API_URL}/api/campaigns/${id}`, { status: newStatus }, { headers: getHeaders() });
      toast.success(`Campaign ${newStatus}`);
      fetchData();
    } catch (error) { toast.error('Failed to update'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign page?')) return;
    try {
      await axios.delete(`${API_URL}/api/campaigns/${id}`, { headers: getHeaders() });
      toast.success('Campaign deleted');
      fetchData();
    } catch (error) { toast.error('Failed to delete'); }
  };

  const handleViewAnalytics = async (campaign) => {
    setShowAnalytics(campaign.id);
    try {
      const res = await axios.get(`${API_URL}/api/campaigns/${campaign.id}/analytics`, { headers: getHeaders() });
      setAnalyticsData(res.data);
    } catch (error) { toast.error('Failed to load analytics'); }
  };

  const selectTemplate = (tmpl) => {
    setForm(prev => ({
      ...prev,
      source_type: tmpl.type === 'homepage' ? 'homepage' : tmpl.type === 'category' ? 'category' : 'product',
      source_id: tmpl.source_id || null,
      title: prev.title || `${tmpl.name} Campaign`,
      slug: prev.slug || tmpl.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
    }));
  };

  const copyUrl = (slug) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`);
    toast.success('Campaign URL copied!');
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.description?.toLowerCase().includes(templateSearch.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="marketing-campaigns">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Megaphone className="w-5 h-5" /> Marketing Campaigns</h2>
          <p className="text-sm text-muted-foreground">Create custom landing pages for PPC, social, and email campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{limits.current_count} / {limits.max_pages} pages</Badge>
          <Button onClick={() => setShowCreate(true)} disabled={limits.current_count >= limits.max_pages} data-testid="create-campaign-btn">
            <Plus className="w-4 h-4 mr-2" /> New Campaign Page
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center"><Megaphone className="w-5 h-5 text-white" /></div><div><p className="text-2xl font-bold">{campaigns.filter(c => c.status === 'active').length}</p><p className="text-xs text-muted-foreground">Active Campaigns</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center"><Users className="w-5 h-5 text-white" /></div><div><p className="text-2xl font-bold">{campaigns.reduce((s, c) => s + (c.visits || 0), 0)}</p><p className="text-xs text-muted-foreground">Total Visitors</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center"><Target className="w-5 h-5 text-white" /></div><div><p className="text-2xl font-bold">{campaigns.reduce((s, c) => s + (c.leads || 0), 0)}</p><p className="text-xs text-muted-foreground">Total Leads</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center"><DollarSign className="w-5 h-5 text-white" /></div><div><p className="text-2xl font-bold">${campaigns.reduce((s, c) => s + (c.budget || 0), 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Budget</p></div></div></CardContent></Card>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader><CardTitle className="text-base">Campaign Pages</CardTitle></CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No campaigns yet. Create your first campaign landing page.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`campaign-${c.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{c.title}</span>
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge>
                      <Badge variant="outline" className="text-xs">{c.source_type}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>/c/{c.slug}</span>
                      {c.utm_source && <span>Source: {c.utm_source}</span>}
                      <span>{c.visits || 0} visits</span>
                      <span>{c.leads || 0} leads</span>
                      {c.budget > 0 && <span>${c.budget}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyUrl(c.slug)} title="Copy URL"><Copy className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => window.open(`/c/${c.slug}`, '_blank')} title="Preview"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleViewAnalytics(c)} title="Analytics"><BarChart3 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(c.id, c.status)} title={c.status === 'active' ? 'Pause' : 'Activate'}>
                      {c.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="create-campaign-dialog">
          <DialogHeader><DialogTitle>Create Campaign Landing Page</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Template Picker */}
            <div>
              <Label className="mb-2 block">Choose a Page to Clone</Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} placeholder="Search pages..." className="pl-9" />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {filteredTemplates.map(t => (
                  <button key={t.id} onClick={() => selectTemplate(t)}
                    className={`w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center justify-between text-sm ${form.source_type === t.type && (t.type === 'homepage' || form.source_id === t.source_id) ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                    data-testid={`template-${t.id}`}>
                    <div>
                      <span className="font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{t.description}</span>
                    </div>
                    <Badge variant="outline" className="text-xs ml-2">{t.type}</Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Campaign Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Google Back Brace PPC" data-testid="campaign-title" />
              </div>
              <div>
                <Label>URL Slug *</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">/c/</span>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="google-back-brace-2025" data-testid="campaign-slug" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div><Label>UTM Source</Label><Input value={form.utm_source} onChange={(e) => setForm({ ...form, utm_source: e.target.value })} placeholder="google" /></div>
              <div><Label>UTM Medium</Label><Input value={form.utm_medium} onChange={(e) => setForm({ ...form, utm_medium: e.target.value })} placeholder="cpc" /></div>
              <div><Label>UTM Campaign</Label><Input value={form.utm_campaign} onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })} placeholder="back-brace-q1" /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Meta Description</Label><Input value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} placeholder="SEO description for this page" /></div>
              <div><Label>Budget ($)</Label><Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="500.00" /></div>
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full" data-testid="submit-campaign">
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4 mr-2" /> Create Campaign Page</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={!!showAnalytics} onOpenChange={() => { setShowAnalytics(null); setAnalyticsData(null); }}>
        <DialogContent className="max-w-2xl" data-testid="campaign-analytics-dialog">
          <DialogHeader><DialogTitle>Campaign Analytics</DialogTitle></DialogHeader>
          {analyticsData ? (
            <div className="space-y-4 pt-2">
              <h3 className="font-medium">{analyticsData.campaign?.title}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg text-center"><p className="text-2xl font-bold text-blue-700">{analyticsData.stats.visitors}</p><p className="text-xs text-blue-600">Visitors</p></div>
                <div className="p-3 bg-green-50 rounded-lg text-center"><p className="text-2xl font-bold text-green-700">{analyticsData.stats.leads}</p><p className="text-xs text-green-600">Leads</p></div>
                <div className="p-3 bg-amber-50 rounded-lg text-center"><p className="text-2xl font-bold text-amber-700">{analyticsData.stats.conversion_rate}%</p><p className="text-xs text-amber-600">Conversion</p></div>
                <div className="p-3 bg-purple-50 rounded-lg text-center"><p className="text-2xl font-bold text-purple-700">${analyticsData.stats.cost_per_lead}</p><p className="text-xs text-purple-600">Cost/Lead</p></div>
              </div>
              {analyticsData.recent_leads?.length > 0 ? (
                <div>
                  <h4 className="font-medium text-sm mb-2">Recent Leads</h4>
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {analyticsData.recent_leads.map(lead => (
                      <div key={lead.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{lead.first_name} {lead.last_name}</span>
                          <span className="text-muted-foreground ml-2">{lead.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No leads captured yet</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
