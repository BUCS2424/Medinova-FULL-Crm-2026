import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import ProductCatalogManager from '../components/ProductCatalogManager';
import GeneralSettingsManager from '../components/GeneralSettingsManager';
import StorageSettings from '../components/StorageSettings';
import SiteRulesManager from '../components/SiteRulesManager';
import OnboardingDocuments from '../components/OnboardingDocuments';
import PatientDocuments from '../components/PatientDocuments';
import SiteDocuments from '../components/SiteDocuments';
import DatabaseManager from '../components/DatabaseManager';
import SEOToolsManager from '../components/SEOToolsManager';
import AITemplateEditor from '../components/AITemplateEditor';
import FaxSettings from '../components/FaxSettings';
import FeaturesManager from '../components/FeaturesManager';
import NewsletterManager from '../components/NewsletterManager';
import DirectorySubmissionManager from '../components/DirectorySubmissionManager';
import ChatDashboard from '../components/ChatDashboard';
import LocationGenerator from '../components/LocationGenerator';
import ComponentInstaller from '../components/ComponentInstaller';
import {
  FileCode, 
  MapPin, 
  Plus, 
  Trash2, 
  Download, 
  Eye, 
  RefreshCw,
  Upload,
  Globe,
  Building,
  Home,
  ChevronRight,
  Loader2,
  Settings,
  Code,
  Wrench,
  Database,
  FileText,
  Palette,
  Webhook,
  Package,
  FileUp,
  FileDown,
  X,
  Check,
  ExternalLink,
  LayoutTemplate,
  Phone,
  ToggleLeft,
  Mail,
  MessageCircle,
  HardDrive,
  FileSignature,
  DollarSign,
  Save,
  MessageSquare,
  Shield,
  Lock,
  Key,
  AlertTriangle,
  CheckCircle,
  Star,
  Blocks
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Developer tools menu items
const devMenuItems = [
  { id: 'general-settings', icon: Settings, label: 'General Settings', description: 'Site configuration' },
  { id: 'features', icon: ToggleLeft, label: 'Features', description: 'Enable/disable app features' },
  { id: 'storage', icon: HardDrive, label: 'Storage', description: 'iDrive E2 cloud storage' },
  { id: 'security', icon: Shield, label: 'API Security', description: 'Encrypted lead transmission & security logs' },
  { id: 'onboarding', icon: FileSignature, label: 'Onboarding Documents', description: 'Legal documents & e-signatures' },
  { id: 'patient-docs', icon: FileText, label: 'Patient Documents', description: 'Patient forms & templates' },
  { id: 'site-docs', icon: Globe, label: 'Site Documents', description: 'Terms, Privacy Policy & legal pages' },
  { id: 'newsletter', icon: Mail, label: 'Newsletter', description: 'Email campaigns & subscribers' },
  { id: 'live-chat', icon: MessageCircle, label: 'Live Chat', description: 'AI chat & agent dashboard' },
  { id: 'voice-dialer', icon: Phone, label: 'Telnyx (Voice & Fax)', description: 'API key, dialer, fax, IVR settings', link: '/admin/voice-settings' },
  { id: 'sms-settings', icon: MessageCircle, label: 'SMS Settings', description: 'Telnyx SMS configuration' },
  { id: 'phone-billing', icon: DollarSign, label: 'Phone Billing', description: 'Call cost markup settings', superUserOnly: true },
  { id: 'site-rules', icon: FileText, label: 'Site Rules', description: 'Manage site rules by area' },
  { id: 'page-generator', icon: FileCode, label: 'SEO Location Generator', description: 'Generate SEO landing pages for all 50 states' },
  { id: 'location-generator', icon: MapPin, label: 'Location Generator', description: 'Generate state/county/city pages' },
  { id: 'location-generator-v2', icon: MapPin, label: 'Location Generator V2', description: 'Programmatic SEO — 50 states × counties × cities', labelSuffix: <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 ml-1 inline-block" /> },
  { id: 'seo-tools', icon: Globe, label: 'SEO & Search Engines', description: 'Submit to Google, Bing & more' },
  { id: 'directory-submission', icon: Building, label: 'Directory Submission', description: 'Submit to free business directories' },
  { id: 'products', icon: Package, label: 'Products', description: 'Manage product catalog' },
  { id: 'fax', icon: Phone, label: 'Fax', description: 'HIPAA-compliant faxing via Telnyx' },
  { id: 'database', icon: Database, label: 'Database', description: 'Export & import data' },
  { id: 'plugins', icon: Blocks, label: 'Plugin Installer', description: 'Install & manage feature bundles' },
  { id: 'api-tools', icon: Webhook, label: 'API Tools', description: 'Coming soon', disabled: true },
  { id: 'logs', icon: FileText, label: 'System Logs', description: 'Coming soon', disabled: true },
];

export default function DevSettingsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [locations, setLocations] = useState([]);
  const [generatedPages, setGeneratedPages] = useState([]);
  const [staticPagesData, setStaticPagesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeDevTool, setActiveDevTool] = useState('general-settings');
  
  // One-click state generation
  const [usStates, setUsStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [generatingState, setGeneratingState] = useState(false);
  const [stateGenResult, setStateGenResult] = useState(null);
  
  // Location data management
  const [selectedStateForData, setSelectedStateForData] = useState('');
  const [stateLocationData, setStateLocationData] = useState(null);
  const [loadingStateData, setLoadingStateData] = useState(false);
  const [newCounty, setNewCounty] = useState('');
  const [newCity, setNewCity] = useState('');
  const [addingCounty, setAddingCounty] = useState(false);
  const [addingCity, setAddingCity] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  const [newStateAbbr, setNewStateAbbr] = useState('');
  const [addingState, setAddingState] = useState(false);
  
  // Page Template Preview
  const [templatePreview, setTemplatePreview] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  
  // Phone Billing Settings (super user only)
  const [billingConfig, setBillingConfig] = useState({
    per_minute_rate: 0.0085,
    markup_percentage: 0,
    currency: 'USD',
    sms_outbound_rate: 0.004,
    sms_inbound_rate: 0.004,
    sms_markup_percentage: 0
  });
  const [savingBilling, setSavingBilling] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Form state for adding location
  const [newLocation, setNewLocation] = useState({
    name: '',
    slug: '',
    type: 'state',
    geo_region_code: '',
    parent_id: '',
    region_name: '',
    stats: { counties: 0, cities: 0 }
  });

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    fetchData();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, { headers: getHeaders() });
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const isSuperUser = () => {
    return currentUser?.role === 'super_admin';
  };

  const loadBillingConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/voice/billing/config`, { headers: getHeaders() });
      setBillingConfig({
        per_minute_rate: response.data.per_minute_rate || 0.0085,
        markup_percentage: response.data.markup_percentage || 0,
        currency: response.data.currency || 'USD',
        sms_outbound_rate: response.data.sms_outbound_rate || 0.004,
        sms_inbound_rate: response.data.sms_inbound_rate || 0.004,
        sms_markup_percentage: response.data.sms_markup_percentage || 0
      });
    } catch (error) {
      console.error('Failed to load billing config:', error);
    }
  };

  const saveBillingConfig = async () => {
    try {
      setSavingBilling(true);
      await axios.put(`${API_URL}/api/voice/billing/config`, billingConfig, { headers: getHeaders() });
      toast.success('Billing settings saved');
    } catch (error) {
      console.error('Failed to save billing config:', error);
      toast.error('Failed to save billing settings');
    } finally {
      setSavingBilling(false);
    }
  };

  // Load billing config when phone-billing tab is selected
  useEffect(() => {
    if (activeDevTool === 'phone-billing') {
      loadBillingConfig();
    }
    if (activeDevTool === 'sms-settings') {
      loadSmsConfig();
    }
    if (activeDevTool === 'security') {
      loadSecurityConfig();
      loadSecurityLogs();
    }
  }, [activeDevTool]);

  // SMS Settings state
  const [smsConfig, setSmsConfig] = useState({
    enabled: false,
    api_key: '',
    messaging_profile_id: '',
    phone_number: '',
    webhook_url: ''
  });
  const [savingSms, setSavingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);

  const loadSmsConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sms/config`, { headers: getHeaders() });
      setSmsConfig({
        enabled: response.data.enabled || false,
        api_key: response.data.api_key || '',
        messaging_profile_id: response.data.messaging_profile_id || '',
        phone_number: response.data.phone_number || '',
        webhook_url: response.data.webhook_url || ''
      });
      
      // Also get status
      const statusRes = await axios.get(`${API_URL}/api/sms/status`, { headers: getHeaders() });
      setSmsStatus(statusRes.data);
    } catch (error) {
      console.error('Failed to load SMS config:', error);
    }
  };

  const saveSmsConfig = async () => {
    try {
      setSavingSms(true);
      await axios.put(`${API_URL}/api/sms/config`, smsConfig, { headers: getHeaders() });
      toast.success('SMS settings saved');
      loadSmsConfig();
    } catch (error) {
      console.error('Failed to save SMS config:', error);
      toast.error('Failed to save SMS settings');
    } finally {
      setSavingSms(false);
    }
  };

  // Security Settings state
  const [securityConfig, setSecurityConfig] = useState(null);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [loadingSecurityLogs, setLoadingSecurityLogs] = useState(false);

  const loadSecurityConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/public/leads/encryption-config`);
      setSecurityConfig(response.data);
    } catch (error) {
      console.error('Failed to load security config:', error);
    }
  };

  const loadSecurityLogs = async () => {
    setLoadingSecurityLogs(true);
    try {
      const response = await axios.get(`${API_URL}/api/security/logs?limit=50`, { headers: getHeaders() });
      setSecurityLogs(response.data.logs || []);
    } catch (error) {
      console.error('Failed to load security logs:', error);
      setSecurityLogs([]);
    } finally {
      setLoadingSecurityLogs(false);
    }
  };

  const fetchData = async () => {
    const token = localStorage.getItem('dme_token');
    if (!token) {
      toast.error('Not authenticated');
      return;
    }
    const headers = getHeaders();
    
    setLoading(true);
    try {
      const [statsRes, locationsRes, pagesRes, staticPagesRes, usStatesRes] = await Promise.all([
        axios.get(`${API_URL}/api/dev/stats`, { headers }),
        axios.get(`${API_URL}/api/dev/locations`, { headers }),
        axios.get(`${API_URL}/api/dev/generated-pages`, { headers }),
        // Fetch grouped pages from API instead of static JSON file for data consistency
        axios.get(`${API_URL}/api/dev/generated-pages-grouped`, { headers }).then(res => res.data).catch(() => []),
        axios.get(`${API_URL}/api/dev/us-states`, { headers }).catch(() => ({ data: [] }))
      ]);
      setStats(statsRes.data);
      setLocations(locationsRes.data);
      setGeneratedPages(pagesRes.data.pages || pagesRes.data || []);
      setStaticPagesData(staticPagesRes);
      setUsStates(usStatesRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name) => {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setNewLocation(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    try {
      const locationData = {
        ...newLocation,
        parent_id: newLocation.parent_id || null,
        stats: newLocation.type === 'state' ? newLocation.stats : null
      };
      
      await axios.post(`${API_URL}/api/dev/locations`, locationData, { headers: getHeaders() });
      toast.success('Location added successfully');
      setNewLocation({
        name: '',
        slug: '',
        type: 'state',
        geo_region_code: '',
        parent_id: '',
        region_name: '',
        stats: { counties: 0, cities: 0 }
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add location');
    }
  };

  const handleDeleteLocation = async (locationId) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/dev/locations/${locationId}`, { headers: getHeaders() });
      toast.success('Location deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete location');
    }
  };

  const handleGeneratePages = async () => {
    if (selectedLocations.length === 0) {
      toast.error('Please select at least one location');
      return;
    }
    
    setGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/api/dev/generate-pages`, {
        location_ids: selectedLocations,
        include_children: true
      }, { headers: getHeaders() });
      
      toast.success(`Generated ${response.data.generated} pages`);
      if (response.data.errors.length > 0) {
        toast.warning(`${response.data.errors.length} errors occurred`);
      }
      setSelectedLocations([]);
      fetchData();
    } catch (error) {
      toast.error('Failed to generate pages');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!window.confirm('Generate pages for ALL locations? This may take a while.')) return;
    
    setGenerating(true);
    try {
      const allLocationIds = locations.map(loc => loc.id);
      const response = await axios.post(`${API_URL}/api/dev/generate-pages`, {
        location_ids: allLocationIds,
        include_children: true
      }, { headers: getHeaders() });
      
      toast.success(`Generated ${response.data.generated} pages`);
      fetchData();
    } catch (error) {
      toast.error('Failed to generate pages');
    } finally {
      setGenerating(false);
    }
  };

  // One-click state page generation
  const handleGenerateStatePagesClick = async () => {
    if (!selectedState) {
      toast.error('Please select a state');
      return;
    }
    
    const stateInfo = usStates.find(s => s.slug === selectedState);
    if (!stateInfo) return;
    
    if (!window.confirm(`Generate all ${stateInfo.total_pages} pages for ${stateInfo.name}?\n\nThis will create:\n• 1 state page\n• ${stateInfo.county_count} county pages\n• ${stateInfo.city_count} city pages`)) {
      return;
    }
    
    setGeneratingState(true);
    setStateGenResult(null);
    
    try {
      const response = await axios.post(
        `${API_URL}/api/dev/generate-state/${selectedState}`,
        {},
        { headers: getHeaders() }
      );
      
      setStateGenResult(response.data);
      toast.success(`Successfully generated ${response.data.generated} pages for ${response.data.state}!`);
      
      // Refresh data to update static pages count
      fetchData();
      
      // Reset selection
      setSelectedState('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate state pages');
      setStateGenResult({ error: error.response?.data?.detail || 'Generation failed' });
    } finally {
      setGeneratingState(false);
    }
  };

  const handlePreviewPage = async (pageId) => {
    try {
      const response = await axios.get(`${API_URL}/api/dev/generated-pages/${pageId}`, { headers: getHeaders() });
      setPreviewHtml(response.data);
    } catch (error) {
      toast.error('Failed to load preview');
    }
  };

  const handleDownloadPage = async (pageId, filename) => {
    try {
      const response = await axios.get(`${API_URL}/api/dev/generated-pages/${pageId}/download`, { 
        headers: getHeaders(),
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download page');
    }
  };

  const handleDeletePage = async (pageId) => {
    if (!window.confirm('Delete this generated page?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/dev/generated-pages/${pageId}`, { headers: getHeaders() });
      toast.success('Page deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete page');
    }
  };

  // Bulk delete all pages for a state
  const handleBulkDeleteState = async (stateSlug, stateName, totalPages) => {
    if (!window.confirm(`⚠️ DELETE ALL ${totalPages} PAGES FOR ${stateName}?\n\nThis will permanently delete:\n• State page\n• All county pages\n• All city pages\n\nThis action cannot be undone.`)) return;
    
    // Double confirmation for safety
    const confirmText = window.prompt(`Type "${stateSlug}" to confirm deletion of all ${totalPages} pages:`);
    if (confirmText !== stateSlug) {
      toast.error('Deletion cancelled - confirmation text did not match');
      return;
    }
    
    try {
      const response = await axios.delete(
        `${API_URL}/api/dev/generated-pages/bulk/state/${stateSlug}`, 
        { headers: getHeaders() }
      );
      toast.success(`Deleted ${response.data.deleted_count} pages for ${stateName}`);
      fetchData(); // Refresh the data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete pages');
    }
  };

  // Delete ALL generated pages
  const handleDeleteAllPages = async () => {
    const totalPages = staticPagesData.reduce((sum, s) => sum + (s.total_pages || 0), 0);
    
    if (!window.confirm(`⚠️ DELETE ALL ${totalPages} GENERATED PAGES?\n\nThis will permanently delete:\n• All state pages\n• All county pages\n• All city pages\n• The locations-data.json file\n\nThis action cannot be undone!`)) return;
    
    // Triple confirmation for this dangerous action
    const confirmText = window.prompt('Type "DELETE ALL" to confirm:');
    if (confirmText !== 'DELETE ALL') {
      toast.error('Deletion cancelled - confirmation text did not match');
      return;
    }
    
    try {
      const response = await axios.delete(
        `${API_URL}/api/dev/generated-pages/bulk/all`, 
        { headers: getHeaders() }
      );
      toast.success(`Deleted ${response.data.files_deleted} pages`);
      fetchData(); // Refresh the data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete all pages');
    }
  };

  const toggleLocationSelection = (locationId) => {
    setSelectedLocations(prev => 
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  // ==================== LOCATION DATA MANAGEMENT ====================
  
  // Fetch state location data when state is selected
  const fetchStateLocationData = async (stateSlug) => {
    if (!stateSlug) {
      setStateLocationData(null);
      return;
    }
    
    setLoadingStateData(true);
    try {
      const response = await axios.get(`${API_URL}/api/dev/location-data/${stateSlug}`, { headers: getHeaders() });
      setStateLocationData(response.data);
    } catch (error) {
      toast.error('Failed to fetch state data');
      setStateLocationData(null);
    } finally {
      setLoadingStateData(false);
    }
  };

  // Add a new state
  const handleAddState = async (e) => {
    e.preventDefault();
    if (!newStateName.trim() || !newStateAbbr.trim()) {
      toast.error('State name and abbreviation are required');
      return;
    }
    
    setAddingState(true);
    try {
      await axios.post(`${API_URL}/api/dev/location-data/state`, {
        name: newStateName.trim(),
        abbr: newStateAbbr.trim().toUpperCase()
      }, { headers: getHeaders() });
      
      toast.success(`State "${newStateName}" added successfully`);
      setNewStateName('');
      setNewStateAbbr('');
      fetchData(); // Refresh states list
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add state');
    } finally {
      setAddingState(false);
    }
  };

  // Add county to state
  const handleAddCounty = async (e) => {
    e.preventDefault();
    if (!newCounty.trim() || !selectedStateForData) return;
    
    setAddingCounty(true);
    try {
      await axios.post(`${API_URL}/api/dev/location-data/state/${selectedStateForData}/county`, {
        name: newCounty.trim()
      }, { headers: getHeaders() });
      
      toast.success(`County "${newCounty}" added`);
      setNewCounty('');
      fetchStateLocationData(selectedStateForData);
      fetchData(); // Refresh counts
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add county');
    } finally {
      setAddingCounty(false);
    }
  };

  // Add city to state
  const handleAddCity = async (e) => {
    e.preventDefault();
    if (!newCity.trim() || !selectedStateForData) return;
    
    setAddingCity(true);
    try {
      await axios.post(`${API_URL}/api/dev/location-data/state/${selectedStateForData}/city`, {
        name: newCity.trim()
      }, { headers: getHeaders() });
      
      toast.success(`City "${newCity}" added`);
      setNewCity('');
      fetchStateLocationData(selectedStateForData);
      fetchData(); // Refresh counts
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add city');
    } finally {
      setAddingCity(false);
    }
  };

  // Delete county
  const handleDeleteCounty = async (countyName) => {
    if (!window.confirm(`Delete county "${countyName}"?`)) return;
    
    try {
      await axios.delete(`${API_URL}/api/dev/location-data/state/${selectedStateForData}/county/${encodeURIComponent(countyName)}`, { headers: getHeaders() });
      toast.success(`County "${countyName}" deleted`);
      fetchStateLocationData(selectedStateForData);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete county');
    }
  };

  // Delete city
  const handleDeleteCity = async (cityName) => {
    if (!window.confirm(`Delete city "${cityName}"?`)) return;
    
    try {
      await axios.delete(`${API_URL}/api/dev/location-data/state/${selectedStateForData}/city/${encodeURIComponent(cityName)}`, { headers: getHeaders() });
      toast.success(`City "${cityName}" deleted`);
      fetchStateLocationData(selectedStateForData);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete city');
    }
  };

  // Export state locations as CSV
  const handleExportState = async () => {
    if (!selectedStateForData) return;
    
    try {
      const response = await axios.get(`${API_URL}/api/dev/location-data/export/${selectedStateForData}`, {
        headers: getHeaders(),
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedStateForData}_locations.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  // Export all locations as CSV
  const handleExportAll = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dev/location-data/export-all`, {
        headers: getHeaders(),
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'all_locations.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  // Import CSV
  const handleImportCsv = async () => {
    if (!csvContent.trim()) {
      toast.error('Please paste CSV content');
      return;
    }
    
    setImportingCsv(true);
    try {
      const response = await axios.post(`${API_URL}/api/dev/location-data/import-csv`, {
        csv_content: csvContent,
        state_slug: selectedStateForData || null
      }, { headers: getHeaders() });
      
      toast.success(`Import complete: ${response.data.added_counties} counties, ${response.data.added_cities} cities added`);
      if (response.data.added_states > 0) {
        toast.success(`${response.data.added_states} new states created`);
      }
      if (response.data.total_errors > 0) {
        toast.warning(`${response.data.total_errors} errors occurred`);
      }
      
      setCsvContent('');
      setImportModalOpen(false);
      fetchData();
      if (selectedStateForData) {
        fetchStateLocationData(selectedStateForData);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import CSV');
    } finally {
      setImportingCsv(false);
    }
  };

  // Handle file upload for CSV import
  const handleCsvFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target.result);
    };
    reader.readAsText(file);
  };

  // Fetch the location page template preview
  const fetchTemplatePreview = async () => {
    setLoadingTemplate(true);
    try {
      const response = await axios.get(`${API_URL}/api/dev/page-template/preview`, { headers: getHeaders() });
      setTemplatePreview(response.data);
    } catch (error) {
      toast.error('Failed to fetch template preview');
      console.error(error);
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Open template in new browser tab
  const openTemplateInNewTab = () => {
    if (!templatePreview?.html) return;
    
    // Create a blob URL from the HTML content
    const blob = new Blob([templatePreview.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    // Clean up after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'state': return <Globe className="w-4 h-4" />;
      case 'county': return <Building className="w-4 h-4" />;
      case 'city': return <Home className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'state': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'county': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'city': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex gap-6" data-testid="dev-settings-page">
      {/* Developer Side Menu */}
      <div className="w-64 flex-shrink-0">
        <div className="sticky top-20 space-y-2">
          <div className="mb-4">
            <h2 className="font-semibold text-sm uppercase text-muted-foreground">Dev Tools</h2>
          </div>
          {devMenuItems
            .filter(item => !item.superUserOnly || isSuperUser())
            .map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.disabled) return;
                if (item.link) {
                  navigate(item.link);
                } else {
                  setActiveDevTool(item.id);
                }
              }}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                activeDevTool === item.id 
                  ? 'bg-primary text-primary-foreground' 
                  : item.disabled 
                    ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                    : 'hover:bg-muted text-foreground'
              }`}
              data-testid={`dev-menu-${item.id}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate flex items-center">{item.label}{item.labelSuffix}</p>
                <p className={`text-xs truncate ${activeDevTool === item.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {item.description}
                </p>
              </div>
              {item.link && (
                <span className="text-xs bg-lime-100 text-amber-800 px-2 py-0.5 rounded">→</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Wrench className="w-6 h-6" />
                Dev Settings
              </h1>
              <p className="text-muted-foreground">Developer tools and page generation</p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Overview */}
        {stats && activeDevTool === 'page-generator' && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {stats.total_locations || 0}
                </div>
                <p className="text-xs text-muted-foreground">Total Locations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.states || 0}
                </div>
                <p className="text-xs text-muted-foreground">States</p>
              </CardContent>
            </Card>
            <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">
                {stats.counties || 0}
              </div>
              <p className="text-xs text-muted-foreground">Counties</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {stats.cities || 0}
              </div>
              <p className="text-xs text-muted-foreground">Cities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-lime-600">
                {stats.generated_pages || 0}
              </div>
              <p className="text-xs text-muted-foreground">Total Published Pages</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      {/* Page Generator Tool */}
      {activeDevTool === 'page-generator' && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileCode className="w-4 h-4 mr-2" />
            Page Generator
          </TabsTrigger>
          <TabsTrigger value="location-data" data-testid="tab-location-data">
            <Database className="w-4 h-4 mr-2" />
            Location Data
          </TabsTrigger>
          <TabsTrigger value="locations" data-testid="tab-locations">
            <MapPin className="w-4 h-4 mr-2" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="pages" data-testid="tab-pages">
            <Code className="w-4 h-4 mr-2" />
            Generated Pages
          </TabsTrigger>
          <TabsTrigger value="page-template" data-testid="tab-page-template" onClick={() => !templatePreview && fetchTemplatePreview()}>
            <LayoutTemplate className="w-4 h-4 mr-2" />
            Page Template
          </TabsTrigger>
        </TabsList>

        {/* Page Generator Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* One-Click State Generation Card */}
          <Card className="border-2 border-lime-200 bg-lime-50/50 dark:bg-amber-950/20 dark:border-lime-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lime-700 dark:text-lime-400">
                <Globe className="w-5 h-5" />
                One-Click State Generation
              </CardTitle>
              <CardDescription>
                Generate all location pages for an entire state with one click. Creates state, county, and city pages automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select 
                  value={selectedState} 
                  onValueChange={setSelectedState}
                >
                  <SelectTrigger className="w-full sm:w-[300px]" data-testid="state-select">
                    <SelectValue placeholder="Select a state..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {usStates.map((state) => (
                      <SelectItem key={state.slug} value={state.slug}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{state.name} ({state.abbr})</span>
                          <span className="text-xs text-muted-foreground">{state.total_pages} pages</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button 
                  onClick={handleGenerateStatePagesClick}
                  disabled={generatingState || !selectedState}
                  className="bg-lime-600 hover:bg-amber-700 text-white"
                  data-testid="generate-state-btn"
                >
                  {generatingState ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 mr-2" />
                      Generate State Pages
                    </>
                  )}
                </Button>
              </div>
              
              {/* Selected State Info */}
              {selectedState && (
                <div className="p-4 bg-white dark:bg-navy-900 rounded-lg border">
                  {(() => {
                    const stateInfo = usStates.find(s => s.slug === selectedState);
                    if (!stateInfo) return null;
                    return (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-lg">{stateInfo.name}</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">1</div>
                            <div className="text-muted-foreground">State Page</div>
                          </div>
                          <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">{stateInfo.county_count}</div>
                            <div className="text-muted-foreground">County Pages</div>
                          </div>
                          <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{stateInfo.city_count}</div>
                            <div className="text-muted-foreground">City Pages</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Total: <strong>{stateInfo.total_pages}</strong> SEO pages will be generated
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {/* Generation Result */}
              {stateGenResult && !stateGenResult.error && (
                <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold mb-2">
                    <RefreshCw className="w-4 h-4" />
                    Generation Complete!
                  </div>
                  <p className="text-sm">
                    Successfully generated <strong>{stateGenResult.generated}</strong> pages for {stateGenResult.state}.
                  </p>
                  {stateGenResult.details && (
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>State: {stateGenResult.details.state_page}</span>
                      <span>Counties: {stateGenResult.details.county_pages}</span>
                      <span>Cities: {stateGenResult.details.city_pages}</span>
                    </div>
                  )}
                  {stateGenResult.errors > 0 && (
                    <p className="text-xs text-lime-600 mt-2">
                      ⚠️ {stateGenResult.errors} error(s) occurred during generation
                    </p>
                  )}
                </div>
              )}
              
              {stateGenResult?.error && (
                <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                  Error: {stateGenResult.error}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Existing Manual Page Generator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="w-5 h-5" />
                SEO Page Generator
              </CardTitle>
              <CardDescription>
                Generate location-based DME landing pages for SEO. Select locations below and click generate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleGeneratePages} 
                  disabled={generating || selectedLocations.length === 0}
                  data-testid="generate-selected-btn"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileCode className="w-4 h-4 mr-2" />
                  )}
                  Generate Selected ({selectedLocations.length})
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleGenerateAll}
                  disabled={generating || locations.length === 0}
                  data-testid="generate-all-btn"
                >
                  Generate All Pages
                </Button>
              </div>

              {/* Location Selection */}
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                {locations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No locations added yet. Add locations in the Locations tab.
                  </div>
                ) : (
                  <div className="divide-y">
                    {locations.map((location) => (
                      <div 
                        key={location.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                          selectedLocations.includes(location.id) ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => toggleLocationSelection(location.id)}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedLocations.includes(location.id)}
                          onChange={() => {}}
                          className="w-4 h-4"
                        />
                        <span className={`p-1.5 rounded ${getTypeColor(location.type)}`}>
                          {getTypeIcon(location.type)}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">{location.name}</p>
                          <p className="text-xs text-muted-foreground">{location.slug}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {location.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Data Tab */}
        <TabsContent value="location-data" className="space-y-6">
          {/* Export All & Import Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Location Data Management
              </CardTitle>
              <CardDescription>
                Add, edit, import and export states, counties, and cities for page generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Global Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleExportAll} data-testid="export-all-btn">
                  <FileDown className="w-4 h-4 mr-2" />
                  Export All Locations (CSV)
                </Button>
                <Button variant="outline" onClick={() => setImportModalOpen(true)} data-testid="import-csv-btn">
                  <FileUp className="w-4 h-4 mr-2" />
                  Import from CSV
                </Button>
              </div>
              
              {/* CSV Format Info */}
              <div className="p-4 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium mb-2">CSV Format:</p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li><strong>Single State:</strong> <code className="bg-muted px-1 rounded">type,name</code> (select state first)</li>
                  <li><strong>Multi-State:</strong> <code className="bg-muted px-1 rounded">state,state_abbr,type,name</code></li>
                </ul>
                <p className="mt-2 text-muted-foreground">
                  Example: <code className="bg-muted px-1 rounded">Virginia,VA,county,Fairfax County</code>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Add New State Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add New State
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddState} className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>State Name</Label>
                  <Input
                    placeholder="California"
                    value={newStateName}
                    onChange={(e) => setNewStateName(e.target.value)}
                    className="w-[200px]"
                    data-testid="new-state-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Abbreviation</Label>
                  <Input
                    placeholder="CA"
                    value={newStateAbbr}
                    onChange={(e) => setNewStateAbbr(e.target.value.toUpperCase())}
                    maxLength={2}
                    className="w-[80px]"
                    data-testid="new-state-abbr"
                  />
                </div>
                <Button type="submit" disabled={addingState || !newStateName.trim() || !newStateAbbr.trim()}>
                  {addingState ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add State
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* State Selector & Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Manage State Locations
              </CardTitle>
              <CardDescription>Select a state to add or remove counties and cities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* State Selector */}
              <div className="flex flex-wrap gap-4 items-center">
                <Select 
                  value={selectedStateForData} 
                  onValueChange={(val) => {
                    setSelectedStateForData(val);
                    fetchStateLocationData(val);
                  }}
                >
                  <SelectTrigger className="w-[300px]" data-testid="state-data-select">
                    <SelectValue placeholder="Select a state to manage..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {usStates.map((state) => (
                      <SelectItem key={state.slug} value={state.slug}>
                        {state.name} ({state.abbr}) - {state.county_count} counties, {state.city_count} cities
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedStateForData && (
                  <Button variant="outline" size="sm" onClick={handleExportState}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Export {stateLocationData?.name}
                  </Button>
                )}
              </div>

              {/* State Data Display */}
              {loadingStateData && (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}

              {stateLocationData && !loadingStateData && (
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Counties Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Counties ({stateLocationData.counties.length})
                      </h4>
                    </div>
                    
                    {/* Add County Form */}
                    <form onSubmit={handleAddCounty} className="flex gap-2">
                      <Input
                        placeholder="Add county name..."
                        value={newCounty}
                        onChange={(e) => setNewCounty(e.target.value)}
                        className="flex-1"
                        data-testid="new-county-input"
                      />
                      <Button type="submit" size="sm" disabled={addingCounty || !newCounty.trim()}>
                        {addingCounty ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </form>
                    
                    {/* Counties List */}
                    <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                      {stateLocationData.counties.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          No counties added yet
                        </div>
                      ) : (
                        <div className="divide-y">
                          {stateLocationData.counties.map((county, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 hover:bg-muted/50">
                              <span className="text-sm">{county}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteCounty(county)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cities Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Home className="w-4 h-4" />
                        Cities ({stateLocationData.cities.length})
                      </h4>
                    </div>
                    
                    {/* Add City Form */}
                    <form onSubmit={handleAddCity} className="flex gap-2">
                      <Input
                        placeholder="Add city name..."
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                        className="flex-1"
                        data-testid="new-city-input"
                      />
                      <Button type="submit" size="sm" disabled={addingCity || !newCity.trim()}>
                        {addingCity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </form>
                    
                    {/* Cities List */}
                    <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                      {stateLocationData.cities.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          No cities added yet
                        </div>
                      ) : (
                        <div className="divide-y">
                          {stateLocationData.cities.map((city, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 hover:bg-muted/50">
                              <span className="text-sm">{city}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteCity(city)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!selectedStateForData && !loadingStateData && (
                <div className="p-8 text-center text-muted-foreground">
                  Select a state above to manage its counties and cities
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import CSV Modal */}
          {importModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className="w-full max-w-2xl mx-4">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileUp className="w-5 h-5" />
                      Import Locations from CSV
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => setImportModalOpen(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    {selectedStateForData 
                      ? `Import counties and cities for ${stateLocationData?.name || selectedStateForData}. Use format: type,name`
                      : 'Import locations for multiple states. Use format: state,state_abbr,type,name'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* File Upload */}
                  <div className="space-y-2">
                    <Label>Upload CSV File</Label>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileUpload}
                      className="cursor-pointer"
                    />
                  </div>
                  
                  {/* Or Paste */}
                  <div className="space-y-2">
                    <Label>Or paste CSV content:</Label>
                    <textarea
                      className="w-full h-48 p-3 border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={selectedStateForData 
                        ? "type,name\ncounty,Fairfax County\ncity,Arlington\ncity,Alexandria"
                        : "state,state_abbr,type,name\nVirginia,VA,county,Fairfax County\nVirginia,VA,city,Arlington"
                      }
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setImportModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleImportCsv} disabled={importingCsv || !csvContent.trim()}>
                      {importingCsv ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                      ) : (
                        <><Check className="w-4 h-4 mr-2" /> Import</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Add Location Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Location
                </CardTitle>
                <CardDescription>Add a new state, county, or city</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddLocation} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Location Type</Label>
                      <Select 
                        value={newLocation.type} 
                        onValueChange={(v) => setNewLocation(prev => ({ ...prev, type: v }))}
                      >
                        <SelectTrigger data-testid="location-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="state">State</SelectItem>
                          <SelectItem value="county">County</SelectItem>
                          <SelectItem value="city">City</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Geo Region Code</Label>
                      <Input 
                        placeholder="US-VA"
                        value={newLocation.geo_region_code}
                        onChange={(e) => setNewLocation(prev => ({ ...prev, geo_region_code: e.target.value }))}
                        required
                        data-testid="geo-code-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Location Name</Label>
                    <Input 
                      placeholder="Virginia"
                      value={newLocation.name}
                      onChange={handleNameChange}
                      required
                      data-testid="location-name-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>URL Slug</Label>
                    <Input 
                      placeholder="virginia"
                      value={newLocation.slug}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, slug: e.target.value }))}
                      required
                      data-testid="location-slug-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      File: durable-medical-equipment-in-{newLocation.slug || 'slug'}.html
                    </p>
                  </div>

                  {newLocation.type !== 'state' && (
                    <div className="space-y-2">
                      <Label>Parent Location</Label>
                      <Select 
                        value={newLocation.parent_id} 
                        onValueChange={(v) => setNewLocation(prev => ({ ...prev, parent_id: v }))}
                      >
                        <SelectTrigger data-testid="parent-location-select">
                          <SelectValue placeholder="Select parent..." />
                        </SelectTrigger>
                        <SelectContent>
                          {locations
                            .filter(loc => 
                              newLocation.type === 'county' ? loc.type === 'state' : loc.type === 'county'
                            )
                            .map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Region Name (Optional)</Label>
                    <Input 
                      placeholder="Hampton Roads"
                      value={newLocation.region_name}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, region_name: e.target.value }))}
                      data-testid="region-name-input"
                    />
                  </div>

                  {newLocation.type === 'state' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Counties Count</Label>
                        <Input 
                          type="number"
                          value={newLocation.stats.counties}
                          onChange={(e) => setNewLocation(prev => ({ 
                            ...prev, 
                            stats: { ...prev.stats, counties: parseInt(e.target.value) || 0 }
                          }))}
                          data-testid="counties-count-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cities Count</Label>
                        <Input 
                          type="number"
                          value={newLocation.stats.cities}
                          onChange={(e) => setNewLocation(prev => ({ 
                            ...prev, 
                            stats: { ...prev.stats, cities: parseInt(e.target.value) || 0 }
                          }))}
                          data-testid="cities-count-input"
                        />
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full" data-testid="add-location-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Location
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Locations List */}
            <Card>
              <CardHeader>
                <CardTitle>Locations ({locations.length})</CardTitle>
                <CardDescription>Manage your location hierarchy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg max-h-[500px] overflow-y-auto">
                  {locations.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No locations added yet
                    </div>
                  ) : (
                    <div className="divide-y">
                      {locations.map((location) => (
                        <div key={location.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                          <span className={`p-1.5 rounded ${getTypeColor(location.type)}`}>
                            {getTypeIcon(location.type)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{location.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {location.geo_region_code} • {location.slug}
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteLocation(location.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`delete-location-${location.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Generated Pages Tab */}
        <TabsContent value="pages" className="space-y-6">
          {/* Static Pages Summary */}
          {staticPagesData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-lime-500" />
                  Published Location Pages
                </CardTitle>
                <CardDescription>
                  Static SEO pages deployed to /locations/ directory
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-lime-50 dark:bg-amber-950 rounded-lg text-center">
                    <p className="text-3xl font-bold text-lime-600">{staticPagesData.length}</p>
                    <p className="text-sm text-muted-foreground">States/Territories</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {staticPagesData.reduce((sum, s) => sum + (s.counties?.length || 0), 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Counties</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {staticPagesData.reduce((sum, s) => sum + (s.cities?.length || 0), 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Cities</p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg text-center">
                    <p className="text-3xl font-bold text-purple-600">
                      {staticPagesData.reduce((sum, s) => sum + (s.total_pages || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Pages</p>
                  </div>
                </div>

                {/* States Breakdown */}
                <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 font-medium">State/Territory</th>
                        <th className="text-center p-3 font-medium">Counties</th>
                        <th className="text-center p-3 font-medium">Cities</th>
                        <th className="text-center p-3 font-medium">Total</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {staticPagesData.map((state) => (
                        <tr key={state.slug} className="hover:bg-muted/30">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-lime-500" />
                              <span className="font-medium">{state.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center text-muted-foreground">
                            {state.counties?.length || 0}
                          </td>
                          <td className="p-3 text-center text-muted-foreground">
                            {state.cities?.length || 0}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="secondary">{state.total_pages}</Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={`/locations/${state.file}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-lime-600 hover:text-lime-700 text-xs font-medium"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </a>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleBulkDeleteState(state.slug, state.name, state.total_pages)}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Pages are served from /locations/*.html</span>
                  <a 
                    href="/locations" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-lime-600 hover:text-lime-700 font-medium"
                  >
                    View Public Service Areas Page →
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Database Generated Pages */}
          <Card>
            <CardHeader>
              <CardTitle>Database Generated Pages ({generatedPages.length})</CardTitle>
              <CardDescription>Pages generated via Page Generator and stored in database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                {generatedPages.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No pages in database. Use Page Generator tab to create new pages.
                  </div>
                ) : (
                  <div className="divide-y">
                    {generatedPages.map((page) => (
                      <div key={page.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                        <FileCode className="w-5 h-5 text-lime-500" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{page.location_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{page.filename}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(page.generated_at).toLocaleDateString()}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handlePreviewPage(page.id)}
                            data-testid={`preview-page-${page.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDownloadPage(page.id, page.filename)}
                            data-testid={`download-page-${page.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeletePage(page.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`delete-page-${page.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Page Template Tab */}
        <TabsContent value="page-template" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutTemplate className="w-5 h-5" />
                    Location Page Template
                  </CardTitle>
                  <CardDescription>
                    Preview and design the template used for generated location pages
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={fetchTemplatePreview}
                    disabled={loadingTemplate}
                    data-testid="refresh-template-btn"
                  >
                    {loadingTemplate ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                  <Button 
                    onClick={openTemplateInNewTab}
                    disabled={!templatePreview?.html}
                    className="bg-lime-600 hover:bg-amber-700"
                    data-testid="open-template-new-tab-btn"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTemplate && !templatePreview && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-lime-600" />
                </div>
              )}
              
              {!loadingTemplate && !templatePreview && (
                <div className="text-center py-16">
                  <LayoutTemplate className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Load Template Preview</h3>
                  <p className="text-muted-foreground mb-4">Click the button above to load the location page template</p>
                  <Button onClick={fetchTemplatePreview} variant="outline">
                    <Eye className="w-4 h-4 mr-2" />
                    Load Preview
                  </Button>
                </div>
              )}
              
              {templatePreview && (
                <div className="space-y-6">
                  {/* Template Info */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="p-4 bg-lime-50 dark:bg-amber-950 rounded-lg border border-lime-200 dark:border-lime-800">
                      <div className="flex items-center gap-2 text-lime-700 dark:text-lime-400 mb-1">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium">Sample Location</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{templatePreview.sample_location || 'Virginia'}</p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-1">
                        <Code className="w-4 h-4" />
                        <span className="font-medium">Template Type</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{templatePreview.type || 'State Page'}</p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 mb-1">
                        <Building className="w-4 h-4" />
                        <span className="font-medium">Counties</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{templatePreview.county_count || 14}</p>
                    </div>
                    <div className="p-4 bg-cyan-50 dark:bg-cyan-950 rounded-lg border border-cyan-200 dark:border-cyan-800">
                      <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 mb-1">
                        <Home className="w-4 h-4" />
                        <span className="font-medium">Cities</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{templatePreview.city_count || 27}+</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                        <FileCode className="w-4 h-4" />
                        <span className="font-medium">HTML Size</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{templatePreview.html ? `${(templatePreview.html.length / 1024).toFixed(1)} KB` : 'N/A'}</p>
                    </div>
                  </div>

                  {/* Template Preview iframe */}
                  <div className="border rounded-xl overflow-hidden bg-white">
                    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-b">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-400"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                          <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>
                        <span className="text-sm text-muted-foreground ml-4 font-mono">
                          durable-medical-equipment-in-{templatePreview.sample_slug || 'virginia'}.html
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={openTemplateInNewTab}
                        className="h-7"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Full Screen
                      </Button>
                    </div>
                    <div className="relative" style={{ height: '600px' }}>
                      <iframe
                        srcDoc={templatePreview.html}
                        className="w-full h-full border-0"
                        title="Location Page Template Preview"
                        sandbox="allow-scripts"
                      />
                    </div>
                  </div>

                  {/* Template Sections Info */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-dashed">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Eye className="w-4 h-4 text-lime-600" />
                          Template Sections
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>Top header with phone & location</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>Navigation bar with logo</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>Hero section with CTA buttons</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="font-medium text-lime-600">Coverage Stats Box (Counties, Cities, 100%)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>&quot;Why Choose Us&quot; benefits</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>About section with trust badges</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>Coverage area links (for states)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>Contact form</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            <span>Eligibility check modal</span>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>

                    <Card className="border-dashed">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Code className="w-4 h-4 text-blue-600" />
                          Dynamic Variables
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm font-mono">
                          <li className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">{'{name}'}</span>
                            <span className="text-muted-foreground">Location name</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">{'{slug}'}</span>
                            <span className="text-muted-foreground">URL-friendly name</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">{'{geo_code}'}</span>
                            <span className="text-muted-foreground">Geo region code</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">{'{type}'}</span>
                            <span className="text-muted-foreground">state/county/city</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">{'{children}'}</span>
                            <span className="text-muted-foreground">Sub-location links</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">{'{parent}'}</span>
                            <span className="text-muted-foreground">Parent breadcrumb</span>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  {/* AI Template Editor */}
                  <AITemplateEditor templatePreview={templatePreview} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}

      {/* Products Tool */}
      {activeDevTool === 'products' && (
        <ProductCatalogManager />
      )}

      {/* General Settings Tool */}
      {activeDevTool === 'general-settings' && (
        <GeneralSettingsManager />
      )}

      {/* Storage Settings (iDrive E2) */}
      {activeDevTool === 'storage' && (
        <StorageSettings />
      )}

      {/* Onboarding Documents */}
      {activeDevTool === 'onboarding' && (
        <OnboardingDocuments isSuperAdmin={true} />
      )}

      {/* Patient Documents */}
      {activeDevTool === 'patient-docs' && (
        <PatientDocuments isSuperAdmin={true} />
      )}

      {/* Site Documents */}
      {activeDevTool === 'site-docs' && (
        <SiteDocuments />
      )}

      {/* Features Manager */}
      {activeDevTool === 'features' && (
        <FeaturesManager />
      )}

      {/* Site Rules Tool */}
      {activeDevTool === 'site-rules' && (
        <SiteRulesManager />
      )}

      {/* Database Manager Tool */}
      {activeDevTool === 'database' && (
        <DatabaseManager />
      )}

      {/* Location Generator */}
      {activeDevTool === 'location-generator' && (
        <LocationGenerator />
      )}

      {/* Location Generator V2 — Programmatic SEO */}
      {activeDevTool === 'location-generator-v2' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <h2 className="text-xl font-semibold">Location Generator V2</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Programmatic SEO engine — generates pages for every state, county, and city in the US.
            Click <strong>Open Full Editor</strong> to create generators and bulk-generate thousands of location pages.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => navigate('/dev-settings/page-generator')}
              className="gap-2"
              data-testid="open-loc-gen-v2-btn"
            >
              <FileCode className="h-4 w-4" />
              Open Full Editor
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/coverage-areas', '_blank')}
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              View Coverage Areas
            </Button>
          </div>
        </div>
      )}

      {/* SEO & Search Engine Tools */}
      {activeDevTool === 'seo-tools' && (
        <SEOToolsManager />
      )}

      {/* Fax Settings (Telnyx) */}
      {activeDevTool === 'fax' && (
        <FaxSettings />
      )}

      {/* Newsletter Manager */}
      {activeDevTool === 'newsletter' && (
        <NewsletterManager />
      )}

      {/* Directory Submission Manager */}
      {activeDevTool === 'directory-submission' && (
        <DirectorySubmissionManager />
      )}

      {/* Live Chat Dashboard */}
      {activeDevTool === 'live-chat' && (
        <ChatDashboard />
      )}

      {/* Phone Billing Settings (Super User Only) */}
      {activeDevTool === 'phone-billing' && isSuperUser() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Communication Billing Settings
            </CardTitle>
            <CardDescription>
              Configure call and SMS cost calculation and markup rates for internal billing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Voice Billing Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                <Phone className="w-4 h-4" />
                Voice Calls
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="per_minute_rate">Per Minute Rate ($)</Label>
                  <Input
                    id="per_minute_rate"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={billingConfig.per_minute_rate}
                    onChange={(e) => setBillingConfig({
                      ...billingConfig,
                      per_minute_rate: parseFloat(e.target.value) || 0
                    })}
                    data-testid="per-minute-rate-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Default Telnyx rate is $0.0085/min. Adjust based on your plan.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="markup_percentage">Voice Markup (%)</Label>
                  <Input
                    id="markup_percentage"
                    type="number"
                    step="0.1"
                    min="0"
                    max="500"
                    value={billingConfig.markup_percentage}
                    onChange={(e) => setBillingConfig({
                      ...billingConfig,
                      markup_percentage: parseFloat(e.target.value) || 0
                    })}
                    data-testid="markup-percentage-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional markup added to base call costs.
                  </p>
                </div>
              </div>
            </div>

            {/* SMS Billing Section */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-green-700">
                <MessageSquare className="w-4 h-4" />
                SMS Messages
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sms_outbound_rate">Outbound SMS Rate ($)</Label>
                  <Input
                    id="sms_outbound_rate"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={billingConfig.sms_outbound_rate}
                    onChange={(e) => setBillingConfig({
                      ...billingConfig,
                      sms_outbound_rate: parseFloat(e.target.value) || 0
                    })}
                    data-testid="sms-outbound-rate-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: $0.004/msg
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms_inbound_rate">Inbound SMS Rate ($)</Label>
                  <Input
                    id="sms_inbound_rate"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={billingConfig.sms_inbound_rate}
                    onChange={(e) => setBillingConfig({
                      ...billingConfig,
                      sms_inbound_rate: parseFloat(e.target.value) || 0
                    })}
                    data-testid="sms-inbound-rate-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: $0.004/msg
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms_markup_percentage">SMS Markup (%)</Label>
                  <Input
                    id="sms_markup_percentage"
                    type="number"
                    step="0.1"
                    min="0"
                    max="500"
                    value={billingConfig.sms_markup_percentage}
                    onChange={(e) => setBillingConfig({
                      ...billingConfig,
                      sms_markup_percentage: parseFloat(e.target.value) || 0
                    })}
                    data-testid="sms-markup-percentage-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional SMS markup.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Cost Preview */}
            <div className="p-4 bg-muted rounded-lg space-y-4">
              <p className="text-sm font-medium">Cost Preview</p>
              
              {/* Voice Costs */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Voice Calls</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">1 minute</p>
                    <p className="font-mono">${((1 * billingConfig.per_minute_rate) * (1 + billingConfig.markup_percentage / 100)).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">5 minutes</p>
                    <p className="font-mono">${((5 * billingConfig.per_minute_rate) * (1 + billingConfig.markup_percentage / 100)).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">10 minutes</p>
                    <p className="font-mono">${((10 * billingConfig.per_minute_rate) * (1 + billingConfig.markup_percentage / 100)).toFixed(4)}</p>
                  </div>
                </div>
              </div>
              
              {/* SMS Costs */}
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2 font-medium">SMS Messages</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">1 outbound SMS</p>
                    <p className="font-mono">${(billingConfig.sms_outbound_rate * (1 + billingConfig.sms_markup_percentage / 100)).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">10 outbound SMS</p>
                    <p className="font-mono">${((10 * billingConfig.sms_outbound_rate) * (1 + billingConfig.sms_markup_percentage / 100)).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">100 outbound SMS</p>
                    <p className="font-mono">${((100 * billingConfig.sms_outbound_rate) * (1 + billingConfig.sms_markup_percentage / 100)).toFixed(4)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveBillingConfig} disabled={savingBilling} data-testid="save-billing-btn">
                {savingBilling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Billing Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SMS Settings */}
      {activeDevTool === 'sms-settings' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              SMS Settings
            </CardTitle>
            <CardDescription>
              Configure Telnyx SMS for sending and receiving text messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Badge */}
            {smsStatus && (
              <div className={`p-4 rounded-lg ${smsStatus.configured ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${smsStatus.configured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="font-medium">
                    {smsStatus.configured ? 'SMS Configured' : 'SMS Not Configured'}
                  </span>
                </div>
                {smsStatus.phone_number && (
                  <p className="text-sm text-muted-foreground mt-1">Phone: {smsStatus.phone_number}</p>
                )}
              </div>
            )}

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Enable SMS</p>
                <p className="text-sm text-muted-foreground">Allow sending and receiving SMS messages</p>
              </div>
              <Button
                variant={smsConfig.enabled ? "default" : "outline"}
                onClick={() => setSmsConfig({ ...smsConfig, enabled: !smsConfig.enabled })}
              >
                {smsConfig.enabled ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            {/* API Configuration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sms_api_key">Telnyx API Key</Label>
                <Input
                  id="sms_api_key"
                  type="password"
                  value={smsConfig.api_key}
                  onChange={(e) => setSmsConfig({ ...smsConfig, api_key: e.target.value })}
                  placeholder="Enter your Telnyx API key"
                />
                <p className="text-xs text-muted-foreground">
                  Uses the same API key as Voice if left blank
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="messaging_profile_id">Messaging Profile ID</Label>
                <Input
                  id="messaging_profile_id"
                  value={smsConfig.messaging_profile_id}
                  onChange={(e) => setSmsConfig({ ...smsConfig, messaging_profile_id: e.target.value })}
                  placeholder="e.g., 40017090-f0e4-..."
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your Telnyx Portal under Messaging → Profiles
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sms_phone_number">SMS Phone Number</Label>
                <Input
                  id="sms_phone_number"
                  value={smsConfig.phone_number}
                  onChange={(e) => setSmsConfig({ ...smsConfig, phone_number: e.target.value })}
                  placeholder="+15551234567"
                />
                <p className="text-xs text-muted-foreground">
                  Your Telnyx phone number for sending SMS (E.164 format)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sms_webhook_url">Webhook URL (for receiving SMS)</Label>
                <Input
                  id="sms_webhook_url"
                  value={smsConfig.webhook_url || `${window.location.origin}/api/sms/webhook`}
                  onChange={(e) => setSmsConfig({ ...smsConfig, webhook_url: e.target.value })}
                  placeholder="https://your-domain.com/api/sms/webhook"
                />
                <p className="text-xs text-muted-foreground">
                  Configure this URL in Telnyx Portal to receive incoming SMS
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveSmsConfig} disabled={savingSms}>
                {savingSms ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save SMS Settings</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Security Settings Section */}
      {activeDevTool === 'security' && (
        <Card data-testid="security-settings-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              API Security & Encrypted Lead Transmission
            </CardTitle>
            <CardDescription>
              HIPAA-compliant encrypted API communication for lead submissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status */}
            {securityConfig && (
              <div className={`p-4 rounded-lg ${securityConfig.enabled ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-lime-50 border border-lime-200 dark:bg-amber-900/20 dark:border-lime-800'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${securityConfig.enabled ? 'bg-green-500' : 'bg-lime-500'}`} />
                  <span className="font-medium">
                    {securityConfig.enabled ? 'Encrypted Transmission Active' : 'Encryption Not Configured'}
                  </span>
                </div>
                {securityConfig.enabled && (
                  <p className="text-sm text-muted-foreground mt-1">
                    All lead form submissions are encrypted with {securityConfig.algorithm}
                  </p>
                )}
              </div>
            )}

            {/* Encryption Details */}
            {securityConfig?.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-sm">Encryption Algorithm</span>
                  </div>
                  <p className="text-lg font-mono">{securityConfig.algorithm}</p>
                  <p className="text-xs text-muted-foreground mt-1">256-bit encryption strength</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-sm">Key Derivation</span>
                  </div>
                  <p className="text-lg font-mono">{securityConfig.key_derivation}</p>
                  <p className="text-xs text-muted-foreground mt-1">100,000 iterations</p>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="space-y-3">
              <h3 className="font-medium">Security Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { icon: Lock, title: 'AES-256-GCM Encryption', desc: 'Military-grade encryption for all lead data', active: securityConfig?.enabled },
                  { icon: Key, title: 'HMAC-SHA256 Signatures', desc: 'Request integrity verification', active: securityConfig?.enabled },
                  { icon: Shield, title: 'Replay Attack Prevention', desc: 'Timestamp validation within 5 minutes', active: securityConfig?.enabled },
                  { icon: AlertTriangle, title: 'Rate Limiting', desc: '10 requests per minute per IP', active: true }
                ].map((feature, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${feature.active ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 bg-gray-50 dark:bg-gray-900/20'}`}>
                    <div className="flex items-center gap-2">
                      <feature.icon className={`w-4 h-4 ${feature.active ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="font-medium text-sm">{feature.title}</span>
                      {feature.active && <CheckCircle className="w-3 h-3 text-green-600 ml-auto" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Logs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Security Logs</h3>
                <Button variant="outline" size="sm" onClick={loadSecurityLogs} disabled={loadingSecurityLogs}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingSecurityLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              
              {loadingSecurityLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : securityLogs.length === 0 ? (
                <div className="text-center py-8 bg-muted rounded-lg">
                  <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No security events logged</p>
                  <p className="text-xs text-muted-foreground mt-1">Security events will appear here when detected</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-medium">Time</th>
                        <th className="text-left py-2 px-3 text-xs font-medium">Type</th>
                        <th className="text-left py-2 px-3 text-xs font-medium">IP Address</th>
                        <th className="text-left py-2 px-3 text-xs font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {securityLogs.slice(0, 10).map((log, idx) => (
                        <tr key={idx} className="border-t hover:bg-muted/50">
                          <td className="py-2 px-3 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="py-2 px-3">
                            <Badge variant={log.type === 'invalid_signature' ? 'destructive' : 'secondary'} className="text-xs">
                              {log.type}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-xs font-mono">{log.ip_address}</td>
                          <td className="py-2 px-3 text-xs text-muted-foreground truncate max-w-[200px]">
                            {log.error || log.user_agent?.substring(0, 30) || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>How it works:</strong> When a user submits a lead form, the data is encrypted in their browser using AES-256-GCM encryption before transmission. The server verifies the HMAC signature and decrypts the data, ensuring end-to-end security for HIPAA compliance.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plugin Installer */}
      {activeDevTool === 'plugins' && (
        <ComponentInstaller />
      )}

      {/* Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold">{previewHtml.location_name}</h3>
                <p className="text-sm text-muted-foreground">{previewHtml.filename}</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDownloadPage(previewHtml.id, previewHtml.filename)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <iframe 
                srcDoc={previewHtml.html_content}
                className="w-full h-full min-h-[600px]"
                title="Page Preview"
              />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
