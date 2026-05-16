import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Users, 
  Eye, 
  Clock, 
  Globe,
  Chrome,
  Monitor,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  RefreshCw,
  Loader2,
  BarChart3,
  Activity
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Simple area chart component
const AreaChart = ({ data, dataKey, height = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        No data available
      </div>
    );
  }
  
  const maxValue = Math.max(...data.map(d => d[dataKey] || 0), 1);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * 100;
    const y = 100 - ((d[dataKey] || 0) / maxValue) * 100;
    return `${x},${y}`;
  }).join(' ');
  
  // Create fill area
  const areaPoints = `0,100 ${points} 100,100`;
  
  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(y => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
        ))}
        {/* Area fill */}
        <polygon points={areaPoints} fill="rgb(59, 130, 246)" fillOpacity="0.2" />
        {/* Line */}
        <polyline points={points} fill="none" stroke="rgb(59, 130, 246)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground">
        {data.length > 0 && (
          <>
            <span>{data[0].hour !== undefined ? `${data[0].hour}:00` : data[0].date?.slice(5)}</span>
            <span>{data[data.length - 1].hour !== undefined ? `${data[data.length - 1].hour}:00` : data[data.length - 1].date?.slice(5)}</span>
          </>
        )}
      </div>
    </div>
  );
};

// Progress bar component for lists
const ProgressBar = ({ percentage, color = 'blue' }) => (
  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mt-1">
    <div 
      className={`h-1.5 rounded-full ${
        color === 'blue' ? 'bg-blue-500' : 
        color === 'red' ? 'bg-red-500' : 
        color === 'green' ? 'bg-green-500' : 'bg-blue-500'
      }`}
      style={{ width: `${Math.min(percentage, 100)}%` }}
    />
  </div>
);

// Browser/OS icons
const getBrowserIcon = (name) => {
  const browserIcons = {
    'Chrome': '🌐',
    'Firefox': '🦊',
    'Safari': '🧭',
    'Edge': '📘',
    'Opera': '🔴',
    'Unknown': '🌐'
  };
  return browserIcons[name] || '🌐';
};

const getOSIcon = (name) => {
  const osIcons = {
    'Windows': '🪟',
    'macOS': '🍎',
    'Linux': '🐧',
    'iOS': '📱',
    'Android': '🤖',
    'Unknown': '💻'
  };
  return osIcons[name] || '💻';
};

const getCountryFlag = (name) => {
  const flags = {
    'United States': '🇺🇸',
    'United Kingdom': '🇬🇧',
    'Canada': '🇨🇦',
    'Germany': '🇩🇪',
    'France': '🇫🇷',
    'Local': '🏠',
    'Unknown': '🌍'
  };
  return flags[name] || '🌍';
};

