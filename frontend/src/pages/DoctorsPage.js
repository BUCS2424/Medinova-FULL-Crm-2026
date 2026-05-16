import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Plus, 
  Stethoscope, 
  Phone, 
  Mail, 
  MoreHorizontal,
  Edit,
  Trash2,
  Send,
  FileSignature,
  ExternalLink,
  Search,
  Building2,
  Hash,
  Clock,
  CheckCircle,
  AlertCircle,
  MapPin,
  Wand2,
  Loader2,
  Settings,
  Printer
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DoctorsPage({ embedded = false }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStatesOpen, setIsStatesOpen] = useState(false);
  const [isSendLinkOpen, setIsSendLinkOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  
  // US States for selection
  const [usStates, setUsStates] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [autoPopulating, setAutoPopulating] = useState(false);
  const [stateFilter, setStateFilter] = useState('all');
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    fax: '',
    npi: '',
    specialty: '',
    practice_name: '',
    state: '',
    password: ''
  });

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    fetchDoctors();
    fetchOrders();
    fetchUsStates();
    fetchDMEStates();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, { headers: getHeaders() });
      // Filter for doctors only
      const doctorUsers = response.data.filter(u => u.role === 'doctor');
      setDoctors(doctorUsers);
    } catch (error) {
      toast.error('Failed to fetch doctors');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders`, { headers: getHeaders() });
      setOrders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch orders');
    }
  };
  
  const fetchUsStates = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings/us-states`, { headers: getHeaders() });
      setUsStates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch US states');
    }
  };
  
  const fetchDMEStates = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings/dme-operating-states`, { headers: getHeaders() });
      setSelectedStates(response.data?.states || []);
    } catch (error) {
      console.error('Failed to fetch DME states');
    }
  };
  
  const handleSaveStates = async () => {
    try {
      await axios.post(`${API_URL}/api/settings/dme-operating-states`, {
        states: selectedStates,
        auto_populate_enabled: true
      }, { headers: getHeaders() });
      toast.success(`Saved ${selectedStates.length} operating states`);
      setIsStatesOpen(false);
    } catch (error) {
      toast.error('Failed to save states');
    }
  };
  
  const handleAutoPopulate = async () => {
    if (selectedStates.length === 0) {
      toast.error('Please select operating states first');
      setIsStatesOpen(true);
      return;
    }
    
    setAutoPopulating(true);
    try {
      // First save the states
      await axios.post(`${API_URL}/api/settings/dme-operating-states`, {
        states: selectedStates,
        auto_populate_enabled: true
      }, { headers: getHeaders() });
      
      // Then auto-populate doctors
      const response = await axios.post(`${API_URL}/api/doctors/auto-populate`, {}, { headers: getHeaders() });
      toast.success(response.data.message);
      fetchDoctors(); // Refresh the doctors list
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to auto-populate doctors');
    } finally {
      setAutoPopulating(false);
    }
  };
  
  const toggleState = (stateCode) => {
    setSelectedStates(prev => 
      prev.includes(stateCode) 
        ? prev.filter(s => s !== stateCode)
        : [...prev, stateCode]
    );
  };
  
  // Filter doctors by state and search
  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = searchQuery === '' || 
      `${doc.first_name} ${doc.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.npi?.includes(searchQuery);
    
    const matchesState = stateFilter === 'all' || doc.state === stateFilter;
    
    return matchesSearch && matchesState;
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/users`, {
        ...formData,
        role: 'doctor'
      }, { headers: getHeaders() });
      toast.success('Doctor added successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchDoctors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add doctor');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const updateData = { ...formData };
      delete updateData.password; // Don't update password on edit
      
      await axios.put(`${API_URL}/api/users/${selectedDoctor.id}`, updateData, { headers: getHeaders() });
      toast.success('Doctor updated successfully');
      setIsEditOpen(false);
      fetchDoctors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update doctor');
    }
  };

  const handleDelete = async (doctorId) => {
    if (!window.confirm('Are you sure you want to delete this doctor?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/users/${doctorId}`, { headers: getHeaders() });
      toast.success('Doctor deleted successfully');
      fetchDoctors();
    } catch (error) {
      toast.error('Failed to delete doctor');
    }
  };

  const handleSendMagicLink = async (orderId) => {
    try {
      await axios.post(`${API_URL}/api/doctor-portal/send-magic-link`, {
        doctor_id: selectedDoctor.id,
        order_id: orderId
      }, { headers: getHeaders() });
      toast.success('Magic link sent to doctor!');
      setIsSendLinkOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send magic link');
    }
  };

  const openEditDialog = (doctor) => {
    setSelectedDoctor(doctor);
    setFormData({
      first_name: doctor.first_name || '',
      last_name: doctor.last_name || '',
      email: doctor.email || '',
      phone: doctor.phone || '',
      fax: doctor.fax || '',
      npi: doctor.npi || '',
      specialty: doctor.specialty || '',
      practice_name: doctor.practice_name || '',
      password: ''
    });
    setIsEditOpen(true);
  };

  const openSendLinkDialog = (doctor) => {
    setSelectedDoctor(doctor);
    setIsSendLinkOpen(true);
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      fax: '',
      npi: '',
      specialty: '',
      practice_name: '',
      password: ''
    });
  };

  // Get pending orders for a doctor
  const getPendingOrdersForDoctor = (doctorId) => {
    return orders.filter(o => 
      o.prescriber_id === doctorId && 
      ['awaiting_prescription', 'prescription_sent'].includes(o.status)
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="doctors-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Stethoscope className="w-7 h-7" />
            Doctors
          </h1>
          <p className="text-muted-foreground">
            Manage prescribing doctors and send signature requests
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search doctors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          
          {/* State Filter */}
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[140px]">
              <MapPin className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {[...new Set(doctors.map(d => d.state).filter(Boolean))].sort().map(state => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Configure States Button */}
          <Button variant="outline" onClick={() => setIsStatesOpen(true)} data-testid="configure-states-btn">
            <Settings className="w-4 h-4 mr-2" />
            States ({selectedStates.length})
          </Button>
          
          {/* Auto-Populate Button */}
          <Button 
            variant="secondary" 
            onClick={handleAutoPopulate}
            disabled={autoPopulating}
            data-testid="auto-populate-btn"
          >
            {autoPopulating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Populating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Auto-Populate Doctors
              </>
            )}
          </Button>
          
          <Button onClick={() => setIsCreateOpen(true)} data-testid="add-doctor-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Doctor
          </Button>
        </div>
      </div>
      
      {/* Selected States Badge Display */}
      {selectedStates.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Operating in:</span>
          {selectedStates.map(state => (
            <Badge key={state} variant="secondary" className="gap-1">
              <MapPin className="w-3 h-3" />
              {state}
            </Badge>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{doctors.length}</p>
                <p className="text-xs text-muted-foreground">Total Doctors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-lime-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-lime-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {orders.filter(o => o.status === 'awaiting_prescription').length}
                </p>
                <p className="text-xs text-muted-foreground">Awaiting Signature</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {orders.filter(o => o.status === 'prescription_verified').length}
                </p>
                <p className="text-xs text-muted-foreground">Signed This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileSignature className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {orders.filter(o => o.status === 'prescription_sent').length}
                </p>
                <p className="text-xs text-muted-foreground">Links Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Doctors Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Doctors</CardTitle>
          <CardDescription>
            Click on a doctor to edit or send a magic link for document signing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Stethoscope className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No doctors found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try a different search term' : 'Add your first doctor to get started'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Doctor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>NPI</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Pending Orders</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDoctors.map((doctor) => {
                  const pendingOrders = getPendingOrdersForDoctor(doctor.id);
                  return (
                    <TableRow key={doctor.id} data-testid={`doctor-row-${doctor.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium">
                            {doctor.first_name?.charAt(0)}{doctor.last_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">
                              Dr. {doctor.first_name} {doctor.last_name}
                              {doctor.is_placeholder && (
                                <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                              )}
                            </p>
                            {doctor.practice_name && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {doctor.practice_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm flex items-center gap-1">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            {doctor.email}
                          </p>
                          {doctor.phone && (
                            <p className="text-sm flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {doctor.phone}
                            </p>
                          )}
                          {doctor.fax && (
                            <p className="text-sm flex items-center gap-1">
                              <Printer className="w-3 h-3 text-muted-foreground" />
                              {doctor.fax}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {doctor.state ? (
                          <Badge variant="secondary" className="gap-1">
                            <MapPin className="w-3 h-3" />
                            {doctor.state}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {doctor.npi ? (
                          <Badge variant="outline" className="font-mono">
                            <Hash className="w-3 h-3 mr-1" />
                            {doctor.npi}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {doctor.specialty || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {pendingOrders.length > 0 ? (
                          <Badge className="bg-lime-100 text-lime-700">
                            {pendingOrders.length} pending
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            None
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doctor.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(doctor)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Doctor
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSendLinkDialog(doctor)}>
                              <Send className="w-4 h-4 mr-2" />
                              Send Magic Link
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(doctor.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Doctor Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Doctor</DialogTitle>
            <DialogDescription>
              Add a prescribing doctor to the system
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label>Fax</Label>
                <Input
                  type="tel"
                  value={formData.fax}
                  onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                  placeholder="(555) 123-4568"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>NPI Number</Label>
                <Input
                  value={formData.npi}
                  onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                  placeholder="1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="e.g., Pain Management"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Practice Name</Label>
              <Input
                value={formData.practice_name}
                onChange={(e) => setFormData({ ...formData, practice_name: e.target.value })}
                placeholder="e.g., ABC Medical Group"
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="Min 8 characters"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Doctor</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Doctor Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
            <DialogDescription>
              Update doctor information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fax</Label>
                <Input
                  type="tel"
                  value={formData.fax}
                  onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>NPI Number</Label>
                <Input
                  value={formData.npi}
                  onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Practice Name</Label>
                <Input
                  value={formData.practice_name}
                  onChange={(e) => setFormData({ ...formData, practice_name: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send Magic Link Dialog */}
      <Dialog open={isSendLinkOpen} onOpenChange={setIsSendLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Magic Link</DialogTitle>
            <DialogDescription>
              Send a secure link to Dr. {selectedDoctor?.first_name} {selectedDoctor?.last_name} for document signing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Select an order to sign:</p>
              {orders.filter(o => 
                o.prescriber_id === selectedDoctor?.id && 
                ['awaiting_prescription', 'prescription_sent', 'pending_approval'].includes(o.status)
              ).length === 0 ? (
                <div className="text-center py-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No pending orders for this doctor</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {orders.filter(o => 
                    o.prescriber_id === selectedDoctor?.id && 
                    ['awaiting_prescription', 'prescription_sent', 'pending_approval'].includes(o.status)
                  ).map(order => (
                    <div 
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-navy-800 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">Order #{order.id?.slice(-6)}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.equipment_type || 'DME Equipment'} • {formatDate(order.created_at)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => handleSendMagicLink(order.id)}>
                        <Send className="w-3 h-3 mr-1" />
                        Send Link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 bg-lime-50 dark:bg-amber-950 rounded-lg border border-lime-200 dark:border-lime-800">
              <p className="text-xs text-lime-700 dark:text-amber-300">
                <strong>Note:</strong> The magic link will be sent via SMS to the doctor's phone number. 
                They will also receive a 6-digit verification code for 2FA.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendLinkOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Configure Operating States Dialog */}
      <Dialog open={isStatesOpen} onOpenChange={setIsStatesOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Configure DME Operating States
            </DialogTitle>
            <DialogDescription>
              Select the states where your DME company operates. The Auto-Populate feature will create sample doctors for these states.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Quick select buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedStates(usStates.map(s => s.code))}
              >
                Select All
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedStates([])}
              >
                Clear All
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedStates(['VA', 'NC', 'SC', 'MD', 'DC', 'WV'])}
              >
                Mid-Atlantic
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedStates(['FL', 'GA', 'AL', 'TN', 'SC', 'NC'])}
              >
                Southeast
              </Button>
            </div>
            
            {/* States grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto p-2 border rounded-lg">
              {usStates.map(state => (
                <label
                  key={state.code}
                  className={`
                    flex items-center gap-2 p-2 rounded cursor-pointer border transition-colors
                    ${selectedStates.includes(state.code) 
                      ? 'bg-primary/10 border-primary' 
                      : 'hover:bg-muted border-transparent'}
                  `}
                >
                  <Checkbox 
                    checked={selectedStates.includes(state.code)}
                    onCheckedChange={() => toggleState(state.code)}
                  />
                  <span className="text-sm font-medium">{state.code}</span>
                </label>
              ))}
            </div>
            
            {/* Selected count */}
            <div className="text-sm text-muted-foreground">
              {selectedStates.length} states selected
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStates}>
              Save States
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
