import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import FileManager from '../components/FileManager';
import CommunicationPanel from '../components/CommunicationPanel';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal';
import { LeadDoctorTab } from '../components/LeadDoctorTab';
import { Video as VideoIcon } from 'lucide-react';
import {
  ArrowLeft,
  User,
  Phone,
  PhoneOutgoing,
  Mail,
  MapPin,
  Calendar,
  Shield,
  FileText,
  Edit,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
  Activity,
  UserPlus,
  ArrowRight,
  Globe,
  Target,
  MessageSquare,
  Trash2,
  Printer,
  Heart,
  Stethoscope,
  Building2,
  FolderOpen,
  Send,
  Search,
  Link2,
  DollarSign,
  Plus,
  Package,
  ShieldCheck
} from 'lucide-react';
import { useFeatures } from '../contexts/FeatureContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Click-to-call function - opens dialer popup with pre-filled number
const openDialerWithNumber = (phoneNumber, name, type = 'lead') => {
  if (!phoneNumber) {
    toast.error('No phone number available');
    return;
  }
  const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
  const width = 400;
  const height = 650;
  const left = window.screen.width - width - 50;
  const top = 50;
  window.open(
    `/dialer-window?number=${encodeURIComponent(cleanNumber)}&name=${encodeURIComponent(name || 'Unknown')}&type=${type}&autoCall=true`,
    'PhoneDialer',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
};

const LEAD_STATUSES = [
  { value: 'opportunity', label: 'Opportunity', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'verifying_insurance', label: 'Verifying Insurance', color: 'bg-lime-100 text-lime-700 border-lime-200' },
  { value: 'qualified', label: 'Qualified', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700 border-red-200' }
];

// Status badge colors
const getStatusBadge = (status) => {
  const config = LEAD_STATUSES.find(s => s.value === status) || LEAD_STATUSES[1];
  return <Badge className={`${config.color} border`}>{config.label}</Badge>;
};

export default function LeadDetailPage() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  
  // Lead data
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Related data
  const [activityLog, setActivityLog] = useState([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState('overview');
  const [contactOpen, setContactOpen] = useState(true);
  const [sourceOpen, setSourceOpen] = useState(true);
  const [medicalOpen, setMedicalOpen] = useState(true);
  
  // Convert dialog
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertData, setConvertData] = useState({
    date_of_birth: '',
    ssn_last_four: '',
    primary_insurance: '',
    secondary_insurance: '',
    address: ''
  });

  // Insurance Eligibility check
  const [eligModalOpen, setEligModalOpen] = useState(false);
  const [eligService, setEligService] = useState('availity');
  const [eligForm, setEligForm] = useState({ payer_id: '', member_id: '', service_type: 'DME' });
  const [eligRunning, setEligRunning] = useState(false);
  const [eligResult, setEligResult] = useState(null);
  const { isFeatureEnabled } = useFeatures();
  const insuranceEnabled = isFeatureEnabled('availity_integration') || isFeatureEnabled('waystar_integration');
  
  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  
  // Communication panel state
  const [showCommPanel, setShowCommPanel] = useState(false);
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  
  // Products state for sales tracking
  const [productsOpen, setProductsOpen] = useState(true);
  const [newProduct, setNewProduct] = useState({ name: '', value: '' });
  
  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };
  
  useEffect(() => {
    fetchLeadData();
    fetchComments();
  }, [leadId]);
  
  const fetchComments = async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`${API_URL}/api/leads/${leadId}/comments`, { headers });
      setComments(res.data || []);
    } catch (error) {
      console.log('No comments found or error fetching comments');
    }
  };
  
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setAddingComment(true);
    try {
      const headers = getHeaders();
      const res = await axios.post(`${API_URL}/api/leads/${leadId}/comments`, 
        { content: newComment },
        { headers }
      );
      setComments([res.data, ...comments]);
      setNewComment('');
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
      console.error(error);
    } finally {
      setAddingComment(false);
    }
  };
  
  const fetchLeadData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const leadRes = await axios.get(`${API_URL}/api/leads/${leadId}`, { headers });
      setLead(leadRes.data);
      setEditedLead(leadRes.data);
      
      // Build activity log from lead data
      const activities = [];
      if (leadRes.data.created_at) {
        activities.push({
          type: 'created',
          message: 'Lead created',
          timestamp: leadRes.data.created_at
        });
      }
      if (leadRes.data.updated_at && leadRes.data.updated_at !== leadRes.data.created_at) {
        activities.push({
          type: 'updated',
          message: 'Lead updated',
          timestamp: leadRes.data.updated_at
        });
      }
      if (leadRes.data.patient_id) {
        activities.push({
          type: 'converted',
          message: 'Converted to patient',
          timestamp: leadRes.data.updated_at
        });
      }
      setActivityLog(activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      
    } catch (error) {
      toast.error('Failed to load lead data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveLead = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/leads/${leadId}`, editedLead, { headers: getHeaders() });
      setLead(editedLead);
      setIsEditing(false);
      toast.success('Lead updated successfully');
    } catch (error) {
      toast.error('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };
  
  const handleStatusChange = async (newStatus) => {
    try {
      await axios.put(`${API_URL}/api/leads/${leadId}`, { status: newStatus }, { headers: getHeaders() });
      setLead({ ...lead, status: newStatus });
      setEditedLead({ ...editedLead, status: newStatus });
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };
  
  const handleConvert = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/leads/${leadId}/convert`, convertData, { headers: getHeaders() });
      toast.success('Lead converted to patient successfully!');
      setIsConvertOpen(false);
      navigate('/patients');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to convert lead');
    }
  };
  
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return;
    
    try {
      await axios.delete(`${API_URL}/api/leads/${leadId}`, { headers: getHeaders() });
      toast.success('Lead deleted successfully');
      navigate('/leads');
    } catch (error) {
      toast.error('Failed to delete lead');
    }
  };

  const handlePrintLead = () => {
    if (!lead) return;

    const printableWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printableWindow) {
      toast.error('Please allow pop-ups to print this lead sheet.');
      return;
    }

    const formatField = (value) => (value === undefined || value === null || value === '' ? 'N/A' : value);
    const leadName = `${formatField(lead.first_name)} ${formatField(lead.last_name)}`.trim();
    const leadSummaryHtml = `
      <html>
        <head>
          <title>Lead Sheet - ${leadName}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 24px; color: #1f2937; }
            h1 { margin: 0; color: #1e3a5f; }
            .sub { margin-top: 4px; color: #6b7280; }
            .section { margin-top: 20px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
            .section h2 { margin: 0 0 10px 0; color: #1e3a5f; font-size: 18px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px 18px; }
            .label { font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
            .value { font-size: 15px; font-weight: 600; margin-top: 2px; word-break: break-word; }
            .notes { white-space: pre-wrap; background: #f9fafb; border-radius: 8px; padding: 10px; border: 1px solid #e5e7eb; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
            @media print { body { margin: 12px; } }
          </style>
        </head>
        <body>
          <h1>MediNova Lead Sheet</h1>
          <p class="sub">Generated ${new Date().toLocaleString()}</p>

          <div class="section">
            <h2>Contact Details</h2>
            <div class="grid">
              <div><div class="label">Lead ID</div><div class="value">${formatField(lead.id)}</div></div>
              <div><div class="label">Status</div><div class="value">${formatField(lead.status)}</div></div>
              <div><div class="label">Name</div><div class="value">${leadName}</div></div>
              <div><div class="label">Phone</div><div class="value">${formatField(lead.phone)}</div></div>
              <div><div class="label">Email</div><div class="value">${formatField(lead.email)}</div></div>
              <div><div class="label">ZIP Code</div><div class="value">${formatField(lead.zip_code)}</div></div>
            </div>
          </div>

          <div class="section">
            <h2>Lead Context</h2>
            <div class="grid">
              <div><div class="label">Form Source</div><div class="value">${formatField(lead.form_source)}</div></div>
              <div><div class="label">Best Time to Call</div><div class="value">${formatField(lead.best_time_to_call)}</div></div>
              <div><div class="label">Pain Location</div><div class="value">${formatField(lead.pain_location)}</div></div>
              <div><div class="label">Insurance Type</div><div class="value">${formatField(lead.insurance_type)}</div></div>
              <div><div class="label">Has Doctor</div><div class="value">${formatField(lead.has_doctor)}</div></div>
              <div><div class="label">Created</div><div class="value">${formatDate(lead.created_at)}</div></div>
            </div>
          </div>

          <div class="section">
            <h2>Consent Snapshot</h2>
            <div class="grid">
              <div><div class="label">Consent Captured</div><div class="value">${lead.consent_captured ? 'Yes' : 'No'}</div></div>
              <div><div class="label">Consent Timestamp</div><div class="value">${formatField(lead.consent_timestamp)}</div></div>
              <div><div class="label">Consent IP</div><div class="value">${formatField(lead.consent_ip)}</div></div>
              <div><div class="label">Consent Record ID</div><div class="value">${formatField(lead.consent_record_id)}</div></div>
            </div>
          </div>

          <div class="section">
            <h2>Notes</h2>
            <div class="notes">${formatField(lead.notes)}</div>
          </div>

          <div class="footer">Use this sheet for internal review, print packets, or fax preparation.</div>
        </body>
      </html>
    `;

    printableWindow.document.open();
    printableWindow.document.write(leadSummaryHtml);
    printableWindow.document.close();
    printableWindow.focus();
    printableWindow.print();
  };

  const handlePrepareFax = () => {
    if (!lead) return;
    const params = new URLSearchParams({
      leadId: lead.id || leadId,
      leadName: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
      leadPhone: lead.phone || '',
      leadEmail: lead.email || '',
      leadZip: lead.zip_code || '',
      leadStatus: lead.status || '',
      leadSource: lead.form_source || '',
      leadNotes: lead.notes || ''
    });
    navigate(`/fax-center?${params.toString()}`);
  };
  
  // Product/Value handlers
  const handleAddProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.value) return;
    
    const product = {
      name: newProduct.name.trim(),
      value: parseFloat(newProduct.value) || 0
    };
    
    const updatedProducts = [...(lead.interested_products || []), product];
    const newEstimatedValue = updatedProducts.reduce((sum, p) => sum + (p.value || 0), 0);
    
    try {
      await axios.put(`${API_URL}/api/leads/${leadId}`, {
        interested_products: updatedProducts,
        estimated_value: newEstimatedValue
      }, { headers: getHeaders() });
      
      setLead({ ...lead, interested_products: updatedProducts, estimated_value: newEstimatedValue });
      setEditedLead({ ...editedLead, interested_products: updatedProducts, estimated_value: newEstimatedValue });
      setNewProduct({ name: '', value: '' });
      toast.success('Product added');
    } catch (error) {
      toast.error('Failed to add product');
    }
  };
  
  const handleRemoveProduct = async (index) => {
    const updatedProducts = (lead.interested_products || []).filter((_, i) => i !== index);
    const newEstimatedValue = updatedProducts.reduce((sum, p) => sum + (p.value || 0), 0);
    
    try {
      await axios.put(`${API_URL}/api/leads/${leadId}`, {
        interested_products: updatedProducts,
        estimated_value: newEstimatedValue
      }, { headers: getHeaders() });
      
      setLead({ ...lead, interested_products: updatedProducts, estimated_value: newEstimatedValue });
      setEditedLead({ ...editedLead, interested_products: updatedProducts, estimated_value: newEstimatedValue });
      toast.success('Product removed');
    } catch (error) {
      toast.error('Failed to remove product');
    }
  };
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Lead not found</p>
        <Button onClick={() => navigate('/leads')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Leads
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950" data-testid="lead-detail-page">
      {/* Left Sidebar - Lead Info */}
      <div className="w-80 bg-white dark:bg-navy-900 border-r flex flex-col overflow-hidden">
        {/* Lead Header */}
        <div className="p-4 border-b">
          {/* Back button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-3 -ml-2"
            onClick={() => navigate('/leads')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Leads
          </Button>
          
          {/* Lead Avatar & Name */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold">
              {getInitials(lead.first_name, lead.last_name)}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">
                {lead.first_name} {lead.last_name}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Created {formatDate(lead.created_at)}</span>
              </div>
            </div>
          </div>
          
          {/* Status */}
          <div className="flex items-center gap-2 mt-3">
            {getStatusBadge(lead.status)}
            {lead.patient_id && (
              <Badge className="bg-green-100 text-green-700 border-green-200 border flex items-center gap-1">
                <UserPlus className="w-3 h-3" />
                Converted
              </Badge>
            )}
          </div>
          
          {/* Quick Status Change */}
          <div className="mt-3">
            <Select value={lead.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Change Status" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-3">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSaveLead} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setEditedLead(lead); }}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="flex-1">
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrintLead}
                  data-testid="lead-print-sheet-button"
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Print
                </Button>
                {!lead.patient_id && lead.status !== 'lost' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePrepareFax}
                      data-testid="lead-prepare-fax-button"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Fax
                    </Button>
                    {insuranceEnabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEligForm({
                            payer_id: lead.primary_insurance || '',
                            member_id: lead.member_id || lead.insurance_id || '',
                            service_type: 'DME'
                          });
                          setEligResult(null);
                          setEligModalOpen(true);
                        }}
                        data-testid="lead-check-eligibility-button"
                        className="gap-1"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Eligibility
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setIsConvertOpen(true)}>
                      <UserPlus className="w-4 h-4 mr-1" />
                      Convert
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Scrollable Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Contact Section */}
          <Collapsible open={contactOpen} onOpenChange={setContactOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
              <span className="font-semibold text-sm flex items-center gap-2">
                <Phone className="w-4 h-4" />
                CONTACT
              </span>
              {contactOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              {isEditing ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">First Name</Label>
                    <Input 
                      value={editedLead.first_name || ''} 
                      onChange={(e) => setEditedLead({...editedLead, first_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Last Name</Label>
                    <Input 
                      value={editedLead.last_name || ''} 
                      onChange={(e) => setEditedLead({...editedLead, last_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input 
                      value={editedLead.phone || ''} 
                      onChange={(e) => setEditedLead({...editedLead, phone: e.target.value})}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input 
                      value={editedLead.email || ''} 
                      onChange={(e) => setEditedLead({...editedLead, email: e.target.value})}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">ZIP Code</Label>
                    <Input 
                      value={editedLead.zip_code || ''} 
                      onChange={(e) => setEditedLead({...editedLead, zip_code: e.target.value})}
                      placeholder="12345"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.phone || 'No phone on file'}</span>
                    {lead.phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => openDialerWithNumber(lead.phone, `${lead.first_name} ${lead.last_name}`, 'lead')}
                        title="Call this lead"
                        data-testid="call-lead-btn"
                      >
                        <PhoneOutgoing className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.email || 'No email on file'}</span>
                  </div>
                  {lead.zip_code && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>ZIP: {lead.zip_code}</span>
                    </div>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Medical Info Section (for opportunity leads) */}
          {(lead.pain_location || lead.has_medicare !== undefined || lead.has_doctor !== undefined) && (
            <Collapsible open={medicalOpen} onOpenChange={setMedicalOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  MEDICAL INFO
                </span>
                {medicalOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                {lead.pain_location && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Pain Location</div>
                    <p className="font-medium capitalize">{lead.pain_location}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg flex-1 text-center ${lead.has_medicare === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    <Shield className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs font-medium">Medicare</div>
                    <div className="text-xs">{lead.has_medicare === 'yes' ? 'Yes' : 'No'}</div>
                  </div>
                  <div className={`p-2 rounded-lg flex-1 text-center ${lead.has_doctor === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    <Stethoscope className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs font-medium">Has Doctor</div>
                    <div className="text-xs">{lead.has_doctor === 'yes' ? 'Yes' : 'No'}</div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {/* Source Section */}
          <Collapsible open={sourceOpen} onOpenChange={setSourceOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
              <span className="font-semibold text-sm flex items-center gap-2">
                <Globe className="w-4 h-4" />
                SOURCE / UTM
              </span>
              {sourceOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              {isEditing ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">UTM Source</Label>
                    <Input 
                      value={editedLead.utm_source || ''} 
                      onChange={(e) => setEditedLead({...editedLead, utm_source: e.target.value})}
                      placeholder="google"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">UTM Medium</Label>
                    <Input 
                      value={editedLead.utm_medium || ''} 
                      onChange={(e) => setEditedLead({...editedLead, utm_medium: e.target.value})}
                      placeholder="cpc"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">UTM Campaign</Label>
                    <Input 
                      value={editedLead.utm_campaign || ''} 
                      onChange={(e) => setEditedLead({...editedLead, utm_campaign: e.target.value})}
                      placeholder="spring_promo"
                    />
                  </div>
                </>
              ) : (
                <>
                  {lead.form_source && (
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      <span className="capitalize">{lead.form_source}</span>
                    </div>
                  )}
                  {lead.utm_source && (
                    <div className="p-2 bg-muted/50 rounded text-sm">
                      <span className="text-muted-foreground">Source:</span> {lead.utm_source}
                    </div>
                  )}
                  {lead.utm_medium && (
                    <div className="p-2 bg-muted/50 rounded text-sm">
                      <span className="text-muted-foreground">Medium:</span> {lead.utm_medium}
                    </div>
                  )}
                  {lead.utm_campaign && (
                    <div className="p-2 bg-muted/50 rounded text-sm">
                      <span className="text-muted-foreground">Campaign:</span> {lead.utm_campaign}
                    </div>
                  )}
                  {lead.utm_term && (
                    <div className="p-2 bg-muted/50 rounded text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><Search className="w-3 h-3 inline" /> Keywords:</span> {lead.utm_term}
                    </div>
                  )}
                  {lead.referrer && (
                    <div className="p-2 bg-muted/50 rounded text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><Link2 className="w-3 h-3 inline" /> Referrer:</span> 
                      <span className="truncate block" title={lead.referrer}>{lead.referrer}</span>
                    </div>
                  )}
                  {!lead.utm_source && !lead.utm_medium && !lead.utm_campaign && !lead.utm_term && !lead.referrer && !lead.form_source && (
                    <p className="text-sm text-muted-foreground">No source data available</p>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Products / Value Section */}
          <Collapsible open={productsOpen} onOpenChange={setProductsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
              <span className="font-semibold text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                VALUE / PRODUCTS
              </span>
              {productsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              {/* Total Estimated Value */}
              <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-xs text-green-600 dark:text-green-400 mb-1">Estimated Value</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300" data-testid="lead-estimated-value">
                  {formatCurrency(lead.estimated_value)}
                </div>
              </div>
              
              {/* Product List */}
              {lead.interested_products?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">Products of Interest</div>
                  {lead.interested_products.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg group">
                      <div className="flex items-center gap-2">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">{product.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-600">{formatCurrency(product.value)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveProduct(index)}
                          data-testid={`remove-product-${index}`}
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add Product Form */}
              <div className="space-y-2 pt-2 border-t">
                <div className="text-xs text-muted-foreground font-medium">Add Product</div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Product name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="text-sm h-8"
                    data-testid="new-product-name"
                  />
                  <Input
                    placeholder="$0.00"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.value}
                    onChange={(e) => setNewProduct({ ...newProduct, value: e.target.value })}
                    className="text-sm h-8 w-24"
                    data-testid="new-product-value"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full h-8"
                  onClick={handleAddProduct}
                  disabled={!newProduct.name.trim() || !newProduct.value}
                  data-testid="add-product-btn"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Product
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Linked Patient */}
          {lead.patient_id && (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Converted to Patient</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-xs"
                  onClick={() => navigate(`/patients/${lead.patient_id}`)}
                >
                  View Patient
                </Button>
              </div>
            </div>
          )}
          
          {/* Delete Lead */}
          <div className="pt-4 border-t">
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Lead
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="bg-white dark:bg-navy-900 border-b px-6">
            <TabsList className="h-12 bg-transparent border-0 p-0 gap-6">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="notes" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12"
              >
                Notes
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12"
              >
                Activity
              </TabsTrigger>
              <TabsTrigger 
                value="files" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12"
              >
                <FolderOpen className="w-4 h-4 mr-1" />
                Files
              </TabsTrigger>
              <TabsTrigger 
                value="doctor" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12"
                data-testid="lead-doctor-tab-trigger"
              >
                <Stethoscope className="w-4 h-4 mr-1" />
                Doctor
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 overflow-auto p-6">
            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Request Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Request Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">First Name</p>
                        <p className="font-medium">{lead.first_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Name</p>
                        <p className="font-medium">{lead.last_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{lead.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{lead.email || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <div className="mt-1">{getStatusBadge(lead.status)}</div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">ZIP Code</p>
                        <p className="font-medium">{lead.zip_code || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Source Information Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      Source Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Form Source</p>
                        <p className="font-medium capitalize">{lead.form_source || 'Direct'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Best Time to Call</p>
                        <p className="font-medium capitalize">{lead.best_time_to_call || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">UTM Source</p>
                        <p className="font-medium">{lead.utm_source || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">UTM Medium</p>
                        <p className="font-medium">{lead.utm_medium || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">UTM Campaign</p>
                        <p className="font-medium">{lead.utm_campaign || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Search className="w-3 h-3" />
                          Search Keywords
                        </p>
                        <p className="font-medium">{lead.utm_term || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          Referrer
                        </p>
                        <p className="font-medium truncate" title={lead.referrer || 'N/A'}>{lead.referrer || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="font-medium">{formatDate(lead.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Updated</p>
                        <p className="font-medium">{formatDate(lead.updated_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Form Responses Card */}
                {(lead.pain_location || lead.insurance_type || lead.has_doctor) && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Heart className="w-5 h-5" />
                        Form Responses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Pain Location</p>
                          <p className="font-medium capitalize">{lead.pain_location || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Insurance Type</p>
                          <p className="font-medium capitalize">{lead.insurance_type?.replace('_', ' ') || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Has Medicare</p>
                          <Badge className={lead.has_medicare === 'yes' || lead.insurance_type === 'medicare' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                            {lead.has_medicare === 'yes' || lead.insurance_type === 'medicare' ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Has Doctor</p>
                          <Badge className={lead.has_doctor === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                            {lead.has_doctor === 'yes' ? 'Yes' : lead.has_doctor === 'no' ? 'No' : 'N/A'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Rep Comments Card - Always visible on overview */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Rep Notes & Comments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Add Comment Input */}
                    <div className="flex gap-2 mb-4">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a note or comment..."
                        className="min-h-[80px] flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            handleAddComment();
                          }
                        }}
                      />
                      <Button 
                        onClick={handleAddComment} 
                        disabled={addingComment || !newComment.trim()}
                        className="self-end"
                      >
                        {addingComment ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">Press Ctrl+Enter to submit</p>
                    
                    {/* Comments List */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {comments.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8 italic">
                          No comments yet. Add a note above.
                        </p>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className="p-3 bg-muted/50 rounded-lg border">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-sm">{comment.created_by_name || 'Staff'}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</p>
                                </div>
                                <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Notes Tab */}
            <TabsContent value="notes" className="m-0 space-y-6">
              {/* Rep Comments Section - Also shown in Notes tab */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Rep Notes & Comments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Add Comment Input */}
                  <div className="flex gap-2 mb-4">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a note or comment..."
                      className="min-h-[80px] flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          handleAddComment();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleAddComment} 
                      disabled={addingComment || !newComment.trim()}
                      className="self-end"
                    >
                      {addingComment ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Press Ctrl+Enter to submit</p>
                  
                  {/* Comments List */}
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {comments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8 italic">
                        No comments yet. Add a note above.
                      </p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-sm">{comment.created_by_name || 'Staff'}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</p>
                              </div>
                              <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Request Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Request Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{lead.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{lead.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ZIP Code</p>
                      <p className="font-medium">{lead.zip_code || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pain Location</p>
                      <p className="font-medium capitalize">{lead.pain_location || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Insurance Type</p>
                      <p className="font-medium capitalize">{lead.insurance_type?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Has Doctor</p>
                      <p className="font-medium capitalize">{lead.has_doctor || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Best Time to Call</p>
                      <p className="font-medium capitalize">{lead.best_time_to_call || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Form Source</p>
                      <p className="font-medium capitalize">{lead.form_source || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className="capitalize">{lead.status?.replace('_', ' ')}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">{formatDate(lead.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Updated</p>
                      <p className="font-medium">{formatDate(lead.updated_at)}</p>
                    </div>
                  </div>
                  
                  {/* Original Notes field */}
                  {lead.notes && (
                    <div className="mt-6 pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Form Notes</p>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="whitespace-pre-wrap text-sm">{lead.notes}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Activity Tab */}
            <TabsContent value="activity" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Activity Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activityLog.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No activity recorded yet</p>
                  ) : (
                    <div className="space-y-4">
                      {activityLog.map((activity, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            activity.type === 'created' ? 'bg-blue-100 text-blue-600' :
                            activity.type === 'converted' ? 'bg-green-100 text-green-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {activity.type === 'created' ? <User className="w-4 h-4" /> :
                             activity.type === 'converted' ? <UserPlus className="w-4 h-4" /> :
                             <Edit className="w-4 h-4" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{activity.message}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(activity.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Files Tab */}
            <TabsContent value="files" className="m-0">
              <FileManager 
                entityType="leads" 
                entityId={leadId} 
                entityName={`${lead.first_name} ${lead.last_name}`}
              />
            </TabsContent>

            {/* Doctor Tab */}
            <TabsContent value="doctor" className="m-0">
              <LeadDoctorTab leadId={leadId} lead={lead} onSaved={fetchLeadData} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
      
      {/* Convert to Patient Dialog */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Lead to Patient</DialogTitle>
            <DialogDescription>
              Convert {lead.first_name} {lead.last_name} to a patient record
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConvert} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={convertData.date_of_birth}
                  onChange={(e) => setConvertData({ ...convertData, date_of_birth: e.target.value })}
                  required
                  data-testid="convert-dob-input"
                />
              </div>
              <div className="space-y-2">
                <Label>SSN (Last 4 digits)</Label>
                <Input
                  maxLength={4}
                  placeholder="1234"
                  value={convertData.ssn_last_four}
                  onChange={(e) => setConvertData({ ...convertData, ssn_last_four: e.target.value.replace(/\D/g, '') })}
                  required
                  data-testid="convert-ssn-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Insurance</Label>
                <Input
                  value={convertData.primary_insurance}
                  onChange={(e) => setConvertData({ ...convertData, primary_insurance: e.target.value })}
                  required
                  data-testid="convert-insurance-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Secondary Insurance</Label>
                <Input
                  value={convertData.secondary_insurance}
                  onChange={(e) => setConvertData({ ...convertData, secondary_insurance: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={convertData.address}
                onChange={(e) => setConvertData({ ...convertData, address: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsConvertOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="convert-submit-btn">
                <ArrowRight className="w-4 h-4 mr-2" />
                Convert to Patient
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Insurance Eligibility Check Modal */}
      <Dialog open={eligModalOpen} onOpenChange={setEligModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0055CC]" />
              Check Insurance Eligibility
            </DialogTitle>
            <DialogDescription>
              Run a real-time eligibility check for {lead?.first_name} {lead?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Service selector */}
            {isFeatureEnabled('availity_integration') && isFeatureEnabled('waystar_integration') && (
              <div className="flex gap-2">
                <button
                  onClick={() => setEligService('availity')}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${eligService === 'availity' ? 'bg-[#0055CC] text-white border-[#0055CC]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  data-testid="elig-service-availity"
                >Availity</button>
                <button
                  onClick={() => setEligService('waystar')}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${eligService === 'waystar' ? 'bg-[#0055CC] text-white border-[#0055CC]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  data-testid="elig-service-waystar"
                >Waystar</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Payer ID *</label>
                <Input
                  data-testid="elig-modal-payer-id"
                  placeholder="e.g. MCARE"
                  value={eligForm.payer_id}
                  onChange={e => setEligForm(f => ({ ...f, payer_id: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Member / Insurance ID *</label>
                <Input
                  data-testid="elig-modal-member-id"
                  placeholder="Insurance Member ID"
                  value={eligForm.member_id}
                  onChange={e => setEligForm(f => ({ ...f, member_id: e.target.value }))}
                />
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-0.5">
              <p><span className="font-medium text-gray-700">Patient:</span> {lead?.first_name} {lead?.last_name}</p>
              <p><span className="font-medium text-gray-700">DOB on file:</span> {lead?.date_of_birth || 'Not set'}</p>
            </div>
            {eligResult && (
              <div className={`rounded-lg border p-3 text-sm ${eligResult.error ? 'bg-red-50 border-red-200 text-red-700' : eligResult.eligible !== false ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                <p className="font-medium mb-1">{eligResult.error ? 'Check Failed' : eligResult.eligible !== false ? 'Eligible — Coverage Active' : 'Not Eligible'}</p>
                <pre className="text-xs overflow-auto max-h-32 bg-white/70 rounded p-2 text-gray-600">{JSON.stringify(eligResult, null, 2)}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEligModalOpen(false)}>Cancel</Button>
            <Button
              data-testid="elig-modal-run-btn"
              disabled={eligRunning || !eligForm.payer_id || !eligForm.member_id}
              onClick={async () => {
                setEligRunning(true);
                setEligResult(null);
                try {
                  const endpoint = eligService === 'availity' ? '/api/availity/eligibility/check' : '/api/waystar/eligibility/check';
                  const payload = eligService === 'availity'
                    ? { payer_id: eligForm.payer_id, member_id: eligForm.member_id, member_first_name: lead?.first_name, member_last_name: lead?.last_name, member_dob: lead?.date_of_birth, service_type_codes: ['DM'] }
                    : { payer_id: eligForm.payer_id, member_id: eligForm.member_id, first_name: lead?.first_name, last_name: lead?.last_name, date_of_birth: lead?.date_of_birth, service_type: eligForm.service_type };
                  const res = await axios.post(`${API_URL}${endpoint}`, payload, { headers: getHeaders() });
                  setEligResult(res.data);
                  // Update lead status to verifying_insurance and log activity
                  await axios.patch(`${API_URL}/api/leads/${lead.id}`, { status: 'verifying_insurance' }, { headers: getHeaders() });
                  toast.success('Eligibility check complete — status updated');
                } catch (err) {
                  const msg = err.response?.data?.detail || 'Check failed';
                  setEligResult({ error: true, message: msg });
                  toast.error(msg);
                } finally {
                  setEligRunning(false);
                }
              }}
              className="gap-2"
            >
              {eligRunning ? <><Loader2 className="w-4 h-4 animate-spin" />Checking...</> : <><ShieldCheck className="w-4 h-4" />Run Check</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Communication Button */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <button
          onClick={() => setShowVideoMeeting(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          data-testid="open-video-meeting-btn"
          title="Video Call"
        >
          <VideoIcon className="w-6 h-6" />
        </button>
        <button
          onClick={() => setShowCommPanel(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          data-testid="open-comm-panel-btn"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      </div>

      {/* Video Meeting Modal */}
      {showVideoMeeting && (
        <ScheduleMeetingModal
          isOpen={showVideoMeeting}
          onClose={() => setShowVideoMeeting(false)}
          onSuccess={(meeting) => window.open(`/video-room/${meeting.id}`, '_blank')}
          prefill={{
            title: `Call with ${lead?.first_name || ''} ${lead?.last_name || ''}`.trim(),
            lead_id: leadId,
            emails: lead?.email ? [lead.email] : [],
            phones: lead?.phone ? [lead.phone] : [],
          }}
        />
      )}

      {/* Communication Panel */}
      <CommunicationPanel
        isOpen={showCommPanel}
        onClose={() => setShowCommPanel(false)}
        contactType="lead"
        contactId={leadId}
        contactName={lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : ''}
        contactPhone={lead?.phone}
        contactEmail={lead?.email}
      />
    </div>
  );
}
