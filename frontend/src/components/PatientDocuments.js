import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
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
  Send,
  Pen,
  FileSignature,
  User,
  Users,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  Clock,
  Mail,
  FolderOpen,
  Search,
  Filter,
  ChevronRight
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Category display info
const CATEGORIES = {
  intake: { label: 'Intake', color: 'bg-blue-500' },
  hipaa: { label: 'HIPAA', color: 'bg-purple-500' },
  insurance: { label: 'Insurance', color: 'bg-green-500' },
  equipment: { label: 'Equipment', color: 'bg-orange-500' },
  compliance: { label: 'Compliance', color: 'bg-red-500' },
  financial: { label: 'Financial', color: 'bg-yellow-500' },
  delivery: { label: 'Delivery', color: 'bg-cyan-500' },
  other: { label: 'Other', color: 'bg-gray-500' }
};

export default function PatientDocuments({ isSuperAdmin = false }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');
  
  // Templates
  const [templates, setTemplates] = useState([]);
  const [templatesByCategory, setTemplatesByCategory] = useState({});
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    description: '',
    category: 'other',
    content: '',
    is_required: true,
    is_active: true,
    auto_assign: false
  });
  
  // Patient Assignment
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [patientDocs, setPatientDocs] = useState({ pending: [], signed: [] });
  const [sendEmail, setSendEmail] = useState(false);

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
        fetchPatients()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const url = isSuperAdmin ? `${API_URL}/api/patient-documents/templates/all` : `${API_URL}/api/patient-documents/templates`;
      const res = await axios.get(url, { headers: getHeaders() });
      setTemplates(res.data.templates || []);
      setTemplatesByCategory(res.data.by_category || {});
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/patients?limit=100`, { headers: getHeaders() });
      setPatients(res.data.patients || res.data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchPatientDocuments = async (patientId) => {
    try {
      const res = await axios.get(`${API_URL}/api/patient-documents/patient/${patientId}`, { headers: getHeaders() });
      setPatientDocs({
        pending: res.data.pending || [],
        signed: res.data.signed || []
      });
    } catch (error) {
      console.error('Error fetching patient docs:', error);
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
      await axios.post(`${API_URL}/api/patient-documents/templates`, newTemplate, { headers: getHeaders() });
      toast.success('Template created');
      setShowTemplateEditor(false);
      setNewTemplate({ title: '', description: '', category: 'other', content: '', is_required: true, is_active: true, auto_assign: false });
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
      await axios.put(`${API_URL}/api/patient-documents/templates/${editingTemplate.id}`, editingTemplate, { headers: getHeaders() });
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
      await axios.delete(`${API_URL}/api/patient-documents/templates/${templateId}`, { headers: getHeaders() });
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setSaving(true);
      const res = await axios.post(`${API_URL}/api/patient-documents/templates/seed-defaults`, {}, { headers: getHeaders() });
      toast.success(res.data.message);
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to seed defaults');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveTemplate = async (index, direction) => {
    const newTemplates = [...templates];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= templates.length) return;
    
    [newTemplates[index], newTemplates[newIndex]] = [newTemplates[newIndex], newTemplates[index]];
    setTemplates(newTemplates);
    
    try {
      await axios.post(`${API_URL}/api/patient-documents/templates/reorder`, 
        newTemplates.map(t => t.id),
        { headers: getHeaders() }
      );
    } catch (error) {
      toast.error('Failed to reorder');
      fetchTemplates();
    }
  };

  // Document Assignment
  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSelectedTemplates([]);
    fetchPatientDocuments(patient.id);
  };

  const handleToggleTemplate = (templateId) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleSelectAllTemplates = () => {
    if (selectedTemplates.length === templates.length) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates(templates.map(t => t.id));
    }
  };

  const handleAssignDocuments = async () => {
    if (!selectedPatient || selectedTemplates.length === 0) {
      toast.error('Please select a patient and at least one document');
      return;
    }
    
    setSaving(true);
    try {
      const res = await axios.post(`${API_URL}/api/patient-documents/assign`, {
        patient_id: selectedPatient.id,
        template_ids: selectedTemplates,
        send_email: sendEmail
      }, { headers: getHeaders() });
      
      toast.success(res.data.message);
      setSelectedTemplates([]);
      fetchPatientDocuments(selectedPatient.id);
    } catch (error) {
      toast.error('Failed to assign documents');
    } finally {
      setSaving(false);
    }
  };

  const handleResendEmail = async (assignmentId) => {
    try {
      await axios.post(`${API_URL}/api/patient-documents/resend-email/${assignmentId}`, {}, { headers: getHeaders() });
      toast.success('Signing link resent');
    } catch (error) {
      toast.error('Failed to resend email');
    }
  };

  const handleCancelAssignment = async (assignmentId) => {
    if (!window.confirm('Cancel this document assignment?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/patient-documents/assignment/${assignmentId}`, { headers: getHeaders() });
      toast.success('Assignment cancelled');
      if (selectedPatient) {
        fetchPatientDocuments(selectedPatient.id);
      }
    } catch (error) {
      toast.error('Failed to cancel assignment');
    }
  };

  // Filter patients
  const filteredPatients = patients.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

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
            <FileText className="w-6 h-6" />
            Patient Documents
          </h2>
          <p className="text-muted-foreground">Document templates and patient document management</p>
        </div>
        <Badge variant="outline">{templates.length} Templates</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates" className="gap-1">
            <FileText className="w-4 h-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="assign" className="gap-1">
            <Send className="w-4 h-4" /> Assign to Patient
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-1">
            <FolderOpen className="w-4 h-4" /> View Patient Docs
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Patient Document Templates</CardTitle>
                  <CardDescription>Create and manage document templates for patients</CardDescription>
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                          <h4 className="font-medium">{template.title}</h4>
                          <Badge className={`${CATEGORIES[template.category]?.color || 'bg-gray-500'} text-white text-xs`}>
                            {CATEGORIES[template.category]?.label || template.category}
                          </Badge>
                          {template.is_required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                          {template.auto_assign && <Badge variant="outline" className="text-xs">Auto-Assign</Badge>}
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
                        placeholder="Patient Intake Form"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <select
                        className="w-full h-10 px-3 border rounded-md"
                        value={editingTemplate?.category || newTemplate.category}
                        onChange={(e) => editingTemplate 
                          ? setEditingTemplate(prev => ({ ...prev, category: e.target.value }))
                          : setNewTemplate(prev => ({ ...prev, category: e.target.value }))
                        }
                      >
                        {Object.entries(CATEGORIES).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={editingTemplate?.description || newTemplate.description}
                      onChange={(e) => editingTemplate 
                        ? setEditingTemplate(prev => ({ ...prev, description: e.target.value }))
                        : setNewTemplate(prev => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Basic patient information form"
                    />
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
                  
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingTemplate?.is_required ?? newTemplate.is_required}
                        onCheckedChange={(checked) => editingTemplate 
                          ? setEditingTemplate(prev => ({ ...prev, is_required: checked }))
                          : setNewTemplate(prev => ({ ...prev, is_required: checked }))
                        }
                      />
                      <Label>Required</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingTemplate?.auto_assign ?? newTemplate.auto_assign}
                        onCheckedChange={(checked) => editingTemplate 
                          ? setEditingTemplate(prev => ({ ...prev, auto_assign: checked }))
                          : setNewTemplate(prev => ({ ...prev, auto_assign: checked }))
                        }
                      />
                      <Label>Auto-assign to new patients</Label>
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

        {/* Assign to Patient Tab */}
        <TabsContent value="assign">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Patient Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Select Patient
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search patients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {filteredPatients.map(patient => (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                        selectedPatient?.id === patient.id ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                          <p className="text-sm text-muted-foreground">{patient.email}</p>
                        </div>
                        {selectedPatient?.id === patient.id && (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Document Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Select Documents
                </CardTitle>
                <CardDescription>
                  {selectedPatient 
                    ? `Assigning to: ${selectedPatient.first_name} ${selectedPatient.last_name}`
                    : 'Select a patient first'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedPatient ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a patient to assign documents</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={handleSelectAllTemplates}>
                        {selectedTemplates.length === templates.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {selectedTemplates.length} selected
                      </span>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {templates.filter(t => t.is_active).map(template => (
                        <div
                          key={template.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                            selectedTemplates.includes(template.id) ? 'border-primary bg-primary/5' : ''
                          }`}
                          onClick={() => handleToggleTemplate(template.id)}
                        >
                          <Checkbox
                            checked={selectedTemplates.includes(template.id)}
                            onCheckedChange={() => handleToggleTemplate(template.id)}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{template.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`${CATEGORIES[template.category]?.color} text-white text-xs`}>
                                {CATEGORIES[template.category]?.label}
                              </Badge>
                              {template.is_required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Checkbox
                        id="send-email"
                        checked={sendEmail}
                        onCheckedChange={setSendEmail}
                      />
                      <Label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
                        <Mail className="w-4 h-4" />
                        Send email with signing link
                      </Label>
                    </div>
                    
                    <Button 
                      onClick={handleAssignDocuments} 
                      disabled={saving || selectedTemplates.length === 0}
                      className="w-full"
                    >
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Assign {selectedTemplates.length} Document{selectedTemplates.length !== 1 ? 's' : ''}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* View Patient Docs Tab */}
        <TabsContent value="manage">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Patient List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Patients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="max-h-96 overflow-y-auto space-y-1">
                  {filteredPatients.map(patient => (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className={`p-2 rounded cursor-pointer hover:bg-muted/50 flex items-center justify-between ${
                        selectedPatient?.id === patient.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <span className="text-sm truncate">{patient.first_name} {patient.last_name}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Patient Documents */}
            <div className="md:col-span-2 space-y-4">
              {!selectedPatient ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a patient to view their documents</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        Pending Documents ({patientDocs.pending.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {patientDocs.pending.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No pending documents</p>
                      ) : (
                        <div className="space-y-2">
                          {patientDocs.pending.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <p className="font-medium text-sm">{doc.template_title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant={doc.status === 'viewed' ? 'default' : 'secondary'} className="text-xs">
                                    {doc.status}
                                  </Badge>
                                  {doc.sent_at && (
                                    <span className="text-xs text-muted-foreground">
                                      Sent {new Date(doc.sent_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleResendEmail(doc.id)}>
                                  <Mail className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleCancelAssignment(doc.id)}>
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        Signed Documents ({patientDocs.signed.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {patientDocs.signed.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No signed documents</p>
                      ) : (
                        <div className="space-y-2">
                          {patientDocs.signed.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <p className="font-medium text-sm">{doc.template_title}</p>
                                <p className="text-xs text-muted-foreground">
                                  Signed by {doc.signed_by_name} on {new Date(doc.signed_at).toLocaleDateString()}
                                </p>
                              </div>
                              {doc.pdf_url && (
                                <Button variant="outline" size="sm" onClick={() => window.open(doc.pdf_url, '_blank')}>
                                  <Download className="w-4 h-4 mr-1" /> PDF
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
