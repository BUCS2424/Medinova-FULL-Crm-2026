import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import DocumentEditor from './DocumentEditor';
import { 
  FileText,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Edit,
  Eye,
  Download,
  GripVertical,
  Send,
  Pen,
  FileSignature,
  Building,
  User,
  Phone,
  Mail,
  Globe,
  Hash,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  AlertCircle,
  FolderOpen,
  Clock
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function OnboardingDocuments({ isSuperAdmin = false }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');
  
  // Templates
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    description: '',
    content: '',
    is_required: true,
    is_active: true
  });
  
  // Company Info
  const [companyInfo, setCompanyInfo] = useState({
    company_name: '',
    company_dba: '',
    company_address: '',
    company_city: '',
    company_state: '',
    company_zip: '',
    company_phone: '',
    company_fax: '',
    company_email: '',
    company_website: '',
    company_ein: '',
    company_npi: '',
    company_license_number: '',
    owner_name: '',
    owner_title: '',
    owner_email: '',
    owner_phone: ''
  });
  
  // Documents & Signing
  const [pendingDocs, setPendingDocs] = useState([]);
  const [signedDocs, setSignedDocs] = useState([]);
  const [signingDoc, setSigningDoc] = useState(null);
  const [signatureData, setSignatureData] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Onboarding Status
  const [onboardingStatus, setOnboardingStatus] = useState({
    is_complete: false,
    required_count: 0,
    signed_count: 0,
    progress_percent: 0
  });

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('dme_token')}`
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTemplates(),
        fetchCompanyInfo(),
        fetchPendingDocuments(),
        fetchSignedDocuments(),
        fetchOnboardingStatus()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const url = isSuperAdmin ? `${API_URL}/api/onboarding/templates/all` : `${API_URL}/api/onboarding/templates`;
      const res = await axios.get(url, { headers: getHeaders() });
      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchCompanyInfo = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/onboarding/company-info`, { headers: getHeaders() });
      if (res.data) {
        setCompanyInfo(prev => ({ ...prev, ...res.data }));
        // Pre-fill signer info
        setSignerName(res.data.owner_name || '');
        setSignerTitle(res.data.owner_title || '');
      }
    } catch (error) {
      console.error('Error fetching company info:', error);
    }
  };

  const fetchPendingDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/onboarding/documents/pending`, { headers: getHeaders() });
      setPendingDocs(res.data.pending || []);
    } catch (error) {
      console.error('Error fetching pending docs:', error);
    }
  };

  const fetchSignedDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/onboarding/documents/signed`, { headers: getHeaders() });
      setSignedDocs(res.data.documents || []);
    } catch (error) {
      console.error('Error fetching signed docs:', error);
    }
  };

  const fetchOnboardingStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/onboarding/status`, { headers: getHeaders() });
      setOnboardingStatus(res.data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  // Template Management
  const handleCreateTemplate = async () => {
    if (!newTemplate.title || !newTemplate.content) {
      toast.error('Please enter title and content');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/onboarding/templates`, newTemplate, { headers: getHeaders() });
      toast.success('Template created');
      setShowTemplateEditor(false);
      setNewTemplate({ title: '', description: '', content: '', is_required: true, is_active: true });
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/onboarding/templates/${editingTemplate.id}`, editingTemplate, { headers: getHeaders() });
      toast.success('Template updated');
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Delete this template?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/onboarding/templates/${templateId}`, { headers: getHeaders() });
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleMoveTemplate = async (index, direction) => {
    const newTemplates = [...templates];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= templates.length) return;
    
    [newTemplates[index], newTemplates[newIndex]] = [newTemplates[newIndex], newTemplates[index]];
    setTemplates(newTemplates);
    
    try {
      await axios.post(`${API_URL}/api/onboarding/templates/reorder`, {
        template_ids: newTemplates.map(t => t.id)
      }, { headers: getHeaders() });
    } catch (error) {
      toast.error('Failed to reorder');
      fetchTemplates();
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setSaving(true);
      const res = await axios.post(`${API_URL}/api/onboarding/templates/seed-defaults`, {}, { headers: getHeaders() });
      toast.success(res.data.message);
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to seed defaults');
    } finally {
      setSaving(false);
    }
  };

  // Company Info
  const handleSaveCompanyInfo = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/onboarding/company-info`, companyInfo, { headers: getHeaders() });
      toast.success('Company information saved');
    } catch (error) {
      toast.error('Failed to save company info');
    } finally {
      setSaving(false);
    }
  };

  // Signature Canvas
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    initCanvas();
    setSignatureData('');
  };

  // Document Signing
  const handleSignDocument = async () => {
    if (!signingDoc || !signatureData || !signerName || !signerTitle) {
      toast.error('Please complete all fields and sign');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/onboarding/documents/sign`, {
        document_id: signingDoc.id,
        signature_data: signatureData,
        signed_by_name: signerName,
        signed_by_title: signerTitle
      }, { headers: getHeaders() });
      
      toast.success('Document signed successfully!');
      setSigningDoc(null);
      setSignatureData('');
      fetchPendingDocuments();
      fetchSignedDocuments();
      fetchOnboardingStatus();
    } catch (error) {
      toast.error('Failed to sign document');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadDocument = async (docId) => {
    try {
      const res = await axios.get(`${API_URL}/api/onboarding/documents/${docId}/download`, { headers: getHeaders() });
      if (res.data.download_url) {
        window.open(res.data.download_url, '_blank');
      } else {
        toast.error('PDF not available');
      }
    } catch (error) {
      toast.error('Failed to download');
    }
  };

  useEffect(() => {
    if (signingDoc && canvasRef.current) {
      initCanvas();
    }
  }, [signingDoc]);

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
            <FileSignature className="w-6 h-6" />
            Onboarding Documents
          </h2>
          <p className="text-muted-foreground">Legal documents and e-signature management</p>
        </div>
        
        {/* Progress */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Onboarding Progress</p>
            <p className="text-lg font-bold">{onboardingStatus.signed_count} / {onboardingStatus.required_count}</p>
          </div>
          <div className="w-32 h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${onboardingStatus.is_complete ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${onboardingStatus.progress_percent}%` }}
            />
          </div>
          {onboardingStatus.is_complete ? (
            <Badge className="bg-green-500 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" /> In Progress
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {isSuperAdmin && (
            <TabsTrigger value="templates" className="gap-1">
              <FileText className="w-4 h-4" /> Templates
            </TabsTrigger>
          )}
          <TabsTrigger value="company" className="gap-1">
            <Building className="w-4 h-4" /> Company Info
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1">
            <Pen className="w-4 h-4" /> Sign Documents
            {pendingDocs.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                {pendingDocs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="signed" className="gap-1">
            <FolderOpen className="w-4 h-4" /> Signed Docs
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab (Super Admin Only) */}
        {isSuperAdmin && (
          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Document Templates</CardTitle>
                    <CardDescription>Create and manage onboarding document templates</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSeedDefaults} disabled={saving}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Load Defaults
                    </Button>
                    <Button onClick={() => setShowTemplateEditor(true)}>
                      <Plus className="w-4 h-4 mr-2" /> New Template
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No templates created yet</p>
                    <Button variant="link" onClick={handleSeedDefaults}>Load default templates</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates.map((template, idx) => (
                      <div 
                        key={template.id} 
                        className={`flex items-center gap-3 p-4 border rounded-lg ${!template.is_active ? 'opacity-50' : ''}`}
                      >
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleMoveTemplate(idx, 'up')} disabled={idx === 0}>
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleMoveTemplate(idx, 'down')} disabled={idx === templates.length - 1}>
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                            <h4 className="font-medium">{template.title}</h4>
                            {template.is_required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                            {!template.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(template)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteTemplate(template.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Template Editor Modal */}
            {(showTemplateEditor || editingTemplate) && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold">
                        {editingTemplate ? 'Edit Template' : 'Create Template'}
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Title *</Label>
                        <Input
                          value={editingTemplate?.title || newTemplate.title}
                          onChange={(e) => editingTemplate 
                            ? setEditingTemplate(prev => ({ ...prev, title: e.target.value }))
                            : setNewTemplate(prev => ({ ...prev, title: e.target.value }))
                          }
                          placeholder="Business Associate Agreement"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={editingTemplate?.description || newTemplate.description}
                          onChange={(e) => editingTemplate 
                            ? setEditingTemplate(prev => ({ ...prev, description: e.target.value }))
                            : setNewTemplate(prev => ({ ...prev, description: e.target.value }))
                          }
                          placeholder="HIPAA-required agreement"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Content *</Label>
                      <DocumentEditor
                        content={editingTemplate?.content || newTemplate.content}
                        onChange={(html) => editingTemplate 
                          ? setEditingTemplate(prev => ({ ...prev, content: html }))
                          : setNewTemplate(prev => ({ ...prev, content: html }))
                        }
                        placeholder="Start typing your document content..."
                        showVariables={true}
                      />
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingTemplate?.is_required ?? newTemplate.is_required}
                          onCheckedChange={(checked) => editingTemplate 
                            ? setEditingTemplate(prev => ({ ...prev, is_required: checked }))
                            : setNewTemplate(prev => ({ ...prev, is_required: checked }))
                          }
                        />
                        <Label>Required for onboarding</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingTemplate?.is_active ?? newTemplate.is_active}
                          onCheckedChange={(checked) => editingTemplate 
                            ? setEditingTemplate(prev => ({ ...prev, is_active: checked }))
                            : setNewTemplate(prev => ({ ...prev, is_active: checked }))
                          }
                        />
                        <Label>Active</Label>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}>
                        Cancel
                      </Button>
                      <Button onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {editingTemplate ? 'Update' : 'Create'} Template
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {/* Company Info Tab */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Company Information
              </CardTitle>
              <CardDescription>This information will be auto-filled into document templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Building className="w-4 h-4" /> Company Name *</Label>
                  <Input
                    value={companyInfo.company_name}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Acme Medical Supplies, LLC"
                  />
                </div>
                <div className="space-y-2">
                  <Label>DBA (Doing Business As)</Label>
                  <Input
                    value={companyInfo.company_dba}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_dba: e.target.value }))}
                    placeholder="Acme Medical"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input
                  value={companyInfo.company_address}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_address: e.target.value }))}
                  placeholder="123 Medical Plaza Drive"
                />
              </div>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={companyInfo.company_city}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_city: e.target.value }))}
                    placeholder="Tampa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={companyInfo.company_state}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_state: e.target.value }))}
                    placeholder="FL"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ZIP Code</Label>
                  <Input
                    value={companyInfo.company_zip}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_zip: e.target.value }))}
                    placeholder="33609"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> Phone</Label>
                  <Input
                    value={companyInfo.company_phone}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_phone: e.target.value }))}
                    placeholder="(813) 555-1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fax</Label>
                  <Input
                    value={companyInfo.company_fax}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_fax: e.target.value }))}
                    placeholder="(813) 555-1235"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email</Label>
                  <Input
                    value={companyInfo.company_email}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_email: e.target.value }))}
                    placeholder="contact@acmemedical.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Globe className="w-4 h-4" /> Website</Label>
                  <Input
                    value={companyInfo.company_website}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_website: e.target.value }))}
                    placeholder="https://acmemedical.com"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Hash className="w-4 h-4" /> EIN (Tax ID)</Label>
                  <Input
                    value={companyInfo.company_ein}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_ein: e.target.value }))}
                    placeholder="XX-XXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>NPI Number</Label>
                  <Input
                    value={companyInfo.company_npi}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_npi: e.target.value }))}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>License Number</Label>
                  <Input
                    value={companyInfo.company_license_number}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_license_number: e.target.value }))}
                    placeholder="DME12345"
                  />
                </div>
              </div>
              
              <hr className="my-4" />
              
              <h4 className="font-medium flex items-center gap-2"><User className="w-4 h-4" /> Owner/Administrator Information</h4>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Owner/Admin Name *</Label>
                  <Input
                    value={companyInfo.owner_name}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, owner_name: e.target.value }))}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={companyInfo.owner_title}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, owner_title: e.target.value }))}
                    placeholder="Owner / CEO"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Owner Email</Label>
                  <Input
                    value={companyInfo.owner_email}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, owner_email: e.target.value }))}
                    placeholder="john@acmemedical.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner Phone</Label>
                  <Input
                    value={companyInfo.owner_phone}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, owner_phone: e.target.value }))}
                    placeholder="(813) 555-9999"
                  />
                </div>
              </div>
              
              <Button onClick={handleSaveCompanyInfo} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Company Information
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Documents Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pen className="w-5 h-5" />
                Documents Pending Signature
              </CardTitle>
              <CardDescription>Review and sign each document with your e-signature</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingDocs.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="text-lg font-medium">All documents signed!</p>
                  <p className="text-muted-foreground">Your onboarding is complete.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingDocs.map((doc, idx) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="font-medium">{doc.title}</h4>
                          <p className="text-sm text-muted-foreground">{doc.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.is_required && <Badge variant="destructive">Required</Badge>}
                        <Button onClick={() => setSigningDoc(doc)}>
                          <Pen className="w-4 h-4 mr-2" /> Review & Sign
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signing Modal */}
          {signingDoc && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="text-lg font-bold">{signingDoc.title}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setSigningDoc(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Document Preview */}
                  <div 
                    className="prose dark:prose-invert max-w-none mb-6 p-6 border rounded-lg bg-white"
                    dangerouslySetInnerHTML={{ __html: signingDoc.filled_content }}
                  />
                  
                  {/* Signature Section */}
                  <div className="border-t pt-6 space-y-4">
                    <h4 className="font-bold flex items-center gap-2">
                      <FileSignature className="w-5 h-5" /> Electronic Signature
                    </h4>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Your Full Name *</Label>
                        <Input
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          placeholder="John Smith"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Your Title *</Label>
                        <Input
                          value={signerTitle}
                          onChange={(e) => setSignerTitle(e.target.value)}
                          placeholder="Owner / CEO"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Sign Below *</Label>
                      <div className="border rounded-lg p-2 bg-white">
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={150}
                          className="border rounded cursor-crosshair w-full"
                          style={{ touchAction: 'none' }}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={clearSignature}>
                        Clear Signature
                      </Button>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      By signing above, I certify that I have read and agree to the terms of this document. 
                      This electronic signature has the same legal effect as a handwritten signature.
                    </p>
                  </div>
                </div>
                
                <div className="p-4 border-t flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSigningDoc(null)}>Cancel</Button>
                  <Button onClick={handleSignDocument} disabled={saving || !signatureData || !signerName || !signerTitle}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Sign Document
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Signed Documents Tab */}
        <TabsContent value="signed">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Signed Documents
              </CardTitle>
              <CardDescription>Download copies of your signed documents</CardDescription>
            </CardHeader>
            <CardContent>
              {signedDocs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No signed documents yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {signedDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <div>
                          <h4 className="font-medium">{doc.template_title}</h4>
                          <p className="text-sm text-muted-foreground">
                            Signed by {doc.signed_by_name} on {new Date(doc.signed_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSuperAdmin && (
                          <Badge variant="outline">{doc.company_name}</Badge>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleDownloadDocument(doc.id)}>
                          <Download className="w-4 h-4 mr-2" /> Download PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
