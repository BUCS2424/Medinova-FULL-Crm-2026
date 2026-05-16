import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, 
  Search, 
  Download, 
  Eye, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Globe, 
  Monitor, 
  FileText,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  AlertTriangle,
  Calendar,
  MapPin,
  Loader2,
  ExternalLink,
  MessageSquare,
  PhoneCall,
  History,
  Fingerprint,
  Scale
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ConsentAuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [auditTrail, setAuditTrail] = useState(null);
  const [auditTrailLoading, setAuditTrailLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState(null);
  const limit = 25;

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [page, filterType]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * limit;
      const response = await axios.get(`${API_URL}/api/consent/records`, {
        params: { limit, skip },
        headers: getHeaders()
      });
      setRecords(response.data.records || []);
      setTotalRecords(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch consent records:', error);
      toast.error('Failed to load consent records');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Calculate stats from records
      const response = await axios.get(`${API_URL}/api/consent/records`, {
        params: { limit: 1000 },
        headers: getHeaders()
      });
      const allRecords = response.data.records || [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisWeek = new Date(today);
      thisWeek.setDate(thisWeek.getDate() - 7);
      const thisMonth = new Date(today);
      thisMonth.setMonth(thisMonth.getMonth() - 1);

      setStats({
        total: response.data.total || 0,
        today: allRecords.filter(r => new Date(r.timestamp) >= today).length,
        thisWeek: allRecords.filter(r => new Date(r.timestamp) >= thisWeek).length,
        thisMonth: allRecords.filter(r => new Date(r.timestamp) >= thisMonth).length,
        withSignature: allRecords.filter(r => r.electronic_signature).length,
        withTcpa: allRecords.filter(r => r.consent_tcpa).length,
        withSms: allRecords.filter(r => r.consent_sms).length
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchAuditTrail = async (leadId) => {
    setAuditTrailLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/consent/audit-trail/${leadId}`, {
        headers: getHeaders()
      });
      setAuditTrail(response.data);
    } catch (error) {
      console.error('Failed to fetch audit trail:', error);
      toast.error('Failed to load audit trail');
    } finally {
      setAuditTrailLoading(false);
    }
  };

  const openRecordDetail = (record) => {
    setSelectedRecord(record);
    setDetailModalOpen(true);
    if (record.lead_id) {
      fetchAuditTrail(record.lead_id);
    }
  };

  const exportRecords = () => {
    // Create CSV export
    const headers = [
      'Timestamp', 'Lead ID', 'Name', 'Phone', 'Email', 'IP Address',
      'Consent Contact', 'Consent HIPAA', 'Consent Insurance', 'Consent SMS', 'Consent TCPA',
      'Electronic Signature', 'User Agent', 'Form Type'
    ];
    
    const csvRows = [headers.join(',')];
    
    records.forEach(record => {
      const row = [
        record.timestamp,
        record.lead_id,
        `"${record.contact_name || ''}"`,
        record.contact_phone || '',
        record.contact_email || '',
        record.ip_address || '',
        record.consent_contact ? 'Yes' : 'No',
        record.consent_hipaa ? 'Yes' : 'No',
        record.consent_insurance ? 'Yes' : 'No',
        record.consent_sms ? 'Yes' : 'No',
        record.consent_tcpa ? 'Yes' : 'No',
        `"${record.electronic_signature || ''}"`,
        `"${(record.user_agent || '').substring(0, 50)}"`,
        record.form_type || ''
      ];
      csvRows.push(row.join(','));
    });
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consent_records_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Consent records exported');
  };

  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (record.contact_name || '').toLowerCase().includes(search) ||
      (record.contact_phone || '').includes(search) ||
      (record.contact_email || '').toLowerCase().includes(search) ||
      (record.lead_id || '').toLowerCase().includes(search) ||
      (record.ip_address || '').includes(search)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const ConsentBadge = ({ consented, label }) => (
    <Badge 
      variant={consented ? "default" : "secondary"}
      className={`text-xs ${consented ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600'}`}
    >
      {consented ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="consent-audit-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-7 h-7 text-blue-600" />
            TCPA Consent Audit Trail
          </h1>
          <p className="text-muted-foreground mt-1">
            View and audit all consent records for compliance purposes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchRecords} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportRecords} disabled={records.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.total}</p>
              <p className="text-xs text-blue-600 dark:text-blue-500">Total Records</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.today}</p>
              <p className="text-xs text-green-600 dark:text-green-500">Today</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-lime-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-lime-700 dark:text-lime-400">{stats.thisWeek}</p>
              <p className="text-xs text-lime-600 dark:text-lime-500">This Week</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{stats.thisMonth}</p>
              <p className="text-xs text-purple-600 dark:text-purple-500">This Month</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{stats.withSignature}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-500">With Signature</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 border-cyan-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">{stats.withTcpa}</p>
              <p className="text-xs text-cyan-600 dark:text-cyan-500">TCPA Consent</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border-pink-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-pink-700 dark:text-pink-400">{stats.withSms}</p>
              <p className="text-xs text-pink-600 dark:text-pink-500">SMS Consent</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, email, lead ID, or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="with_signature">With Signature</SelectItem>
                <SelectItem value="with_tcpa">TCPA Consent</SelectItem>
                <SelectItem value="with_sms">SMS Consent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Consent Records</CardTitle>
          <CardDescription>
            {totalRecords} total records • Showing {filteredRecords.length} of {records.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No consent records found</p>
              <p className="text-sm text-muted-foreground mt-1">Records will appear here when leads submit forms</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-sm">Date/Time</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Contact</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">IP Address</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Consents</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Signature</th>
                    <th className="text-right py-3 px-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{new Date(record.timestamp).toLocaleDateString()}</p>
                            <p className="text-xs text-muted-foreground">{new Date(record.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-sm">{record.contact_name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{record.contact_phone}</p>
                          {record.contact_email && (
                            <p className="text-xs text-muted-foreground">{record.contact_email}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-mono">{record.ip_address || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {record.consent_contact && <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Contact</Badge>}
                          {record.consent_hipaa && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">HIPAA</Badge>}
                          {record.consent_tcpa && <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">TCPA</Badge>}
                          {record.consent_sms && <Badge variant="outline" className="text-xs bg-pink-50 text-pink-700 border-pink-200">SMS</Badge>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {record.electronic_signature ? (
                          <div className="flex items-center gap-1">
                            <Fingerprint className="w-4 h-4 text-green-600" />
                            <span className="text-sm italic">"{record.electronic_signature}"</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRecordDetail(record)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {record.lead_id && (
                            <Link to={`/leads/${record.lead_id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalRecords > limit && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(totalRecords / limit)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalRecords / limit)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Consent Record Details
            </DialogTitle>
            <DialogDescription>
              Complete audit trail for this consent record
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecord && (
            <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="consents">Consents</TabsTrigger>
                <TabsTrigger value="technical">Technical</TabsTrigger>
                <TabsTrigger value="audit">Audit Trail</TabsTrigger>
              </TabsList>
              
              <ScrollArea className="flex-1 mt-4">
                <TabsContent value="details" className="mt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Name</p>
                          <p className="font-medium">{selectedRecord.contact_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="font-medium">{selectedRecord.contact_phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="font-medium">{selectedRecord.contact_email || 'N/A'}</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Timestamp Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Submission Time</p>
                          <p className="font-medium">{formatDate(selectedRecord.timestamp)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Timezone</p>
                          <p className="font-medium">{selectedRecord.timezone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Consent Version</p>
                          <p className="font-medium">{selectedRecord.consent_version || '1.0'}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {selectedRecord.electronic_signature && (
                    <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                          <Fingerprint className="w-4 h-4" />
                          Electronic Signature
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl italic font-serif">"{selectedRecord.electronic_signature}"</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Signed at: {formatDate(selectedRecord.signature_timestamp || selectedRecord.timestamp)}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="consents" className="mt-0 space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: 'consent_contact', label: 'Consent to Contact', desc: 'Permission to contact via phone, text, or email' },
                      { key: 'consent_hipaa', label: 'HIPAA / PHI Permission', desc: 'Authorization to share health information' },
                      { key: 'consent_insurance', label: 'Insurance Understanding', desc: 'Acknowledgment of insurance coverage terms' },
                      { key: 'consent_sms', label: 'SMS Consent', desc: 'Permission to receive SMS text messages' },
                      { key: 'consent_tcpa', label: 'TCPA Consent', desc: 'Express written consent under TCPA' }
                    ].map(consent => (
                      <Card key={consent.key} className={selectedRecord[consent.key] ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-gray-200'}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{consent.label}</p>
                            <p className="text-xs text-muted-foreground">{consent.desc}</p>
                          </div>
                          {selectedRecord[consent.key] ? (
                            <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> AGREED</Badge>
                          ) : (
                            <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" /> Not Checked</Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {selectedRecord.consent_language && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Consent Language Displayed</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-lg max-h-60 overflow-y-auto">
                          {selectedRecord.consent_language}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="technical" className="mt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Network Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">IP Address</p>
                          <p className="font-mono text-sm">{selectedRecord.ip_address || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Referrer</p>
                          <p className="font-mono text-sm break-all">{selectedRecord.referrer || 'Direct'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Landing Page</p>
                          <p className="font-mono text-sm break-all">{selectedRecord.landing_page || 'N/A'}</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Monitor className="w-4 h-4" />
                          Device Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Screen Resolution</p>
                          <p className="font-mono text-sm">{selectedRecord.screen_resolution || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">User Agent</p>
                          <p className="font-mono text-xs break-all">{selectedRecord.user_agent || 'N/A'}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Record Metadata
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Record ID</p>
                          <p className="font-mono text-xs">{selectedRecord.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Lead ID</p>
                          <p className="font-mono text-xs">{selectedRecord.lead_id || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Form Type</p>
                          <p className="text-sm">{selectedRecord.form_type || 'website'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Retention Period</p>
                        <Badge variant="outline">{selectedRecord.retention_period || 'Permanent'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="audit" className="mt-0">
                  {auditTrailLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : auditTrail ? (
                    <div className="space-y-4">
                      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{auditTrail.lead_name}</p>
                              <p className="text-sm text-muted-foreground">{auditTrail.lead_phone} • {auditTrail.lead_email}</p>
                            </div>
                            <Badge>{auditTrail.total_events} Events</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-2">
                        {auditTrail.audit_trail?.map((event, idx) => (
                          <Card key={idx} className="border-l-4 border-l-blue-500">
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${
                                  event.event_type === 'consent_captured' ? 'bg-green-100 text-green-600' :
                                  event.event_type === 'communication' ? 'bg-blue-100 text-blue-600' :
                                  event.event_type === 'call' ? 'bg-purple-100 text-purple-600' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {event.event_type === 'consent_captured' ? <Shield className="w-4 h-4" /> :
                                   event.event_type === 'communication' ? <MessageSquare className="w-4 h-4" /> :
                                   event.event_type === 'call' ? <PhoneCall className="w-4 h-4" /> :
                                   <History className="w-4 h-4" />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium text-sm capitalize">
                                      {event.event_type?.replace('_', ' ') || event.action || 'Event'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(event.timestamp || event.created_at || event.started_at)}
                                    </p>
                                  </div>
                                  {event.ip_address && (
                                    <p className="text-xs text-muted-foreground">IP: {event.ip_address}</p>
                                  )}
                                  {event.message && (
                                    <p className="text-sm text-muted-foreground mt-1">{event.message}</p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No audit trail available</p>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
