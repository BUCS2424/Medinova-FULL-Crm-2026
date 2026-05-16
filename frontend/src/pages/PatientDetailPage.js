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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import FileManager from '../components/FileManager';
import DMEOrderForm from '../components/DMEOrderForm';
import CommunicationPanel from '../components/CommunicationPanel';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal';
import { PatientMedicalRecords } from '../components/PatientMedicalRecords';
import { PatientInsuranceCoverage } from '../components/PatientInsuranceCoverage';
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
  ShoppingCart,
  FileText,
  ClipboardList,
  Stethoscope,
  Package,
  CreditCard,
  Edit,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Home,
  Truck,
  History,
  Activity,
  Heart,
  Building2,
  MessageSquare,
  Send,
  Trash2,
  FolderOpen
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Textarea } from '../components/ui/textarea';
import PatientOnboardingTutorial from '../components/PatientOnboardingTutorial';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Click-to-call function - opens dialer popup with pre-filled number
const openDialerWithNumber = (phoneNumber, name, type = 'patient') => {
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

// Status badge colors
const getStatusBadge = (status) => {
  const statusConfig = {
    active: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Active' },
    inactive: { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Inactive' },
    pending: { color: 'bg-lime-100 text-lime-700 border-lime-200', label: 'Pending' },
    verified: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Verified' },
    unverified: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Unverified' },
  };
  const config = statusConfig[status] || statusConfig.pending;
  return <Badge className={`${config.color} border`}>{config.label}</Badge>;
};

// Order status colors
const getOrderStatusBadge = (status) => {
  const colors = {
    draft: 'bg-gray-100 text-gray-700',
    pending_approval: 'bg-lime-100 text-lime-700',
    approved: 'bg-blue-100 text-blue-700',
    verifying_insurance: 'bg-purple-100 text-purple-700',
    awaiting_prescription: 'bg-orange-100 text-orange-700',
    prescription_sent: 'bg-cyan-100 text-cyan-700',
    prescription_verified: 'bg-lime-100 text-teal-700',
    processing: 'bg-indigo-100 text-indigo-700',
    shipped: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return <Badge className={colors[status] || 'bg-gray-100 text-gray-700'}>{status?.replace(/_/g, ' ')}</Badge>;
};

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  // Patient data
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPatient, setEditedPatient] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Related data
  const [orders, setOrders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  
  // Notes state
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  
  // DME Order Form state
  const [isDMEFormOpen, setIsDMEFormOpen] = useState(false);
  
  // UI State
  const [activeTab, setActiveTab] = useState('demographics');
  const [contactOpen, setContactOpen] = useState(true);
  const [insuranceOpen, setInsuranceOpen] = useState(true);
  const [ordersOpen, setOrdersOpen] = useState(true);
  
  // Tutorial state (for patients)
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Communication panel state
  const [showCommPanel, setShowCommPanel] = useState(false);
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  
  // Filters
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };
  
  useEffect(() => {
    fetchPatientData();
  }, [patientId]);
  
  const fetchPatientData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      
      // Fetch patient details
      const patientRes = await axios.get(`${API_URL}/api/patients/${patientId}`, { headers });
      setPatient(patientRes.data);
      setEditedPatient(patientRes.data);
      
      // Fetch related orders
      try {
        const ordersRes = await axios.get(`${API_URL}/api/orders?patient_id=${patientId}`, { headers });
        setOrders(ordersRes.data || []);
      } catch (e) {
        console.log('No orders found');
        setOrders([]);
      }
      
      // Fetch documents (if endpoint exists)
      try {
        const docsRes = await axios.get(`${API_URL}/api/documents?patient_id=${patientId}`, { headers });
        setDocuments(docsRes.data || []);
      } catch (e) {
        setDocuments([]);
      }
      
      // Fetch patient notes
      try {
        const notesRes = await axios.get(`${API_URL}/api/patients/${patientId}/notes`, { headers });
        setNotes(notesRes.data || []);
        
        // Mark all notes as read for this patient when viewing
        if (notesRes.data && notesRes.data.length > 0) {
          for (const note of notesRes.data) {
            try {
              await axios.post(`${API_URL}/api/notifications/mark-read/${note.id}`, {}, { headers });
            } catch (e) {
              // Ignore errors for individual marks
            }
          }
        }
      } catch (e) {
        console.log('No notes found');
        setNotes([]);
      }
      
    } catch (error) {
      toast.error('Failed to load patient data');
      console.error(error);
    } finally {
      setLoading(false);
      
      // Check if patient should see tutorial (first login)
      if (currentUser?.role === 'patient') {
        const tutorialKey = `patient_tutorial_completed_${patientId}`;
        const tutorialCompleted = localStorage.getItem(tutorialKey);
        if (!tutorialCompleted) {
          // Small delay to let the page render first
          setTimeout(() => setShowTutorial(true), 500);
        }
      }
    }
  };
  
  const handleTutorialComplete = () => {
    const tutorialKey = `patient_tutorial_completed_${patientId}`;
    localStorage.setItem(tutorialKey, 'true');
    setShowTutorial(false);
  };
  
  const handleSavePatient = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/patients/${patientId}`, editedPatient, { headers: getHeaders() });
      setPatient(editedPatient);
      setIsEditing(false);
      toast.success('Patient updated successfully');
    } catch (error) {
      toast.error('Failed to update patient');
    } finally {
      setSaving(false);
    }
  };
  
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setAddingNote(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/patients/${patientId}/notes`,
        { content: newNote },
        { headers: getHeaders() }
      );
      setNotes([response.data, ...notes]);
      setNewNote('');
      toast.success('Note added successfully');
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };
  
  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    
    setDeletingNoteId(noteId);
    try {
      await axios.delete(`${API_URL}/api/patients/${patientId}/notes/${noteId}`, { headers: getHeaders() });
      setNotes(notes.filter(n => n.id !== noteId));
      toast.success('Note deleted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete note');
    } finally {
      setDeletingNoteId(null);
    }
  };
  
  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };
  
  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };
  
  // Handle DME order creation success
  const handleOrderCreated = (newOrder) => {
    setIsDMEFormOpen(false);
    // Refresh orders
    axios.get(`${API_URL}/api/orders?patient_id=${patientId}`, { headers: getHeaders() })
      .then(res => setOrders(res.data))
      .catch(err => console.error('Failed to refresh orders:', err));
    toast.success('DME Order created successfully! Prescription verification initiated.');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Patient not found</p>
        <Button onClick={() => navigate('/patients')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Patients
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950" data-testid="patient-detail-page">
      {/* Left Sidebar - Patient Info */}
      <div className="w-80 bg-white dark:bg-navy-900 border-r flex flex-col overflow-hidden">
        {/* Patient Header */}
        <div className="p-4 border-b">
          {/* Back button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-3 -ml-2"
            onClick={() => navigate('/patients')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Patients
          </Button>
          
          {/* Patient Avatar & Name */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-semibold">
              {getInitials(patient.first_name, patient.last_name)}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">
                {patient.first_name} {patient.last_name}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Age {calculateAge(patient.date_of_birth)}</span>
                <span>•</span>
                <span>DOB {formatDate(patient.date_of_birth)}</span>
              </div>
            </div>
          </div>
          
          {/* Status & Actions */}
          <div className="flex items-center gap-2 mt-3">
            {getStatusBadge(patient.status || 'active')}
            {patient.insurance_verified && (
              <Badge className="bg-green-100 text-green-700 border-green-200 border flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Insurance Verified
              </Badge>
            )}
          </div>
          
          {/* Edit/Save Buttons */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSavePatient} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setEditedPatient(patient); }}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit Patient
                </Button>
                {/* Tutorial button - visible to patients or for testing */}
                {(currentUser?.role === 'patient' || currentUser?.role === 'admin') && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setShowTutorial(true)}
                    className="text-primary"
                    data-testid="start-tutorial-btn"
                  >
                    <Activity className="w-4 h-4 mr-1" />
                    Tour
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Scrollable Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Contact Section */}
          <Collapsible open={contactOpen} onOpenChange={setContactOpen} data-tutorial="contact-section">
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
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input 
                      value={editedPatient.phone || ''} 
                      onChange={(e) => setEditedPatient({...editedPatient, phone: e.target.value})}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input 
                      value={editedPatient.email || ''} 
                      onChange={(e) => setEditedPatient({...editedPatient, email: e.target.value})}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <Input 
                      value={editedPatient.address || ''} 
                      onChange={(e) => setEditedPatient({...editedPatient, address: e.target.value})}
                      placeholder="123 Main St, City, State ZIP"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>{patient.address || 'No address on file'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{patient.phone || 'No phone on file'}</span>
                    {patient.phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => openDialerWithNumber(patient.phone, `${patient.first_name} ${patient.last_name}`, 'patient')}
                        title="Call this patient"
                        data-testid="call-patient-btn"
                      >
                        <PhoneOutgoing className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{patient.email || 'No email on file'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>Preferred: {patient.preferred_contact_time || 'Any time'}</span>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Insurance Section */}
          <Collapsible open={insuranceOpen} onOpenChange={setInsuranceOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
              <span className="font-semibold text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                INSURANCES
              </span>
              {insuranceOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              {isEditing ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Primary Insurance</Label>
                    <Input 
                      value={editedPatient.primary_insurance || ''} 
                      onChange={(e) => setEditedPatient({...editedPatient, primary_insurance: e.target.value})}
                      placeholder="Medicare Part B"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Secondary Insurance</Label>
                    <Input 
                      value={editedPatient.secondary_insurance || ''} 
                      onChange={(e) => setEditedPatient({...editedPatient, secondary_insurance: e.target.value})}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Medicare Number</Label>
                    <Input 
                      value={editedPatient.medicare_number || ''} 
                      onChange={(e) => setEditedPatient({...editedPatient, medicare_number: e.target.value})}
                      placeholder="1EG4-TE5-MK72"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Primary</span>
                      {patient.insurance_verified ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">Verified</Badge>
                      ) : (
                        <Badge className="bg-lime-100 text-lime-700 text-xs">Pending</Badge>
                      )}
                    </div>
                    <p className="font-medium">{patient.primary_insurance || 'Not specified'}</p>
                    {patient.medicare_number && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Medicare #: {patient.medicare_number}
                      </p>
                    )}
                  </div>
                  {patient.secondary_insurance && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Secondary</div>
                      <p className="font-medium">{patient.secondary_insurance}</p>
                    </div>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Active Orders Section */}
          <Collapsible open={ordersOpen} onOpenChange={setOrdersOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
              <span className="font-semibold text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                ACTIVE ORDERS
                <Badge variant="outline" className="ml-1">{orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length}</Badge>
              </span>
              {ordersOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No active orders</p>
              ) : (
                orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').slice(0, 5).map((order) => (
                  <div 
                    key={order.id} 
                    className="p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/80"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Order #{order.id?.slice(-6)}</span>
                      {getOrderStatusBadge(order.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.equipment_type || 'DME Equipment'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                ))
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => setIsDMEFormOpen(true)}
                data-testid="sidebar-new-order-btn"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create New Order
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Tabs */}
        <div className="bg-white dark:bg-navy-900 border-b px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-12 bg-transparent border-0 p-0 gap-1">
              <TabsTrigger 
                value="demographics" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-demographics"
              >
                <User className="w-4 h-4 mr-2" />
                Demographics
              </TabsTrigger>
              <TabsTrigger 
                value="medical" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-medical"
              >
                <Heart className="w-4 h-4 mr-2" />
                Medical Records
              </TabsTrigger>
              <TabsTrigger 
                value="insurance" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-insurance"
              >
                <Shield className="w-4 h-4 mr-2" />
                Insurance
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-documents"
              >
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </TabsTrigger>
              <TabsTrigger 
                value="prescriptions" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-prescriptions"
              >
                <Stethoscope className="w-4 h-4 mr-2" />
                Prescriptions
              </TabsTrigger>
              <TabsTrigger 
                value="items" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-items"
              >
                <Package className="w-4 h-4 mr-2" />
                Items
              </TabsTrigger>
              <TabsTrigger 
                value="orders" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-orders"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Orders
              </TabsTrigger>
              <TabsTrigger 
                value="notes" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-notes"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                Notes
              </TabsTrigger>
              <TabsTrigger 
                value="financial" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-financial"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Financial
              </TabsTrigger>
              <TabsTrigger 
                value="files" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                data-tutorial="tab-files"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Files
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Demographics Tab */}
          {activeTab === 'demographics' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Patient Demographics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground">PERSONAL INFORMATION</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">First Name</Label>
                        <p className="font-medium">{patient.first_name}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Last Name</Label>
                        <p className="font-medium">{patient.last_name}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                        <p className="font-medium">{formatDate(patient.date_of_birth)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Age</Label>
                        <p className="font-medium">{calculateAge(patient.date_of_birth)} years</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">SSN (Last 4)</Label>
                        <p className="font-medium">***-**-{patient.ssn_last_four || '****'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <div>{getStatusBadge(patient.status || 'active')}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground">CONTACT INFORMATION</h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Address</Label>
                        <p className="font-medium">{patient.address || 'Not specified'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Phone</Label>
                        <p className="font-medium">{patient.phone || 'Not specified'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <p className="font-medium">{patient.email || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-4">RECORD INFORMATION</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Patient ID</Label>
                      <p className="font-mono text-sm">{patient.id}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Created</Label>
                      <p className="text-sm">{formatDate(patient.created_at)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Last Updated</Label>
                      <p className="text-sm">{formatDate(patient.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Items Tab */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              {/* Sub-tabs for Items */}
              <div className="flex gap-2 border-b pb-2">
                <Button variant="default" size="sm">Current Inventory</Button>
                <Button variant="ghost" size="sm">Item History</Button>
                <Button variant="ghost" size="sm">Dropship History</Button>
              </div>
              
              {/* Filters */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search items..." className="pl-9" />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="purchased">Purchased</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" className="w-[150px]" placeholder="From" />
                <Input type="date" className="w-[150px]" placeholder="To" />
              </div>
              
              {/* Items Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Manufacturer</TableHead>
                        <TableHead>Part #</TableHead>
                        <TableHead>HCPCS</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Delivery Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No items found for this patient
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map((order, idx) => (
                          <TableRow key={order.id || idx}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-muted-foreground" />
                                {order.equipment_type || 'DME Equipment'}
                              </div>
                            </TableCell>
                            <TableCell>{order.manufacturer || 'Various'}</TableCell>
                            <TableCell className="font-mono text-sm">{order.part_number || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{order.hcpcs_code || 'E0601'}</TableCell>
                            <TableCell>{order.quantity || 1}</TableCell>
                            <TableCell>{formatDate(order.delivery_date || order.created_at)}</TableCell>
                            <TableCell>{getOrderStatusBadge(order.status)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <Truck className="w-4 h-4 mr-1" />
                                Delivery
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Order History</h3>
                <Button onClick={() => setIsDMEFormOpen(true)} data-testid="new-order-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  New Order
                </Button>
              </div>
              
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Prescription</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No orders found for this patient
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono">#{order.id?.slice(-8)}</TableCell>
                            <TableCell>{order.equipment_type || order.items?.[0]?.description || 'DME Equipment'}</TableCell>
                            <TableCell>{getOrderStatusBadge(order.status)}</TableCell>
                            <TableCell>{formatDate(order.created_at)}</TableCell>
                            <TableCell>
                              {order.prescription_status === 'verified' ? (
                                <Badge className="bg-green-100 text-green-700">Verified</Badge>
                              ) : order.prescription_status === 'signed' ? (
                                <Badge className="bg-blue-100 text-blue-700">Signed</Badge>
                              ) : order.prescription_status === 'sent' ? (
                                <Badge className="bg-lime-100 text-lime-700">Sent to Doctor</Badge>
                              ) : order.prescription_status === 'pending' ? (
                                <Badge className="bg-orange-100 text-orange-700">Pending Verification</Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-700">Not Sent</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/orders/${order.id}`)}>
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Insurance Tab */}
          {activeTab === 'insurance' && (
            <PatientInsuranceCoverage patientId={patientId} onSaved={fetchPatientData} />
          )}

          {/* Medical Records Tab */}
          {activeTab === 'medical' && (
            <PatientMedicalRecords patientId={patientId} onSaved={fetchPatientData} />
          )}
          
          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Patient Documents</h3>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </div>
              
              <Card>
                <CardContent className="p-6">
                  {documents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No documents uploaded yet</p>
                      <Button variant="outline" className="mt-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Upload First Document
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell>{doc.name}</TableCell>
                            <TableCell>{doc.type}</TableCell>
                            <TableCell>{formatDate(doc.created_at)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">View</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Add Note Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Add Note
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Type your note here... Notes are visible to both staff and the patient."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="min-h-[100px]"
                      data-testid="new-note-input"
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleAddNote} 
                        disabled={!newNote.trim() || addingNote}
                        data-testid="add-note-btn"
                      >
                        {addingNote ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Add Note
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Notes List */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Communication History
                    <Badge variant="outline" className="ml-2">{notes.length} notes</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-lg font-medium mb-1">No notes yet</p>
                      <p className="text-sm">Add a note above to start the communication</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {notes.map((note) => (
                        <div 
                          key={note.id} 
                          className={`p-4 rounded-lg border ${
                            note.created_by_role === 'patient' 
                              ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' 
                              : 'bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-slate-700'
                          }`}
                          data-testid={`note-${note.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-sm">{note.created_by_name}</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    note.created_by_role === 'patient' 
                                      ? 'bg-blue-100 text-blue-700 border-blue-300' 
                                      : note.created_by_role === 'admin'
                                      ? 'bg-purple-100 text-purple-700 border-purple-300'
                                      : 'bg-green-100 text-green-700 border-green-300'
                                  }`}
                                >
                                  {note.created_by_role === 'sales_rep' ? 'Sales Rep' : note.created_by_role}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDateTime(note.created_at)}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                            </div>
                            {currentUser && (currentUser.role === 'admin' || currentUser.email === 'mel@a2gdesigns.com') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive h-8 w-8"
                                onClick={() => handleDeleteNote(note.id)}
                                disabled={deletingNoteId === note.id}
                                data-testid={`delete-note-${note.id}`}
                              >
                                {deletingNoteId === note.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Other tabs show placeholder content */}
          {['prescriptions', 'financial'].includes(activeTab) && (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium mb-1">
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Section
                  </p>
                  <p className="text-sm">This section is ready for additional functionality</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Files Tab */}
          {activeTab === 'files' && (
            <FileManager 
              entityType="patients" 
              entityId={patientId} 
              entityName={`${patient.first_name} ${patient.last_name}`}
            />
          )}
        </div>
      </div>
      
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 shadow-lg"
          onClick={() => setIsDMEFormOpen(true)}
          data-testid="fab-new-order"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
      
      {/* DME Order Form Dialog */}
      <Dialog open={isDMEFormOpen} onOpenChange={setIsDMEFormOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0">
          <DMEOrderForm 
            patientId={patientId}
            patient={patient}
            onSuccess={handleOrderCreated}
            onCancel={() => setIsDMEFormOpen(false)}
            embedded={true}
          />
        </DialogContent>
      </Dialog>
      
      {/* Patient Onboarding Tutorial */}
      <PatientOnboardingTutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={handleTutorialComplete}
        onTabChange={setActiveTab}
      />

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
            title: `Call with ${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
            patient_id: patientId,
            emails: patient?.email ? [patient.email] : [],
            phones: patient?.phone ? [patient.phone] : [],
          }}
        />
      )}

      {/* Communication Panel */}
      <CommunicationPanel
        isOpen={showCommPanel}
        onClose={() => setShowCommPanel(false)}
        contactType="patient"
        contactId={patientId}
        contactName={patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : ''}
        contactPhone={patient?.phone}
        contactEmail={patient?.email}
      />
    </div>
  );
}
