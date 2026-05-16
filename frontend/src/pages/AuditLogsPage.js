import { useState, useEffect } from 'react';
import axios from 'axios';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { Shield, Search, User, FileText, Clock } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RESOURCE_TYPES = [
  { value: 'all', label: 'All Resources' },
  { value: 'patients', label: 'Patients' },
  { value: 'leads', label: 'Patient Requests' },
  { value: 'orders', label: 'Orders' },
  { value: 'users', label: 'Users' },
  { value: 'documents', label: 'Documents' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'auth', label: 'Authentication' }
];

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'PATIENT_VIEWED', label: 'Patient Viewed' },
  { value: 'PATIENT_CREATED', label: 'Patient Created' },
  { value: 'PATIENT_UPDATED', label: 'Patient Updated' },
  { value: 'PATIENT_DELETED', label: 'Patient Deleted' },
  { value: 'PATIENTS_VIEWED', label: 'Patients List Viewed' },
  { value: 'LEAD_CREATED', label: 'Lead Created' },
  { value: 'LEAD_UPDATED', label: 'Lead Updated' },
  { value: 'LEAD_CONVERTED_TO_PATIENT', label: 'Lead Converted' },
  { value: 'ORDER_CREATED', label: 'Order Created' },
  { value: 'ORDER_UPDATED', label: 'Order Updated' },
  { value: 'USER_LOGIN', label: 'User Login' },
  { value: 'USER_REGISTERED', label: 'User Registered' }
];

export default function AuditLogsPage({ embedded = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    resource_type: 'all',
    action: 'all',
    user_id: ''
  });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      const params = {};
      if (filters.resource_type && filters.resource_type !== 'all') params.resource_type = filters.resource_type;
      if (filters.action && filters.action !== 'all') params.action = filters.action;
      if (filters.user_id) params.user_id = filters.user_id;
      
      const response = await axios.get(`${API_URL}/api/audit-logs`, { params });
      setLogs(response.data);
    } catch (error) {
      toast.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionBadgeClass = (action) => {
    if (action.includes('VIEWED')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    if (action.includes('CREATED')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (action.includes('UPDATED')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (action.includes('DELETED')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    if (action.includes('LOGIN')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    if (action.includes('CONVERTED')) return 'bg-lime-100 text-teal-800 dark:bg-lime-900/30 dark:text-lime-400';
    return 'bg-slate-100 text-navy-700 dark:bg-navy-800 dark:text-slate-300';
  };

  return (
    <div data-testid="audit-logs-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">HIPAA-compliant activity tracking for all patient data access</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">HIPAA Compliant</span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Resource Type</label>
              <Select
                value={filters.resource_type}
                onValueChange={(value) => setFilters({ ...filters, resource_type: value })}
              >
                <SelectTrigger data-testid="filter-resource-type">
                  <SelectValue placeholder="All Resources" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Action</label>
              <Select
                value={filters.action}
                onValueChange={(value) => setFilters({ ...filters, action: value })}
              >
                <SelectTrigger data-testid="filter-action">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">User ID</label>
              <div className="search-input-wrapper">
                <Search />
                <Input
                  placeholder="Filter by user ID..."
                  value={filters.user_id}
                  onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                  className="pl-10"
                  data-testid="filter-user-id"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Resource ID</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} data-testid={`audit-log-${log.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{log.user_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getActionBadgeClass(log.action)} text-xs`}>
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.resource_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.resource_id ? `${log.resource_id.slice(0, 8)}...` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {log.ip_address || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state">
              <FileText className="empty-state-icon" />
              <h3 className="font-semibold mb-1">No audit logs found</h3>
              <p className="text-sm text-muted-foreground">
                {(filters.resource_type !== 'all') || (filters.action !== 'all') || filters.user_id
                  ? 'Try adjusting your filters'
                  : 'Activity will be logged here as users interact with the system'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">HIPAA Audit Trail</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                All patient data access is automatically logged with timestamps and user identification. 
                This includes viewing, creating, editing, and deleting patient records to ensure 
                compliance with HIPAA Security Rule requirements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
