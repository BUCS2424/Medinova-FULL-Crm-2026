import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PhoneCDRDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);
  const [period, setPeriod] = useState('day');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const [directionFilter, setDirectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadStats();
    loadCalls();
  }, [period]);

  useEffect(() => {
    loadCalls();
  }, [page, directionFilter, statusFilter]);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('dme_token');
      const response = await axios.get(`${API_URL}/api/voice/stats?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error('Failed to load phone statistics');
    }
  };

  const loadCalls = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('dme_token');
      
      let url = `${API_URL}/api/voice/calls/cdr?period=${period}&page=${page}&page_size=25`;
      if (directionFilter !== 'all') url += `&direction=${directionFilter}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCalls(response.data.calls || []);
      setTotalPages(response.data.total_pages || 1);
      setTotalCalls(response.data.total || 0);
    } catch (error) {
      console.error('Failed to load calls:', error);
      toast.error('Failed to load call records');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (number) => {
    if (!number) return 'Unknown';
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return number;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const getCallIcon = (direction, status) => {
    if (status === 'missed' || status === 'no_answer') {
      return <PhoneMissed className="w-4 h-4 text-red-500" />;
    }
    if (direction === 'inbound') {
      return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
    }
    return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
  };

  const getStatusBadge = (status) => {
    const variants = {
      completed: 'default',
      missed: 'destructive',
      no_answer: 'destructive',
      busy: 'secondary',
      failed: 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'day': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      default: return 'All Time';
    }
  };

  const filteredCalls = calls.filter(call => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (call.from_number && call.from_number.toLowerCase().includes(search)) ||
      (call.to_number && call.to_number.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="phone-dashboard-title">Phone Dashboard</h2>
          <p className="text-muted-foreground">Call logs and usage statistics</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]" data-testid="period-selector">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { loadStats(); loadCalls(); }} data-testid="refresh-btn">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats?.total_calls || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.inbound_calls || 0} inbound • {stats?.outbound_calls || 0} outbound
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span className="text-2xl font-bold">{stats?.total_minutes?.toFixed(1) || 0} min</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.inbound_minutes?.toFixed(1) || 0} in • {stats?.outbound_minutes?.toFixed(1) || 0} out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">{stats?.completed_calls || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.missed_calls || 0} missed calls
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(stats?.billing?.total_cost || 0)}
              </span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {getPeriodLabel()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CDR Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Call Detail Records</CardTitle>
              <CardDescription>{getPeriodLabel()} • {totalCalls} total calls</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={directionFilter} onValueChange={(v) => { setDirectionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Phone className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No call records found</p>
              <p className="text-sm">Make some calls to see them here!</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell>
                          {getCallIcon(call.direction, call.status)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatPhoneNumber(call.from_number)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatPhoneNumber(call.to_number)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(call.start_time)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDuration(call.duration_seconds)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(call.status)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(call.cost || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
