import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import {
  Users,
  UserPlus,
  ClipboardList,
  Building2,
  TrendingUp,
  ArrowRight,
  Clock,
  DollarSign,
  Calendar,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Custom tooltip for the sales chart
const SalesTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-navy-800 p-3 rounded-lg shadow-lg border">
        <p className="font-medium">{data.date}</p>
        <p className="text-green-600 font-bold">
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(payload[0].value)}
        </p>
        <p className="text-xs text-muted-foreground">{data.orders} orders</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientPortalEnabled, setPatientPortalEnabled] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
    fetchPatientPortalFeature();
  }, []);

  const fetchPatientPortalFeature = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/features/patient_portal`);
      setPatientPortalEnabled(response.data.enabled);
    } catch (error) {
      console.log('Failed to fetch patient portal feature');
      setPatientPortalEnabled(true);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      new: 'new',
      verifying_insurance: 'verifying',
      qualified: 'qualified',
      lost: 'lost',
      pending: 'pending',
      confirmed: 'confirmed',
      shipped: 'shipped',
      delivered: 'delivered'
    };
    return statusClasses[status] || 'pending';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const formatCurrencyCompact = (value) => {
    if (value >= 1000000) {
      return '$' + (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return '$' + (value / 1000).toFixed(1) + 'K';
    }
    return formatCurrency(value);
  };

  if (loading) {
    return (
      <div data-testid="dashboard-loading" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page" className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your DME operations</p>
        </div>
        <Button onClick={() => navigate('/leads')} data-testid="new-lead-btn">
          <UserPlus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Sales Overview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Sales Summary Cards */}
        <div className="lg:col-span-1 grid grid-cols-2 gap-4">
          {/* Today's Sales */}
          <div className="bento-item" data-testid="sales-today">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Today</p>
                <p className="text-2xl font-bold mt-1 text-green-600" data-testid="sales-today-amount">
                  {formatCurrency(stats?.sales?.today?.amount || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats?.sales?.today?.count || 0} orders
                </p>
              </div>
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          {/* This Week's Sales */}
          <div className="bento-item" data-testid="sales-week">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold mt-1 text-blue-600" data-testid="sales-week-amount">
                  {formatCurrency(stats?.sales?.week?.amount || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats?.sales?.week?.count || 0} orders
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* This Month's Sales */}
          <div className="bento-item" data-testid="sales-month">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold mt-1 text-purple-600" data-testid="sales-month-amount">
                  {formatCurrency(stats?.sales?.month?.amount || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats?.sales?.month?.count || 0} orders
                </p>
              </div>
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          {/* Pipeline Value */}
          <div className="bento-item" data-testid="pipeline-value">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pipeline</p>
                <p className="text-2xl font-bold mt-1 text-lime-600" data-testid="pipeline-value-amount">
                  {formatCurrency(stats?.sales?.pipeline_value || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Potential revenue
                </p>
              </div>
              <div className="p-2 rounded-lg bg-lime-100 dark:bg-amber-900/30">
                <Target className="w-4 h-4 text-lime-600 dark:text-lime-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Sales Chart */}
        <div className="lg:col-span-2 bento-item" data-testid="weekly-sales-chart">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Weekly Sales</h3>
              <p className="text-xs text-muted-foreground">Last 7 days performance</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-green-600" data-testid="total-sales-amount">
                {formatCurrency(stats?.sales?.total?.amount || 0)}
              </p>
              <p className="text-xs text-muted-foreground">All time</p>
            </div>
          </div>
          <div className="h-48">
            {stats?.weekly_sales?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weekly_sales} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickFormatter={(value) => formatCurrencyCompact(value)}
                  />
                  <Tooltip content={<SalesTooltip />} />
                  <Bar 
                    dataKey="sales" 
                    fill="#22c55e" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sales data yet</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid - Bento Layout */}
      <div className="bento-grid">
        {/* Total Patients - Hidden when patient portal is disabled */}
        {patientPortalEnabled && (
          <div className="bento-item" data-testid="stat-patients">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Patients</p>
                <p className="text-3xl font-bold mt-2">{stats?.totals?.patients || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <Button 
              variant="link" 
              className="px-0 mt-4 text-sm"
              onClick={() => navigate('/patients')}
            >
              View all patients <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Patient Requests */}
        <div className="bento-item" data-testid="stat-leads">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Patient Requests</p>
              <p className="text-3xl font-bold mt-2">{stats?.totals?.leads || 0}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <UserPlus className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <Button 
            variant="link" 
            className="px-0 mt-4 text-sm"
            onClick={() => navigate('/leads')}
          >
            Manage requests <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Total Orders */}
        <div className="bento-item" data-testid="stat-orders">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
              <p className="text-3xl font-bold mt-2">{stats?.totals?.orders || 0}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <Button 
            variant="link" 
            className="px-0 mt-4 text-sm"
            onClick={() => navigate('/orders')}
          >
            View orders <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Total Suppliers */}
        <div className="bento-item" data-testid="stat-suppliers">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Suppliers</p>
              <p className="text-3xl font-bold mt-2">{stats?.totals?.suppliers || 0}</p>
            </div>
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Building2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <Button 
            variant="link" 
            className="px-0 mt-4 text-sm"
            onClick={() => navigate('/suppliers')}
          >
            Manage suppliers <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Request Pipeline Stats */}
        <div className="bento-item span-2" data-testid="lead-pipeline-stats">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Request Pipeline</h3>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats?.leads_by_status?.new || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">New</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats?.leads_by_status?.verifying_insurance || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Verifying</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats?.leads_by_status?.qualified || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Qualified</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats?.leads_by_status?.lost || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Lost</p>
            </div>
          </div>
        </div>

        {/* Order Status Stats */}
        <div className="bento-item span-2" data-testid="order-status-stats">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Order Status</h3>
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-navy-800">
              <p className="text-2xl font-bold">
                {stats?.orders_by_status?.pending || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats?.orders_by_status?.confirmed || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Confirmed</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats?.orders_by_status?.shipped || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Shipped</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats?.orders_by_status?.delivered || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Delivered</p>
            </div>
          </div>
        </div>

        {/* Recent Patient Requests */}
        <div className="bento-item span-2" data-testid="recent-leads">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Requests</h3>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          {stats?.recent_leads?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_leads.map((lead) => (
                <div 
                  key={lead.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-navy-800/50 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                  onClick={() => navigate('/leads')}
                >
                  <div>
                    <p className="font-medium text-sm">{lead.first_name} {lead.last_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.phone}</p>
                  </div>
                  <Badge className={`status-badge ${getStatusBadgeClass(lead.status)}`}>
                    {lead.status?.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent requests</p>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bento-item span-2" data-testid="recent-orders">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Orders</h3>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          {stats?.recent_orders?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_orders.map((order) => (
                <div 
                  key={order.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-navy-800/50 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                  onClick={() => navigate('/orders')}
                >
                  <div>
                    <p className="font-medium text-sm font-mono">{order.id.slice(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">
                      ${order.total_amount?.toFixed(2)} - {order.items?.length || 0} items
                    </p>
                  </div>
                  <Badge className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                    {order.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent orders</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