export default function AnalyticsPage({ embedded = false }) {
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Analytics data
  const [overview, setOverview] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [pages, setPages] = useState([]);
  const [referrers, setReferrers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [browsers, setBrowsers] = useState([]);
  const [operatingSystems, setOperatingSystems] = useState([]);
  
  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };
  
  const fetchAnalytics = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    
    try {
      const headers = getHeaders();
      const [overviewRes, realtimeRes, pagesRes, referrersRes, countriesRes, browsersRes, osRes] = await Promise.all([
        axios.get(`${API_URL}/api/analytics/overview?period=${period}`, { headers }),
        axios.get(`${API_URL}/api/analytics/realtime`, { headers }),
        axios.get(`${API_URL}/api/analytics/pages?period=${period}&limit=10`, { headers }),
        axios.get(`${API_URL}/api/analytics/referrers?period=${period}&limit=10`, { headers }),
        axios.get(`${API_URL}/api/analytics/countries?period=${period}&limit=10`, { headers }),
        axios.get(`${API_URL}/api/analytics/browsers?period=${period}&limit=10`, { headers }),
        axios.get(`${API_URL}/api/analytics/operating-systems?period=${period}&limit=10`, { headers })
      ]);
      
      setOverview(overviewRes.data);
      setRealtime(realtimeRes.data);
      setPages(pagesRes.data.pages || []);
      setReferrers(referrersRes.data.referrers || []);
      setCountries(countriesRes.data.countries || []);
      setBrowsers(browsersRes.data.browsers || []);
      setOperatingSystems(osRes.data.operating_systems || []);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);
  
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);
  
  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAnalytics(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);
  
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };
  
  const getPeriodLabel = () => {
    const labels = {
      'today': 'Today',
      'yesterday': 'Yesterday',
      '7days': 'Last 7 Days',
      '30days': 'Last 30 Days',
      '90days': 'Last 90 Days',
      'all': 'All Time'
    };
    return labels[period] || period;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6" data-testid="analytics-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Site Traffic Analytics
          </h1>
          <p className="text-muted-foreground">Track visitors and engagement on your public pages</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Real-time indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-950 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              {realtime?.active_visitors || 0} online
            </span>
          </div>
          
          {/* Period selector */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]" data-testid="period-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Refresh button */}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => fetchAnalytics(false)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Visitors */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Visitors
                </p>
                <p className="text-3xl font-bold mt-1">{overview?.visitors || 0}</p>
              </div>
              {overview?.visitor_change !== 0 && (
                <Badge 
                  variant="outline" 
                  className={`${overview?.visitor_change > 0 ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}
                >
                  {overview?.visitor_change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {Math.abs(overview?.visitor_change || 0)}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Pageviews */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  Pageviews
                </p>
                <p className="text-3xl font-bold mt-1">{overview?.pageviews || 0}</p>
              </div>
              {overview?.pageview_change !== 0 && (
                <Badge 
                  variant="outline" 
                  className={`${overview?.pageview_change > 0 ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}
                >
                  {overview?.pageview_change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {Math.abs(overview?.pageview_change || 0)}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Avg Time on Site */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Avg. Time on Site
            </p>
            <p className="text-3xl font-bold mt-1">{formatDuration(overview?.avg_time_on_site)}</p>
          </CardContent>
        </Card>
        
        {/* Real-time Activity */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Activity className="w-4 h-4" />
              Active Now
            </p>
            <p className="text-3xl font-bold mt-1">{realtime?.active_visitors || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {realtime?.pageviews_last_30min || 0} pageviews (30 min)
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Traffic Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            Traffic Overview - {getPeriodLabel()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AreaChart 
            data={overview?.chart_data || []} 
            dataKey="pageviews" 
            height={220}
          />
        </CardContent>
      </Card>
      
      {/* Pages and Referrers */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium py-2 border-b">
                <span>URL</span>
                <span>Pageviews</span>
              </div>
              {pages.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No data available</div>
              ) : (
                pages.map((page, idx) => (
                  <div key={idx} className="py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm truncate">/{page.url || ''}</span>
                        <a 
                          href={`/${page.url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <span className="text-sm font-medium ml-4">{page.pageviews}</span>
                    </div>
                    <ProgressBar percentage={page.percentage} color="red" />
                  </div>
                ))
              )}
            </div>
            {pages.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground">
                View all →
              </Button>
            )}
          </CardContent>
        </Card>
        
        {/* Referrers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium py-2 border-b">
                <span>Website</span>
                <span>Visitors</span>
              </div>
              {referrers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No data available</div>
              ) : (
                referrers.map((ref, idx) => (
                  <div key={idx} className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs">
                          {ref.website?.startsWith('Direct') ? '○' : '🔗'}
                        </span>
                        {ref.website}
                      </span>
                      <span className="text-sm font-medium">{ref.visitors}</span>
                    </div>
                    <ProgressBar percentage={ref.percentage} color="blue" />
                  </div>
                ))
              )}
            </div>
            {referrers.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground">
                View all →
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Countries, Browsers, OS */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Countries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Countries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium py-2 border-b">
                <span>Name</span>
                <span>Visitors</span>
              </div>
              {countries.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No data available</div>
              ) : (
                countries.map((country, idx) => (
                  <div key={idx} className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2">
                        <span>{getCountryFlag(country.name)}</span>
                        {country.name}
                      </span>
                      <span className="text-sm font-medium">{country.visitors}</span>
                    </div>
                    <ProgressBar percentage={country.percentage} color="blue" />
                  </div>
                ))
              )}
            </div>
            {countries.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground">
                View all →
              </Button>
            )}
          </CardContent>
        </Card>
        
        {/* Browsers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Chrome className="w-4 h-4" />
              Browsers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium py-2 border-b">
                <span>Name</span>
                <span>Visitors</span>
              </div>
              {browsers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No data available</div>
              ) : (
                browsers.map((browser, idx) => (
                  <div key={idx} className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2">
                        <span>{getBrowserIcon(browser.name)}</span>
                        {browser.name}
                      </span>
                      <span className="text-sm font-medium">{browser.visitors}</span>
                    </div>
                    <ProgressBar percentage={browser.percentage} color="blue" />
                  </div>
                ))
              )}
            </div>
            {browsers.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground">
                View all →
              </Button>
            )}
          </CardContent>
        </Card>
        
        {/* Operating Systems */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Operating Systems
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium py-2 border-b">
                <span>Name</span>
                <span>Visitors</span>
              </div>
              {operatingSystems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No data available</div>
              ) : (
                operatingSystems.map((os, idx) => (
                  <div key={idx} className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2">
                        <span>{getOSIcon(os.name)}</span>
                        {os.name}
                      </span>
                      <span className="text-sm font-medium">{os.visitors}</span>
                    </div>
                    <ProgressBar percentage={os.percentage} color="blue" />
                  </div>
                ))
              )}
            </div>
            {operatingSystems.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground">
                View all →
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Tracking Script Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Tracking Script</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Add this script to your public pages to start collecting analytics:
          </p>
          <code className="block p-3 bg-navy-900 text-green-400 rounded-lg text-sm overflow-x-auto">
            {`<script>window.ANALYTICS_ENDPOINT='${API_URL}/api/analytics/collect';</script>
<script src="${API_URL}/api/analytics/tracker.js" defer></script>`}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
