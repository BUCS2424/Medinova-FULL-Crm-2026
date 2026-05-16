import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Phone,
  Send,
  Inbox,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Clock,
  FileText,
  User,
  Download,
  Printer,
  UserPlus,
  Eye,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Settings,
  AlertCircle,
  ExternalLink,
  Upload,
  File,
  X
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function FaxCenterPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('outgoing');
  const [faxSettings, setFaxSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const fileInputRef = useRef(null);
  
  // Outgoing fax state
  const [outgoingFaxes, setOutgoingFaxes] = useState([]);
  const [loadingOutgoing, setLoadingOutgoing] = useState(false);
  const [sendingFax, setSendingFax] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [faxForm, setFaxForm] = useState({
    recipientName: '',
    recipientFaxNumber: '',
    documentType: 'other',
    fileUrl: '',
    notes: '',
    patientId: '',
    orderId: ''
  });
  const [leadDoctorFaxOptions, setLeadDoctorFaxOptions] = useState([]);
  const [selectedLeadDoctorFaxKey, setSelectedLeadDoctorFaxKey] = useState('none');
  const [loadingLeadDoctors, setLoadingLeadDoctors] = useState(false);
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Incoming fax state
  const [incomingFaxes, setIncomingFaxes] = useState([]);
  const [loadingIncoming, setLoadingIncoming] = useState(false);
  const [selectedIncomingFax, setSelectedIncomingFax] = useState(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [patients, setPatients] = useState([]);
  const [assignTo, setAssignTo] = useState({ type: '', id: '' });

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  useEffect(() => {
    fetchFaxSettings();
    fetchOutgoingFaxes();
    fetchIncomingFaxes();
    fetchPatients();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const leadId = params.get('leadId');
    const leadName = params.get('leadName');
    const leadPhone = params.get('leadPhone');
    const leadEmail = params.get('leadEmail');
    const leadZip = params.get('leadZip');
    const leadStatus = params.get('leadStatus');
    const leadSource = params.get('leadSource');
    const leadNotes = params.get('leadNotes');

    if (!leadId) {
      setLeadDoctorFaxOptions([]);
      setSelectedLeadDoctorFaxKey('none');
      return;
    }

    const prefillNotes = [
      `Lead ID: ${leadId}`,
      leadPhone ? `Phone: ${leadPhone}` : null,
      leadEmail ? `Email: ${leadEmail}` : null,
      leadZip ? `ZIP: ${leadZip}` : null,
      leadStatus ? `Status: ${leadStatus}` : null,
      leadSource ? `Source: ${leadSource}` : null,
      leadNotes ? `Notes: ${leadNotes}` : null,
    ].filter(Boolean).join('\n');

    setFaxForm(prev => ({
      ...prev,
      recipientName: prev.recipientName || leadName || 'Lead Intake Team',
      notes: prev.notes || prefillNotes,
      patientId: prev.patientId || ''
    }));
    setShowSendDialog(true);
    toast.info('Lead details loaded for fax. Upload or attach a file, then send.');

    const fetchLinkedDoctorsForFax = async () => {
      setLoadingLeadDoctors(true);
      try {
        const leadResponse = await axios.get(`${API_URL}/api/leads/${leadId}`, { headers: getHeaders() });
        const doctorLinks = leadResponse.data?.doctor_links || [];

        const options = doctorLinks
          .filter((doctor) => doctor?.fax)
          .map((doctor, index) => {
            const doctorName = `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim() || 'Doctor';
            const optionKey = doctor.doctor_id || doctor.npi || `${leadId}-${index}`;
            return {
              key: optionKey,
              label: `Dr. ${doctorName}`,
              fax: doctor.fax,
              npi: doctor.npi || '',
              practice_name: doctor.practice_name || '',
            };
          });

        setLeadDoctorFaxOptions(options);
        if (options.length > 0) {
          const firstOption = options[0];
          setSelectedLeadDoctorFaxKey(firstOption.key);
          setFaxForm(prev => ({
            ...prev,
            recipientName: firstOption.label,
            recipientFaxNumber: firstOption.fax,
          }));
          toast.success(`Loaded ${options.length} linked doctor fax number${options.length > 1 ? 's' : ''}.`);
        }
      } catch (error) {
        console.error('Failed to fetch lead doctor fax options');
      } finally {
        setLoadingLeadDoctors(false);
      }
    };

    fetchLinkedDoctorsForFax();
  }, [location.search, getHeaders]);

  const fetchFaxSettings = async () => {
    setLoadingSettings(true);
    try {
      const response = await axios.get(`${API_URL}/api/fax/settings`, { headers: getHeaders() });
      setFaxSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch fax settings');
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchOutgoingFaxes = async () => {
    setLoadingOutgoing(true);
    try {
      const response = await axios.get(`${API_URL}/api/fax/history?limit=50`, { headers: getHeaders() });
      setOutgoingFaxes(response.data.faxes || []);
    } catch (error) {
      console.error('Failed to fetch outgoing faxes');
    } finally {
      setLoadingOutgoing(false);
    }
  };

  const fetchIncomingFaxes = async () => {
    setLoadingIncoming(true);
    try {
      const response = await axios.get(`${API_URL}/api/fax/incoming?limit=50`, { headers: getHeaders() });
      setIncomingFaxes(response.data.faxes || []);
    } catch (error) {
      console.error('Failed to fetch incoming faxes');
    } finally {
      setLoadingIncoming(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/patients?limit=100`, { headers: getHeaders() });
      setPatients(response.data.patients || response.data || []);
    } catch (error) {
      console.error('Failed to fetch patients');
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
        notes: faxForm.notes,
        patient_id: faxForm.patientId || null,
        order_id: faxForm.orderId || null
      }, { headers: getHeaders() });
      
      toast.success(`Fax queued! ID: ${response.data.fax_id}`);
      setFaxForm({
        recipientName: '',
        recipientFaxNumber: '',
        documentType: 'other',
        fileUrl: '',
        notes: '',
        patientId: '',
        orderId: ''
      });
      setUploadedFile(null);
      setShowSendDialog(false);
      fetchOutgoingFaxes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send fax');
    } finally {
      setSendingFax(false);
    }
  };

  // File upload handlers
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/tiff'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF, PNG, JPG, or TIFF file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API_URL}/api/fax/upload-secure`, formData, {
        headers: {
          ...getHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.file_url) {
        setUploadedFile({
          name: file.name,
          size: file.size,
          type: file.type,
          url: response.data.file_url,
          fileId: response.data.file_id,
          expiresIn: response.data.expires_in
        });
        setFaxForm(prev => ({ ...prev, fileUrl: response.data.file_url }));
        toast.success('Document uploaded securely');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    setFaxForm(prev => ({ ...prev, fileUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleRefreshOutgoingStatus = async (faxId) => {
    try {
      await axios.post(`${API_URL}/api/fax/refresh-status/${faxId}`, {}, { headers: getHeaders() });
      toast.success('Status refreshed');
      fetchOutgoingFaxes();
    } catch (error) {
      toast.error('Failed to refresh status');
    }
  };

  const handleAssignFax = async () => {
    if (!selectedIncomingFax || !assignTo.type) {
      toast.error('Please select where to assign this fax');
      return;
    }
    
    try {
      await axios.post(`${API_URL}/api/fax/incoming/${selectedIncomingFax.id}/assign`, {
        assign_type: assignTo.type,
        assign_id: assignTo.id || null
      }, { headers: getHeaders() });
      
      toast.success('Fax assigned successfully');
      setShowAssignDialog(false);
      setSelectedIncomingFax(null);
      setAssignTo({ type: '', id: '' });
      fetchIncomingFaxes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign fax');
    }
  };

  const handleDownloadFax = async (fax) => {
    if (!fax.media_url) {
      toast.error('No document available for download');
      return;
    }
    
    try {
      // Open the media URL in a new tab
      window.open(fax.media_url, '_blank');
    } catch (error) {
      toast.error('Failed to download fax');
    }
  };

  const handlePrintFax = (fax) => {
    if (!fax.media_url) {
      toast.error('No document available for print');
      return;
    }
    
    // Open in new window for printing
    const printWindow = window.open(fax.media_url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleDeleteIncomingFax = async (faxId) => {
    if (!window.confirm('Are you sure you want to delete this fax?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/fax/incoming/${faxId}`, { headers: getHeaders() });
      toast.success('Fax deleted');
      fetchIncomingFaxes();
    } catch (error) {
      toast.error('Failed to delete fax');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      queued: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      sending: { color: 'bg-blue-100 text-blue-800', icon: Send },
      delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle },
      received: { color: 'bg-purple-100 text-purple-800', icon: Inbox },
      unassigned: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
      assigned: { color: 'bg-green-100 text-green-800', icon: UserPlus }
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
    { value: 'prescription', label: 'Prescription' },
    { value: 'face_to_face', label: 'Face-to-Face Notes' },
    { value: 'other', label: 'Other' }
  ];

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConfigured = faxSettings?.is_configured && faxSettings?.is_enabled;

  return (
    <div className="space-y-6" data-testid="fax-center-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Phone className="w-8 h-8" />
            Fax Center
          </h1>
          <p className="text-muted-foreground mt-1">Send and receive HIPAA-compliant faxes</p>
        </div>
        <div className="flex items-center gap-3">
          {isConfigured ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Fax Service Active
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800">
              <XCircle className="w-3 h-3 mr-1" />
              Fax Not Configured
            </Badge>
          )}
          <Button 
            onClick={() => setShowSendDialog(true)} 
            disabled={!isConfigured}
            data-testid="new-fax-btn"
          >
            <Send className="w-4 h-4 mr-2" />
            New Fax
          </Button>
        </div>
      </div>

      {/* Not Configured Warning */}
      {!isConfigured && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertCircle className="w-8 h-8 text-orange-500" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-800">Fax Service Not Configured</h3>
              <p className="text-sm text-orange-700">
                Please configure your Telnyx API credentials in Dev Settings → Fax to start sending and receiving faxes.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.location.href = '/dev-settings'}>
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'outgoing' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('outgoing')}
          data-testid="outgoing-tab"
        >
          <ArrowUpRight className="w-4 h-4" />
          Outgoing Faxes
          <Badge variant="secondary" className="ml-1">{outgoingFaxes.length}</Badge>
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'incoming' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('incoming')}
          data-testid="incoming-tab"
        >
          <ArrowDownLeft className="w-4 h-4" />
          Incoming Faxes
          <Badge variant="secondary" className="ml-1">{incomingFaxes.length}</Badge>
          {incomingFaxes.filter(f => f.status === 'unassigned').length > 0 && (
            <Badge className="bg-orange-500 text-white ml-1">
              {incomingFaxes.filter(f => f.status === 'unassigned').length} new
            </Badge>
          )}
        </button>
      </div>

      {/* Outgoing Faxes Tab */}
      {activeTab === 'outgoing' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5" />
                Sent Faxes
              </CardTitle>
              <CardDescription>Track status of faxes you've sent</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchOutgoingFaxes} disabled={loadingOutgoing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingOutgoing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loadingOutgoing ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : outgoingFaxes.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">
                <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No faxes sent yet</p>
                <p className="text-sm">Click "New Fax" to send your first fax</p>
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
                      <th className="text-left p-3 font-medium">Sent</th>
                      <th className="text-left p-3 font-medium">Pages</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {outgoingFaxes.map((fax) => (
                      <tr key={fax.id} className="hover:bg-muted/30">
                        <td className="p-3">{getStatusBadge(fax.status)}</td>
                        <td className="p-3 font-medium">{fax.recipient_name}</td>
                        <td className="p-3 font-mono text-xs">{fax.recipient_fax_number}</td>
                        <td className="p-3 capitalize">{fax.document_type?.replace('_', ' ')}</td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {new Date(fax.created_at).toLocaleDateString()}{' '}
                          {new Date(fax.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3">{fax.page_count || '-'}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {fax.fax_id && fax.status !== 'delivered' && fax.status !== 'failed' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRefreshOutgoingStatus(fax.fax_id)}
                                title="Refresh status"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                            {fax.file_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(fax.file_url, '_blank')}
                                title="View document"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
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

      {/* Incoming Faxes Tab */}
      {activeTab === 'incoming' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5" />
                Received Faxes
              </CardTitle>
              <CardDescription>Manage faxes received from external sources</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchIncomingFaxes} disabled={loadingIncoming}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingIncoming ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loadingIncoming ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : incomingFaxes.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">
                <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No incoming faxes</p>
                <p className="text-sm">Incoming faxes will appear here when received</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">From</th>
                      <th className="text-left p-3 font-medium">Pages</th>
                      <th className="text-left p-3 font-medium">Received</th>
                      <th className="text-left p-3 font-medium">Assigned To</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {incomingFaxes.map((fax) => (
                      <tr key={fax.id} className={`hover:bg-muted/30 ${fax.status === 'unassigned' ? 'bg-orange-50' : ''}`}>
                        <td className="p-3">{getStatusBadge(fax.status)}</td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{fax.from_name || 'Unknown'}</p>
                            <p className="font-mono text-xs text-muted-foreground">{fax.from_number}</p>
                          </div>
                        </td>
                        <td className="p-3">{fax.page_count || '-'}</td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {new Date(fax.received_at).toLocaleDateString()}{' '}
                          {new Date(fax.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3">
                          {fax.assigned_to ? (
                            <span className="text-green-700">{fax.assigned_to_name || fax.assigned_to}</span>
                          ) : (
                            <span className="text-orange-600 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDownloadFax(fax)}
                              title="Download / Save"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handlePrintFax(fax)}
                              title="Print"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              onClick={() => {
                                setSelectedIncomingFax(fax);
                                setShowAssignDialog(true);
                              }}
                              title="Assign to patient"
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteIncomingFax(fax.id)}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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

      {/* Send Fax Dialog */}
      <Dialog open={showSendDialog} onOpenChange={(open) => {
        setShowSendDialog(open);
        if (!open) {
          setUploadedFile(null);
          setIsDragging(false);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send New Fax
            </DialogTitle>
            <DialogDescription>
              Send a HIPAA-compliant fax via Telnyx
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendFax} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recipient Name *</Label>
                <Input
                  placeholder="Dr. Smith's Office"
                  value={faxForm.recipientName}
                  onChange={(e) => setFaxForm(prev => ({ ...prev, recipientName: e.target.value }))}
                  required
                  data-testid="send-fax-recipient-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Fax Number *</Label>
                <Input
                  placeholder="+1 (555) 123-4567"
                  value={faxForm.recipientFaxNumber}
                  onChange={(e) => setFaxForm(prev => ({ ...prev, recipientFaxNumber: e.target.value }))}
                  required
                  data-testid="send-fax-number"
                />
              </div>
            </div>

            {leadDoctorFaxOptions.length > 0 && (
              <div className="space-y-2" data-testid="send-fax-linked-doctor-selector">
                <Label>Linked Doctor Fax Numbers</Label>
                <Select
                  value={selectedLeadDoctorFaxKey}
                  onValueChange={(value) => {
                    setSelectedLeadDoctorFaxKey(value);
                    if (value === 'none') return;
                    const option = leadDoctorFaxOptions.find((item) => item.key === value);
                    if (!option) return;
                    setFaxForm(prev => ({
                      ...prev,
                      recipientName: option.label,
                      recipientFaxNumber: option.fax,
                      notes: prev.notes || `NPI: ${option.npi}`
                    }));
                  }}
                >
                  <SelectTrigger data-testid="send-fax-linked-doctor-select-trigger">
                    <SelectValue placeholder="Select a linked doctor fax" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Manual Entry</SelectItem>
                    {leadDoctorFaxOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label} • {option.fax}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingLeadDoctors && (
                  <p className="text-xs text-muted-foreground" data-testid="send-fax-linked-doctor-loading-text">
                    Loading linked doctor fax numbers...
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select
                value={faxForm.documentType}
                onValueChange={(value) => setFaxForm(prev => ({ ...prev, documentType: value }))}
              >
                <SelectTrigger data-testid="send-fax-doc-type">
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

            {/* File Upload Section */}
            <div className="space-y-2">
              <Label>Document *</Label>
              
              {!uploadedFile ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="fax-dropzone"
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Uploading document...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        Drag & drop your document here
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="fax-upload-btn"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Browse Files
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.tiff"
                        onChange={handleFileInputChange}
                      />
                      <p className="text-xs text-muted-foreground mt-3">
                        Supported: PDF, PNG, JPG, TIFF (max 10MB)
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="p-2 bg-primary/10 rounded">
                    <File className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(uploadedFile.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={removeUploadedFile}
                    data-testid="fax-remove-file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Alternative: Direct URL Input */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or enter URL</span>
                </div>
              </div>
              
              <Input
                type="url"
                placeholder="https://example.com/document.pdf"
                value={uploadedFile ? '' : faxForm.fileUrl}
                onChange={(e) => {
                  setUploadedFile(null);
                  setFaxForm(prev => ({ ...prev, fileUrl: e.target.value }));
                }}
                disabled={!!uploadedFile}
                data-testid="send-fax-url"
              />
            </div>

            <div className="space-y-2">
              <Label>Link to Patient (Optional)</Label>
              <Select
                value={faxForm.patientId}
                onValueChange={(value) => setFaxForm(prev => ({ ...prev, patientId: value === 'none' ? '' : value }))}
              >
                <SelectTrigger data-testid="send-fax-patient">
                  <SelectValue placeholder="Select patient..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {patients.map(patient => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Additional context..."
                value={faxForm.notes}
                onChange={(e) => setFaxForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                data-testid="send-fax-notes"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSendDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendingFax} data-testid="send-fax-submit">
                {sendingFax ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Send Fax</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Fax Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Assign Fax
            </DialogTitle>
            <DialogDescription>
              Assign this incoming fax to a patient or mark for follow-up
            </DialogDescription>
          </DialogHeader>
          
          {selectedIncomingFax && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Fax from:</p>
                <p className="font-medium">{selectedIncomingFax.from_name || selectedIncomingFax.from_number}</p>
                <p className="text-xs text-muted-foreground">
                  Received: {new Date(selectedIncomingFax.received_at).toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select
                  value={assignTo.type}
                  onValueChange={(value) => setAssignTo({ type: value, id: '' })}
                >
                  <SelectTrigger data-testid="assign-type">
                    <SelectValue placeholder="Select assignment..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient">Assign to Patient</SelectItem>
                    <SelectItem value="general">General / Unassigned</SelectItem>
                    <SelectItem value="follow_up">Mark for Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {assignTo.type === 'patient' && (
                <div className="space-y-2">
                  <Label>Select Patient</Label>
                  <Select
                    value={assignTo.id}
                    onValueChange={(value) => setAssignTo(prev => ({ ...prev, id: value }))}
                  >
                    <SelectTrigger data-testid="assign-patient">
                      <SelectValue placeholder="Select patient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(patient => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.first_name} {patient.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAssignDialog(false);
              setSelectedIncomingFax(null);
              setAssignTo({ type: '', id: '' });
            }}>
              Cancel
            </Button>
            <Button onClick={handleAssignFax} disabled={!assignTo.type} data-testid="assign-submit">
              <CheckCircle className="w-4 h-4 mr-2" />
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
