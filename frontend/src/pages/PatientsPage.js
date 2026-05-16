import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Users, 
  UserCheck, 
  Link,
  Filter,
  X,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Phone,
  Mail,
  Package,
  SlidersHorizontal,
  FileDown,
  ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PatientsPage() {
  const navigate = useNavigate();
  const { impersonateUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Advanced filters
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    insurance: '',
    phone: '',
    email: '',
    product: ''
  });
  
  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: 'last_name', direction: 'asc' });
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    ssn_last_four: '',
    primary_insurance: '',
    secondary_insurance: '',
    phone: '',
    email: '',
    address: ''
  });

  // Get unique insurance providers for filter dropdown
  const insuranceOptions = useMemo(() => {
    const insurances = new Set();
    patients.forEach(p => {
      if (p.primary_insurance) insurances.add(p.primary_insurance);
      if (p.secondary_insurance) insurances.add(p.secondary_insurance);
    });
    return Array.from(insurances).sort();
  }, [patients]);

  // Filter and sort patients
  const filteredPatients = useMemo(() => {
    let result = [...patients];
    
    // Text search (name, phone, email)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.first_name?.toLowerCase().includes(term) ||
        p.last_name?.toLowerCase().includes(term) ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(term) ||
        p.phone?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.primary_insurance?.toLowerCase().includes(term)
      );
    }
    
    // Date range filter (created_at)
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      result = result.filter(p => new Date(p.created_at) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(p => new Date(p.created_at) <= toDate);
    }
    
    // Insurance filter
    if (filters.insurance) {
      result = result.filter(p => 
        p.primary_insurance === filters.insurance || 
        p.secondary_insurance === filters.insurance
      );
    }
    
    // Phone filter
    if (filters.phone) {
      const phoneSearch = filters.phone.replace(/\D/g, '');
      result = result.filter(p => p.phone?.replace(/\D/g, '').includes(phoneSearch));
    }
    
    // Email filter
    if (filters.email) {
      result = result.filter(p => p.email?.toLowerCase().includes(filters.email.toLowerCase()));
    }
    
    // Product filter (searches in orders/products associated with patient)
    if (filters.product) {
      const productTerm = filters.product.toLowerCase();
      result = result.filter(p => 
        p.products?.some(prod => 
          prod.name?.toLowerCase().includes(productTerm) ||
          prod.sku?.toLowerCase().includes(productTerm)
        ) ||
        p.primary_insurance?.toLowerCase().includes(productTerm)
      );
    }
    
    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key] || '';
        let bVal = b[sortConfig.key] || '';
        
        // Handle nested name sorting
        if (sortConfig.key === 'name') {
          aVal = `${a.last_name} ${a.first_name}`.toLowerCase();
          bVal = `${b.last_name} ${b.first_name}`.toLowerCase();
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [patients, searchTerm, filters, sortConfig]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.insurance) count++;
    if (filters.phone) count++;
    if (filters.email) count++;
    if (filters.product) count++;
    return count;
  }, [filters]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" />
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      insurance: '',
      phone: '',
      email: '',
      product: ''
    });
    setSearchTerm('');
  };

  // Export filtered results to CSV
  const exportToCSV = () => {
    if (filteredPatients.length === 0) {
      toast.error('No patients to export');
      return;
    }
    
    const headers = ['First Name', 'Last Name', 'Date of Birth', 'Phone', 'Email', 'Primary Insurance', 'Secondary Insurance', 'Created Date'];
    const rows = filteredPatients.map(p => [
      p.first_name,
      p.last_name,
      p.date_of_birth,
      p.phone || '',
      p.email || '',
      p.primary_insurance,
      p.secondary_insurance || '',
      new Date(p.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success(`Exported ${filteredPatients.length} patients to CSV`);
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/patients`);
      setPatients(response.data);
    } catch (error) {
      toast.error('Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/patients`, formData);
      toast.success('Patient created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchPatients();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create patient');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/patients/${selectedPatient.id}`, formData);
      toast.success('Patient updated successfully');
      setIsEditOpen(false);
      resetForm();
      fetchPatients();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update patient');
    }
  };

  const handleDelete = async (patientId) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/patients/${patientId}`);
      toast.success('Patient deleted successfully');
      fetchPatients();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete patient');
    }
  };

  const openEditDialog = (patient) => {
    setSelectedPatient(patient);
    setFormData({
      first_name: patient.first_name,
      last_name: patient.last_name,
      date_of_birth: patient.date_of_birth,
      ssn_last_four: patient.ssn_last_four,
      primary_insurance: patient.primary_insurance,
      secondary_insurance: patient.secondary_insurance || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || ''
    });
    setIsEditOpen(true);
  };

  const openViewDialog = (patient) => {
    setSelectedPatient(patient);
    setIsViewOpen(true);
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      ssn_last_four: '',
      primary_insurance: '',
      secondary_insurance: '',
      phone: '',
      email: '',
      address: ''
    });
    setSelectedPatient(null);
  };

  const formatSSN = (ssn) => `***-**-${ssn}`;

  const handleImpersonate = async (patient) => {
    if (!patient.user_id) {
      toast.error('This patient does not have a user account to impersonate');
      return;
    }
    try {
      await impersonateUser(patient.user_id);
      toast.success(`Now viewing as ${patient.first_name} ${patient.last_name}`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to impersonate patient');
    }
  };

  const handleLinkUser = async (patient) => {
    if (!patient.email) {
      toast.error('Patient has no email address. Add an email first.');
      return;
    }
    try {
      const token = localStorage.getItem('dme_token');
      await axios.post(
        `${API_URL}/api/patients/${patient.id}/link-user`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Patient linked to user account');
      fetchPatients();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to link user account');
    }
  };

  return (
    <div data-testid="patients-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patients</h1>
          <p className="text-muted-foreground">Manage patient records with HIPAA compliance</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-patient-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl dialog-content">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
              <DialogDescription>Enter the patient&apos;s information below</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    data-testid="patient-firstname-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    data-testid="patient-lastname-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    required
                    data-testid="patient-dob-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssn">SSN (Last 4 digits)</Label>
                  <Input
                    id="ssn"
                    maxLength={4}
                    placeholder="1234"
                    value={formData.ssn_last_four}
                    onChange={(e) => setFormData({ ...formData, ssn_last_four: e.target.value.replace(/\D/g, '') })}
                    required
                    data-testid="patient-ssn-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_insurance">Primary Insurance</Label>
                  <Input
                    id="primary_insurance"
                    value={formData.primary_insurance}
                    onChange={(e) => setFormData({ ...formData, primary_insurance: e.target.value })}
                    required
                    data-testid="patient-insurance-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_insurance">Secondary Insurance (Optional)</Label>
                  <Input
                    id="secondary_insurance"
                    value={formData.secondary_insurance}
                    onChange={(e) => setFormData({ ...formData, secondary_insurance: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="patient-submit-btn">Create Patient</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Top row - Search, Filter button, Export */}
            <div className="flex items-center gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, email, insurance..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="patient-search-input"
                />
              </div>
              
              {/* Filter button */}
              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="filter-btn">
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Advanced Filters</h4>
                      {activeFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                          Clear all
                        </Button>
                      )}
                    </div>
                    
                    {/* Date range */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Date Range (Created)
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          placeholder="From"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                          className="text-sm"
                        />
                        <Input
                          type="date"
                          placeholder="To"
                          value={filters.dateTo}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* Insurance */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Insurance Provider</Label>
                      <Select
                        value={filters.insurance}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, insurance: value === 'all' ? '' : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All insurances" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All insurances</SelectItem>
                          {insuranceOptions.map(ins => (
                            <SelectItem key={ins} value={ins}>{ins}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Phone */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Phone Number
                      </Label>
                      <Input
                        placeholder="Filter by phone..."
                        value={filters.phone}
                        onChange={(e) => setFilters(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    
                    {/* Email */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email Address
                      </Label>
                      <Input
                        placeholder="Filter by email..."
                        value={filters.email}
                        onChange={(e) => setFilters(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    
                    {/* Product/Equipment */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Package className="w-3 h-3" /> Product/Equipment
                      </Label>
                      <Input
                        placeholder="Name or SKU..."
                        value={filters.product}
                        onChange={(e) => setFilters(prev => ({ ...prev, product: e.target.value }))}
                      />
                    </div>
                    
                    <Button 
                      className="w-full" 
                      onClick={() => setIsFilterOpen(false)}
                    >
                      Apply Filters
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Sort dropdown */}
              <Select
                value={`${sortConfig.key}-${sortConfig.direction}`}
                onValueChange={(value) => {
                  const [key, direction] = value.split('-');
                  setSortConfig({ key, direction });
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="last_name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="created_at-desc">Newest First</SelectItem>
                  <SelectItem value="created_at-asc">Oldest First</SelectItem>
                  <SelectItem value="date_of_birth-asc">DOB (Oldest)</SelectItem>
                  <SelectItem value="date_of_birth-desc">DOB (Youngest)</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Export button */}
              <Button 
                variant="outline" 
                onClick={exportToCSV}
                disabled={filteredPatients.length === 0}
                data-testid="export-patients-btn"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
            
            {/* Active filters display */}
            {(activeFilterCount > 0 || searchTerm) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="gap-1">
                    Search: "{searchTerm}"
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => setSearchTerm('')}
                    />
                  </Badge>
                )}
                {filters.dateFrom && (
                  <Badge variant="secondary" className="gap-1">
                    From: {filters.dateFrom}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ ...prev, dateFrom: '' }))}
                    />
                  </Badge>
                )}
                {filters.dateTo && (
                  <Badge variant="secondary" className="gap-1">
                    To: {filters.dateTo}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ ...prev, dateTo: '' }))}
                    />
                  </Badge>
                )}
                {filters.insurance && (
                  <Badge variant="secondary" className="gap-1">
                    Insurance: {filters.insurance}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ ...prev, insurance: '' }))}
                    />
                  </Badge>
                )}
                {filters.phone && (
                  <Badge variant="secondary" className="gap-1">
                    Phone: {filters.phone}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ ...prev, phone: '' }))}
                    />
                  </Badge>
                )}
                {filters.email && (
                  <Badge variant="secondary" className="gap-1">
                    Email: {filters.email}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ ...prev, email: '' }))}
                    />
                  </Badge>
                )}
                {filters.product && (
                  <Badge variant="secondary" className="gap-1">
                    Product: {filters.product}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ ...prev, product: '' }))}
                    />
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}
            
            {/* Results count */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {filteredPatients.length} of {patients.length} patients
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPatients && filteredPatients.length > 0 ? (
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('date_of_birth')}
                  >
                    <div className="flex items-center">
                      DOB
                      {getSortIcon('date_of_birth')}
                    </div>
                  </TableHead>
                  <TableHead>SSN</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('primary_insurance')}
                  >
                    <div className="flex items-center">
                      Primary Insurance
                      {getSortIcon('primary_insurance')}
                    </div>
                  </TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow 
                    key={patient.id} 
                    data-testid={`patient-row-${patient.id}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                  >
                    <TableCell className="font-medium">
                      {patient.first_name} {patient.last_name}
                    </TableCell>
                    <TableCell>{patient.date_of_birth}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatSSN(patient.ssn_last_four)}
                    </TableCell>
                    <TableCell>{patient.primary_insurance}</TableCell>
                    <TableCell>{patient.phone || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {patient.email || '-'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <TooltipProvider>
                        <div className="table-actions justify-end">
                          {patient.user_id ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleImpersonate(patient)}
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  data-testid={`impersonate-patient-${patient.id}`}
                                >
                                  <UserCheck className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View as Patient</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleLinkUser(patient)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  data-testid={`link-patient-${patient.id}`}
                                >
                                  <Link className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Link User Account</TooltipContent>
                            </Tooltip>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            data-testid={`view-patient-${patient.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(patient)}
                            data-testid={`edit-patient-${patient.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(patient.id)}
                            data-testid={`delete-patient-${patient.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state">
              <Users className="empty-state-icon" />
              <h3 className="font-semibold mb-1">No patients found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {(searchTerm || activeFilterCount > 0) 
                  ? 'Try adjusting your search or filters' 
                  : 'Get started by adding your first patient'}
              </p>
              {(searchTerm || activeFilterCount > 0) ? (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              ) : (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Patient
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl dialog-content">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>Update patient information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Primary Insurance</Label>
                <Input
                  value={formData.primary_insurance}
                  onChange={(e) => setFormData({ ...formData, primary_insurance: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Secondary Insurance</Label>
                <Input
                  value={formData.secondary_insurance}
                  onChange={(e) => setFormData({ ...formData, secondary_insurance: e.target.value })}
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
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
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

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{selectedPatient.date_of_birth}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">SSN (Last 4)</p>
                  <p className="font-medium font-mono">{formatSSN(selectedPatient.ssn_last_four)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Primary Insurance</p>
                  <p className="font-medium">{selectedPatient.primary_insurance}</p>
                </div>
              </div>
              {selectedPatient.secondary_insurance && (
                <div>
                  <p className="text-sm text-muted-foreground">Secondary Insurance</p>
                  <p className="font-medium">{selectedPatient.secondary_insurance}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedPatient.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedPatient.email || '-'}</p>
                </div>
              </div>
              {selectedPatient.address && (
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{selectedPatient.address}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
