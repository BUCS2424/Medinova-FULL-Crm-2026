import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Globe, 
  Search, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink,
  FileText,
  RefreshCw,
  Clock,
  BarChart3,
  Link as LinkIcon,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Rocket,
  Copy,
  Eye,
  Code,
  MapPin,
  Package,
  FolderOpen
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Search engine logos/colors
const searchEngineInfo = {
  'Google': { color: 'bg-blue-500', icon: '🔍' },
  'Bing': { color: 'bg-lime-500', icon: '🔎' },
  'IndexNow (Bing/Yandex/DuckDuckGo)': { color: 'bg-purple-500', icon: '⚡' },
  'DuckDuckGo': { color: 'bg-orange-500', icon: '🦆' },
  'Yahoo': { color: 'bg-violet-500', icon: '📧' },
  'Brave': { color: 'bg-orange-600', icon: '🦁' }
};

export default function SEOToolsManager() {
  const [seoStatus, setSeoStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResults, setSubmissionResults] = useState(null);
  const [sitemapContent, setSitemapContent] = useState('');
  const [robotsContent, setRobotsContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    fetchSEOStatus();
    fetchPreviews();
  }, []);

  // Use stats from API status instead of parsing XML
  const computedStats = {
    total: seoStatus?.indexed_pages?.total || 0,
    products: seoStatus?.indexed_pages?.products || 0,
    locations: seoStatus?.indexed_pages?.locations || 0,
    categories: seoStatus?.indexed_pages?.categories || 0,
    static: seoStatus?.indexed_pages?.static_pages || 0
  };

  const fetchSEOStatus = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/seo/status`, { headers: getHeaders() });
      setSeoStatus(response.data);
    } catch (error) {
      toast.error('Failed to fetch SEO status');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviews = async () => {
    setLoadingPreview(true);
    try {
      // Only fetch robots.txt on initial load (always small)
      // Sitemap preview is loaded lazily when user clicks the tab
      const robotsResponse = await axios.get(`${API_URL}/api/robots.txt`, { timeout: 10000 });
      setRobotsContent(typeof robotsResponse.data === 'string' ? robotsResponse.data : String(robotsResponse.data));
      
      // Use stats from seoStatus instead of parsing full sitemap XML
      // The full sitemap can be 5MB+ with 28,000 URLs - never load it into browser memory
    } catch (error) {
      console.error('Failed to fetch previews:', error);
      setRobotsContent('Failed to load robots.txt preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadSitemapPreview = async () => {
    if (sitemapContent) return;
    setLoadingPreview(true);
    try {
      const response = await axios.get(`${API_URL}/api/sitemap-preview`, { 
        headers: getHeaders(),
        timeout: 15000 
      });
      setSitemapContent(response.data.preview || 'No sitemap content');
    } catch (error) {
      setSitemapContent('Failed to load sitemap preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmitToSearchEngines = async () => {
    setSubmitting(true);
    setSubmissionResults(null);
    
    try {
      const response = await axios.post(`${API_URL}/api/seo/submit-to-search-engines`, {}, { 
        headers: getHeaders(),
        timeout: 60000  // 60 second timeout for search engine pings
      });
      setSubmissionResults(response.data || {});
      toast.success('Sitemap submitted to search engines!');
      fetchSEOStatus();
    } catch (error) {
      const errMsg = error.response?.data?.detail || error.message || 'Failed to submit to search engines';
      toast.error(errMsg);
      setSubmissionResults({
        message: 'Submission failed',
        results: [{
          engine: 'All',
          status: 'error',
          message: errMsg,
          webmaster_url: '#'
        }],
        recommendations: ['Check your network connection and try again']
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (content, label) => {
    navigator.clipboard.writeText(content);
    toast.success(`${label} copied to clipboard!`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Globe className="w-5 h-5" />
            SEO & Search Engine Submission
          </h2>
          <p className="text-sm text-muted-foreground">
            Submit your sitemap to major US search engines for better visibility
          </p>
        </div>
        <Button onClick={() => { fetchSEOStatus(); fetchPreviews(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {computedStats.total || seoStatus?.indexed_pages?.total || 0}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Total URLs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {computedStats.products || 0}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">Products</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {computedStats.categories || 0}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {computedStats.locations || 0}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">Locations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-500 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                  {seoStatus?.seo_completion?.percentage || 0}%
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">SEO Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sitemap & Robots Preview Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            SEO Files Preview
          </CardTitle>
          <CardDescription>
            View and copy your sitemap.xml and robots.txt content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sitemap" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="sitemap" className="flex items-center gap-2" data-testid="sitemap-tab" onClick={loadSitemapPreview}>
                <FileText className="w-4 h-4" />
                sitemap.xml
                <Badge variant="secondary" className="ml-1">{computedStats.total} URLs</Badge>
              </TabsTrigger>
              <TabsTrigger value="robots" className="flex items-center gap-2" data-testid="robots-tab">
                <FileText className="w-4 h-4" />
                robots.txt
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sitemap" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <a 
                    href={seoStatus?.sitemap_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {seoStatus?.sitemap_url}
                  </a>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(sitemapContent, 'Sitemap')}
                  data-testid="copy-sitemap-btn"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
              
              {/* URL Breakdown */}
              <div className="flex flex-wrap gap-2 py-2 border-y">
                <Badge variant="outline" className="gap-1">
                  <FileText className="w-3 h-3" />
                  Static: {computedStats.static}
                </Badge>
                <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200">
                  <Package className="w-3 h-3" />
                  Products: {computedStats.products}
                </Badge>
                <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
                  <FolderOpen className="w-3 h-3" />
                  Categories: {computedStats.categories}
                </Badge>
                <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                  <MapPin className="w-3 h-3" />
                  Locations: {computedStats.locations}
                </Badge>
              </div>
              
              <div className="relative">
                {loadingPreview ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto max-h-[400px] text-xs font-mono" data-testid="sitemap-preview">
                    {sitemapContent || 'No sitemap content available'}
                  </pre>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="robots" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <a 
                    href={seoStatus?.robots_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {seoStatus?.robots_url}
                  </a>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(robotsContent, 'Robots.txt')}
                  data-testid="copy-robots-btn"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
              
              <div className="relative">
                {loadingPreview ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto max-h-[400px] text-sm font-mono" data-testid="robots-preview">
                    {robotsContent || 'No robots.txt content available'}
                  </pre>
                )}
              </div>
              
              {/* Robots.txt Explanation */}
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  What this robots.txt does:
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span><strong>Allows</strong> crawling of homepage, products, and locations pages</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span><strong>Blocks</strong> admin pages (dashboard, settings) from search engines</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span><strong>Blocks</strong> API endpoints from being indexed</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span><strong>Points</strong> search engines to your sitemap.xml</span>
                  </li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Submit to Search Engines */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Submit to All US Search Engines
          </CardTitle>
          <CardDescription>
            One-click submission to Google, Bing, Yahoo, and DuckDuckGo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Engines Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.isArray(seoStatus?.search_engines) && seoStatus.search_engines.map((engine, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border shadow-sm"
              >
                <div className={`w-10 h-10 rounded-lg ${searchEngineInfo[engine.name]?.color || 'bg-gray-500'} flex items-center justify-center text-xl`}>
                  {searchEngineInfo[engine.name]?.icon || '🔍'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{engine.name}</p>
                  {engine.note && (
                    <p className="text-xs text-muted-foreground">{engine.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Last Submission Info */}
          {seoStatus?.last_submission && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Clock className="w-4 h-4" />
              Last submitted: {new Date(seoStatus.last_submission.timestamp).toLocaleString()} 
              by {seoStatus.last_submission.user}
            </div>
          )}

          {/* Submit Button */}
          <Button 
            onClick={handleSubmitToSearchEngines}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-6 text-lg"
            size="lg"
            data-testid="submit-to-search-engines-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting to Search Engines...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Submit Sitemap to All Search Engines
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Submission Results */}
      {submissionResults && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-5 h-5" />
              Submission Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Results Grid */}
            <div className="space-y-2">
              {Array.isArray(submissionResults.results) && submissionResults.results.map((result, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    result.status === 'success' 
                      ? 'bg-green-100 dark:bg-green-900' 
                      : 'bg-red-100 dark:bg-red-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {result.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                    <div>
                      <p className="font-medium">{result.engine}</p>
                      <p className="text-xs text-muted-foreground">{result.message}</p>
                    </div>
                  </div>
                  <a 
                    href={result.webmaster_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm flex items-center gap-1 hover:underline"
                  >
                    Webmaster Tools
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {Array.isArray(submissionResults.recommendations) && submissionResults.recommendations.length > 0 && (
              <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Recommendations for Better SEO
                </h4>
                <ul className="space-y-2">
                  {submissionResults.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-primary" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Verification Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Webmaster Tools (Manual Verification)
          </CardTitle>
          <CardDescription>
            For best results, verify your site ownership in these tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            <a 
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-2xl">
                🔍
              </div>
              <div className="flex-1">
                <p className="font-semibold group-hover:text-primary transition-colors">Google Search Console</p>
                <p className="text-sm text-muted-foreground">Verify ownership & monitor performance</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>

            <a 
              href="https://www.bing.com/webmasters"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-lime-500 flex items-center justify-center text-2xl">
                🔎
              </div>
              <div className="flex-1">
                <p className="font-semibold group-hover:text-primary transition-colors">Bing Webmaster Tools</p>
                <p className="text-sm text-muted-foreground">Also indexes Yahoo & DuckDuckGo</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* SEO Tips */}
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4" />
            SEO Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid md:grid-cols-2 gap-2 text-sm text-amber-800 dark:text-amber-200">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Sitemap auto-updates with new products
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Product pages have structured data (Schema.org)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              SEO meta tags auto-generated
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Image alt tags for accessibility
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Mobile-responsive design
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Fast page load times
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
