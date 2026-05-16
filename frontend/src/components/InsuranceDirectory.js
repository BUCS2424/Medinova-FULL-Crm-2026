import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Search,
  Shield,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  Stethoscope,
  HeartPulse
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const INSURANCE_TYPES = [
  { value: 'medicare', label: 'Medicare', color: 'bg-blue-100 text-blue-700' },
  { value: 'medicaid', label: 'Medicaid', color: 'bg-green-100 text-green-700' },
  { value: 'commercial', label: 'Commercial', color: 'bg-purple-100 text-purple-700' },
  { value: 'private', label: 'Private', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'workers_comp', label: 'Workers Comp', color: 'bg-orange-100 text-orange-700' },
  { value: 'va', label: 'VA', color: 'bg-red-100 text-red-700' },
  { value: 'tricare', label: 'TRICARE', color: 'bg-lime-100 text-teal-700' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700' },
];

export default function InsuranceDirectory() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    insurance_type: 'commercial',
    payer_id: '',
    phone_main: '',
    phone_dme: '',
    phone_prior_auth: '',
    phone_claims: '',
    fax_number: '',
    email: '',
    website: '',
    address: '',
    dme_requirements: '',
    prior_auth_required: false,
    timely_filing_days: '',
    notes: '',
    is_active: true
  });

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('insurance_type', filterType);
      if (searchTerm) params.append('search', searchTerm);
      
      const res = await axios.get(`${API_URL}/api/insurance-companies?${params}`, { headers: getHeaders() });
      setCompanies(res.data || []);
    } catch (error) {
      toast.error('Failed to load insurance companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [filterType]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCompanies();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const resetForm = () => {
    setFormData({
      name: '',
      insurance_type: 'commercial',
      payer_id: '',
      phone_main: '',
      phone_dme: '',
      phone_prior_auth: '',
      phone_claims: '',
      fax_number: '',
      email: '',
      website: '',
      address: '',
      dme_requirements: '',
      prior_auth_required: false,
      timely_filing_days: '',
      notes: '',
      is_active: true
    });
    setEditingCompany(null);
  };

  const openEditDialog = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || '',
      insurance_type: company.insurance_type || 'commercial',
      payer_id: company.payer_id || '',
      phone_main: company.phone_main || '',
      phone_dme: company.phone_dme || '',
      phone_prior_auth: company.phone_prior_auth || '',
      phone_claims: company.phone_claims || '',
      fax_number: company.fax_number || '',
      email: company.email || '',
      website: company.website || '',
      address: company.address || '',
      dme_requirements: company.dme_requirements || '',
      prior_auth_required: company.prior_auth_required || false,
      timely_filing_days: company.timely_filing_days || '',
      notes: company.notes || '',
      is_active: company.is_active !== false
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Please enter a company name');
      return;
    }

    try {
      const payload = {
        ...formData,
        timely_filing_days: formData.timely_filing_days ? parseInt(formData.timely_filing_days) : null
      };

      if (editingCompany) {
        await axios.put(`${API_URL}/api/insurance-companies/${editingCompany.id}`, payload, { headers: getHeaders() });
        toast.success('Insurance company updated');
      } else {
        await axios.post(`${API_URL}/api/insurance-companies`, payload, { headers: getHeaders() });
        toast.success('Insurance company created');
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save insurance company');
    }
  };

  const handleDelete = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this insurance company?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/insurance-companies/${companyId}`, { headers: getHeaders() });
      toast.success('Insurance company deleted');
      fetchCompanies();
    } catch (error) {
      toast.error('Failed to delete insurance company');
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await axios.post(`${API_URL}/api/insurance-companies/seed-defaults`, {}, { headers: getHeaders() });
      toast.success(res.data.message);
      fetchCompanies();
    } catch (error) {
      toast.error('Failed to seed default companies');
    } finally {
      setSeeding(false);
    }
  };

  const getTypeStyle = (type) => {
    return INSURANCE_TYPES.find(t => t.value === type)?.color || 'bg-gray-100 text-gray-700';
  };

  const getTypeLabel = (type) => {
    return INSURANCE_TYPES.find(t => t.value === type)?.label || type;
  };

  const filteredCompanies = companies;

  if (loading && companies.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Insurance Directory
          </h2>
          <p className="text-muted-foreground">Manage insurance company contacts for DME billing</p>
        </div>
        <div className="flex items-center gap-2">
          {companies.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding}>
              {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Load Defaults
            </Button>
          )}
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} data-testid="add-insurance-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Insurance
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or payer ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="insurance-search"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {INSURANCE_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Companies List */}
      {filteredCompanies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold mb-2">No Insurance Companies Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterType !== 'all' 
                ? 'Try adjusting your search or filter'
                : 'Get started by adding insurance companies or loading defaults'}
            </p>
            {!searchTerm && filterType === 'all' && (
              <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding}>
                {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Load Medicare, Medicaid & Common Insurers
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCompanies.map((company) => (
            <Card key={company.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg truncate">{company.name}</h3>
                      <Badge className={getTypeStyle(company.insurance_type)}>
                        {getTypeLabel(company.insurance_type)}
                      </Badge>
                      {company.prior_auth_required && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Prior Auth
                        </Badge>
                      )}
                      {!company.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      {/* Contact Info */}
                      <div className="space-y-1">
                        {company.payer_id && (
                          <p className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Payer ID:</span> {company.payer_id}
                          </p>
                        )}
                        {company.phone_main && (
                          <p className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            Main: {company.phone_main}
                          </p>
                        )}
                        {company.phone_dme && (
                          <p className="flex items-center gap-1 text-blue-600 font-medium">
                            <Stethoscope className="w-3 h-3" />
                            DME Dept: {company.phone_dme}
                          </p>
                        )}
                      </div>

                      {/* Additional Phones */}
                      <div className="space-y-1">
                        {company.phone_prior_auth && (
                          <p className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            Prior Auth: {company.phone_prior_auth}
                          </p>
                        )}
                        {company.phone_claims && (
                          <p className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            Claims: {company.phone_claims}
                          </p>
                        )}
                        {company.fax_number && (
                          <p className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            Fax: {company.fax_number}
                          </p>
                        )}
                      </div>

                      {/* Requirements */}
                      <div className="space-y-1">
                        {company.timely_filing_days && (
                          <p className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            Filing: {company.timely_filing_days} days
                          </p>
                        )}
                        {company.website && (
                          <a 
                            href={company.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <Globe className="w-3 h-3" />
                            Website
                          </a>
                        )}
                      </div>
                    </div>

                    {company.dme_requirements && (
                      <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1">
                          <HeartPulse className="w-4 h-4" />
                          DME Requirements:
                        </p>
                        <p className="text-amber-700 dark:text-amber-300 mt-1">{company.dme_requirements}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedCompany(company); setIsViewOpen(true); }}>
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(company)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(company.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Edit Insurance Company' : 'Add Insurance Company'}</DialogTitle>
            <DialogDescription>
              {editingCompany ? 'Update insurance company information' : 'Add a new insurance company to the directory'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1 space-y-2">
                <Label>Company Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Medicare Part B"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Insurance Type *</Label>
                <Select
                  value={formData.insurance_type}
                  onValueChange={(val) => setFormData({ ...formData, insurance_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSURANCE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payer ID (EDI)</Label>
                <Input
                  value={formData.payer_id}
                  onChange={(e) => setFormData({ ...formData, payer_id: e.target.value })}
                  placeholder="e.g., 00882"
                />
              </div>
              <div className="space-y-2">
                <Label>Timely Filing (Days)</Label>
                <Input
                  type="number"
                  value={formData.timely_filing_days}
                  onChange={(e) => setFormData({ ...formData, timely_filing_days: e.target.value })}
                  placeholder="e.g., 365"
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Numbers
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Main Phone</Label>
                  <Input
                    value={formData.phone_main}
                    onChange={(e) => setFormData({ ...formData, phone_main: e.target.value })}
                    placeholder="1-800-XXX-XXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-blue-600 font-medium">DME Department</Label>
                  <Input
                    value={formData.phone_dme}
                    onChange={(e) => setFormData({ ...formData, phone_dme: e.target.value })}
                    placeholder="DME specific line"
                    className="border-blue-200 focus:border-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prior Authorization</Label>
                  <Input
                    value={formData.phone_prior_auth}
                    onChange={(e) => setFormData({ ...formData, phone_prior_auth: e.target.value })}
                    placeholder="Prior auth line"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Claims Department</Label>
                  <Input
                    value={formData.phone_claims}
                    onChange={(e) => setFormData({ ...formData, phone_claims: e.target.value })}
                    placeholder="Claims line"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fax Number</Label>
                <Input
                  value={formData.fax_number}
                  onChange={(e) => setFormData({ ...formData, fax_number: e.target.value })}
                  placeholder="Fax number"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@insurance.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Claims mailing address"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-amber-600 font-medium">DME Requirements</Label>
              <Textarea
                value={formData.dme_requirements}
                onChange={(e) => setFormData({ ...formData, dme_requirements: e.target.value })}
                placeholder="Special requirements for DME claims, prior authorization info, documentation needs..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes for staff..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.prior_auth_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, prior_auth_required: checked })}
                />
                <Label>Prior Authorization Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingCompany ? 'Save Changes' : 'Add Insurance Company'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedCompany?.name}</DialogTitle>
            <DialogDescription>Insurance company details</DialogDescription>
          </DialogHeader>
          
          {selectedCompany && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={getTypeStyle(selectedCompany.insurance_type)}>
                  {getTypeLabel(selectedCompany.insurance_type)}
                </Badge>
                {selectedCompany.prior_auth_required && (
                  <Badge variant="outline" className="text-amber-600">Prior Auth Required</Badge>
                )}
              </div>

              {selectedCompany.payer_id && (
                <div>
                  <Label className="text-muted-foreground">Payer ID</Label>
                  <p className="font-mono text-lg">{selectedCompany.payer_id}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedCompany.phone_main && (
                  <div>
                    <Label className="text-muted-foreground">Main Phone</Label>
                    <p>{selectedCompany.phone_main}</p>
                  </div>
                )}
                {selectedCompany.phone_dme && (
                  <div>
                    <Label className="text-blue-600">DME Department</Label>
                    <p className="font-medium">{selectedCompany.phone_dme}</p>
                  </div>
                )}
                {selectedCompany.phone_prior_auth && (
                  <div>
                    <Label className="text-muted-foreground">Prior Auth</Label>
                    <p>{selectedCompany.phone_prior_auth}</p>
                  </div>
                )}
                {selectedCompany.phone_claims && (
                  <div>
                    <Label className="text-muted-foreground">Claims</Label>
                    <p>{selectedCompany.phone_claims}</p>
                  </div>
                )}
              </div>

              {selectedCompany.timely_filing_days && (
                <div>
                  <Label className="text-muted-foreground">Timely Filing Limit</Label>
                  <p>{selectedCompany.timely_filing_days} days</p>
                </div>
              )}

              {selectedCompany.dme_requirements && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <Label className="text-amber-700 dark:text-amber-300">DME Requirements</Label>
                  <p className="mt-1 text-sm">{selectedCompany.dme_requirements}</p>
                </div>
              )}

              {selectedCompany.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm">{selectedCompany.notes}</p>
                </div>
              )}

              {selectedCompany.website && (
                <a 
                  href={selectedCompany.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  Visit Website
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
