import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  MapPin, 
  ChevronRight, 
  ChevronDown,
  BookOpen,
  Phone, 
  Loader2,
  Search,
  X,
  Building2,
  Home as HomeIcon,
  Globe,
  Users,
  Truck,
  CheckCircle,
  ArrowRight,
  Filter,
  Grid3X3,
  List,
  Lock
} from 'lucide-react';
import { PublicBrandLogo } from '../components/PublicBrandLogo';
import { PublicMobileMenu } from '../components/PublicMobileMenu';

const SITE_URL = 'https://medinovadme.com';
const OG_IMAGE = 'https://customer-assets.emergentagent.com/job_7965af6d-d9f9-48a9-9447-d2e9a0ead878/artifacts/e812a763_durable-medical-equipment-wheelchair.jpg';

// US Regions for filtering
const US_REGIONS = {
  'northeast': ['Connecticut', 'Maine', 'Massachusetts', 'New Hampshire', 'New Jersey', 'New York', 'Pennsylvania', 'Rhode Island', 'Vermont'],
  'southeast': ['Alabama', 'Arkansas', 'Florida', 'Georgia', 'Kentucky', 'Louisiana', 'Maryland', 'Mississippi', 'North Carolina', 'South Carolina', 'Tennessee', 'Virginia', 'West Virginia', 'Delaware'],
  'midwest': ['Illinois', 'Indiana', 'Iowa', 'Kansas', 'Michigan', 'Minnesota', 'Missouri', 'Nebraska', 'North Dakota', 'Ohio', 'South Dakota', 'Wisconsin'],
  'southwest': ['Arizona', 'New Mexico', 'Oklahoma', 'Texas'],
  'west': ['Alaska', 'California', 'Colorado', 'Hawaii', 'Idaho', 'Montana', 'Nevada', 'Oregon', 'Utah', 'Washington', 'Wyoming']
};

const REGION_COLORS = {
  'northeast': 'from-blue-500 to-indigo-600',
  'southeast': 'from-emerald-500 to-teal-600',
  'midwest': 'from-lime-500 to-lime-600',
  'southwest': 'from-red-500 to-rose-600',
  'west': 'from-purple-500 to-violet-600'
};

const REGION_LABELS = {
  'northeast': 'Northeast',
  'southeast': 'Southeast',
  'midwest': 'Midwest',
  'southwest': 'Southwest',
  'west': 'West'
};

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedState, setExpandedState] = useState(null);
  const [activeTab, setActiveTab] = useState('counties');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'pages'
  const [patientPortalEnabled, setPatientPortalEnabled] = useState(true);
  const menuItems = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'products', label: 'Products', href: '/products' },
    { key: 'service-areas', label: 'Coverage Areas', href: '/locations' },
    { key: 'resources', label: 'Medicare Resources', href: '/medicare-resources' },
    ...(patientPortalEnabled ? [{ key: 'login', label: 'Patient Login', href: '/login' }] : []),
  ];
  
  // Helper function to get location page URL - use clean /locations/ path
  const getLocationPageUrl = (file) => {
    // Clean slug for SEO - strip .html extension
    const slug = file ? file.replace(/\.html$/, '') : '';
    return `/locations/${slug}`;
  };

  useEffect(() => {
    fetchLocations();
    fetchPatientPortalFeature();
  }, []);

  const fetchPatientPortalFeature = async () => {
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${apiUrl}/api/features/patient_portal`);
      const data = await response.json();
      setPatientPortalEnabled(data.enabled);
    } catch (error) {
      console.error('Failed to fetch patient portal feature:', error);
      // Default to true if fetch fails
      setPatientPortalEnabled(true);
    }
  };

  const fetchLocations = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${API_URL}/api/public/locations`);
      const data = await response.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  // Get region for a state
  const getRegion = (stateName) => {
    for (const [region, states] of Object.entries(US_REGIONS)) {
      if (states.includes(stateName)) return region;
    }
    return 'other';
  };

  // Filter and sort locations
  const filteredLocations = useMemo(() => {
    let filtered = locations.filter(loc => {
      // Region filter
      if (selectedRegion !== 'all') {
        const region = getRegion(loc.name);
        if (region !== selectedRegion) return false;
      }
      
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (loc.name.toLowerCase().includes(term)) return true;
        if (loc.counties?.some(c => c.name.toLowerCase().includes(term))) return true;
        if (loc.cities?.some(c => c.name.toLowerCase().includes(term))) return true;
        return false;
      }
      return true;
    });

    // Sort
    if (sortBy === 'pages') {
      filtered.sort((a, b) => b.total_pages - a.total_pages);
    } else {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [locations, searchTerm, selectedRegion, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const totalPages = locations.reduce((sum, loc) => sum + loc.total_pages, 0);
    const totalCounties = locations.reduce((sum, loc) => sum + (loc.counties?.length || 0), 0);
    const totalCities = locations.reduce((sum, loc) => sum + (loc.cities?.length || 0), 0);
    return { totalPages, totalCounties, totalCities, totalStates: locations.length };
  }, [locations]);

  const toggleState = (stateSlug) => {
    setExpandedState(expandedState === stateSlug ? null : stateSlug);
    setActiveTab('counties');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-slate-800 to-navy-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-lime-500/30 rounded-full animate-pulse"></div>
            <Loader2 className="w-12 h-12 animate-spin text-lime-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-400 mt-6 text-lg">Loading service areas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>MediNova Medical Supplies | Medicare-covered Durable Medical Equipment Service Areas</title>
        <meta name="description" content="MediNova Medical Supplies delivers Medicare-covered durable medical equipment to all 50 states. Find your state to check eligibility and get free delivery." />
        <link rel="canonical" href={`${SITE_URL}/locations`} />
        <meta property="og:title" content="MediNova Medical Supplies Service Areas | Medicare-covered DME Nationwide" />
        <meta property="og:description" content="Explore MediNova Medical Supplies service areas across all 50 states, including county and city coverage pages for Medicare-covered equipment delivery." />
        <meta property="og:url" content={`${SITE_URL}/locations`} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MediNova Medical Supplies Service Areas | Medicare-covered DME Nationwide" />
        <meta name="twitter:description" content="Explore MediNova Medical Supplies service areas across all 50 states, including county and city coverage pages for Medicare-covered equipment delivery." />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'MediNova Medical Supplies Service Areas',
            url: `${SITE_URL}/locations`,
            description:
              'Explore nationwide DME delivery coverage areas from MediNova Medical Supplies, including state, county, and city service pages.',
            isPartOf: {
              '@type': 'WebSite',
              name: 'MediNova Medical Supplies',
              url: SITE_URL,
            },
          })}
        </script>
      </Helmet>
      {/* Header */}
      <header className="bg-navy-900 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <PublicBrandLogo testIdPrefix="locations-page-header-logo" />
            <div className="flex items-center gap-4">
              <nav className="hidden lg:flex items-center gap-6 text-sm text-gray-300">
                <a href="/products" className="hover:text-white transition-colors">Products</a>
                <a href="/locations" className="text-white font-semibold">Coverage Areas</a>
                <a href="/medicare-resources" className="hover:text-white transition-colors">Resources</a>
              </nav>
              <a 
                href="tel:2488864363" 
                className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
                data-testid="locations-page-call-button"
              >
                <Phone className="w-4 h-4" />
                (248) 886-4-DME
              </a>
              {patientPortalEnabled && (
                <a 
                  href="/login" 
                  className="hidden sm:inline-flex text-gray-300 hover:text-white transition-colors font-medium"
                  data-testid="patient-login-header"
                >
                  Patient Login
                </a>
              )}
              <div className="lg:hidden">
                <PublicMobileMenu
                  pageKey="locations-page"
                  items={menuItems}
                  title="Browse Coverage Areas"
                  description="Find your state, county, or city and connect with the MediNova Medical Supplies team fast."
                  primaryHref="/#contact"
                  primaryLabel="Check Eligibility"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-navy-900 via-slate-800 to-navy-900 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-10 left-10 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-8">
            <Link to="/" className="text-lime-400 hover:text-lime-300 transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4 text-gray-500" />
            <span className="text-gray-400">Service Areas</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                DME Service Areas
                <span className="block text-lime-400 mt-2">Nationwide Coverage</span>
              </h1>
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                We deliver Medicare-covered durable medical equipment to patients across the United States. 
                Find your state below to see local coverage details.
              </p>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                  <Globe className="w-6 h-6 text-lime-400 mb-2" />
                  <div className="text-2xl font-bold">{stats.totalStates}</div>
                  <div className="text-sm text-gray-400">States</div>
                </div>
                <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                  <Building2 className="w-6 h-6 text-blue-400 mb-2" />
                  <div className="text-2xl font-bold">{stats.totalCounties.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">Counties</div>
                </div>
                <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                  <HomeIcon className="w-6 h-6 text-emerald-400 mb-2" />
                  <div className="text-2xl font-bold">{stats.totalCities.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">Cities</div>
                </div>
                <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                  <Truck className="w-6 h-6 text-purple-400 mb-2" />
                  <div className="text-2xl font-bold">{stats.totalPages.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">Pages</div>
                </div>
              </div>
            </div>

            {/* Search Card */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-lime-400" />
                Find Your Location
              </h3>
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search states, counties, or cities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none text-white placeholder-gray-400 transition-all"
                  data-testid="locations-search-input"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {/* Quick Region Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedRegion('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedRegion === 'all' 
                      ? 'bg-lime-500 text-white' 
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  All Regions
                </button>
                {Object.keys(US_REGIONS).map(region => (
                  <button
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedRegion === region 
                        ? 'bg-lime-500 text-white' 
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {REGION_LABELS[region]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredLocations.length}</span> of {locations.length} states
            </span>
            {selectedRegion !== 'all' && (
              <span className="px-3 py-1 bg-lime-100 text-amber-800 rounded-full text-sm font-medium">
                {REGION_LABELS[selectedRegion]}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 outline-none"
            >
              <option value="name">Sort by Name</option>
              <option value="pages">Sort by Pages</option>
            </select>
            
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow text-lime-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-lime-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* States Grid/List */}
        {filteredLocations.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border shadow-sm">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Locations Found</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {searchTerm 
                ? `No locations match "${searchTerm}". Try a different search term.`
                : 'No service areas match your current filters.'
              }
            </p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedRegion('all'); }}
              className="mt-6 px-6 py-2 bg-lime-500 text-white rounded-lg hover:bg-lime-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="states-list">
            {filteredLocations.map((location) => {
              const region = getRegion(location.name);
              const regionColor = REGION_COLORS[region] || 'from-gray-500 to-gray-600';
              const isExpanded = expandedState === location.slug;
              
              return (
                <div
                  key={location.slug}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-lg ${
                    isExpanded ? 'ring-2 ring-lime-500 shadow-lg' : ''
                  }`}
                  data-testid={`state-${location.slug}`}
                  data-state-slug={location.slug}
                >
                  {/* State Header */}
                  <div className="relative">
                    <div className={`h-2 bg-gradient-to-r ${regionColor}`}></div>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 bg-gradient-to-br ${regionColor} rounded-xl flex items-center justify-center shadow-lg`}>
                            <MapPin className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-gray-900">{location.name}</h2>
                            <p className="text-xs text-gray-500 capitalize">{REGION_LABELS[region] || 'Other'} Region</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Stats Row */}
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {location.counties?.length || 0} counties
                        </span>
                        <span className="flex items-center gap-1">
                          <HomeIcon className="w-4 h-4 text-gray-400" />
                          {location.cities?.length || 0} cities
                        </span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2">
                        <a
                          href={getLocationPageUrl(location.file)} onClick={(e) => { e.preventDefault(); window.location.href = getLocationPageUrl(location.file); }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-lime-500 to-lime-600 text-white rounded-xl font-medium hover:from-lime-600 hover:to-lime-700 transition-all shadow-md hover:shadow-lg"
                        >
                          View State Page
                          <ArrowRight className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => toggleState(location.slug)}
                          className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
                            isExpanded 
                              ? 'bg-gray-900 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50">
                      {/* Tabs */}
                      <div className="flex border-b">
                        <button
                          onClick={() => setActiveTab('counties')}
                          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'counties'
                              ? 'text-lime-600 border-b-2 border-lime-500 bg-white'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Building2 className="w-4 h-4 inline mr-1" />
                          Counties ({location.counties?.length || 0})
                        </button>
                        <button
                          onClick={() => setActiveTab('cities')}
                          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'cities'
                              ? 'text-lime-600 border-b-2 border-lime-500 bg-white'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <HomeIcon className="w-4 h-4 inline mr-1" />
                          Cities ({location.cities?.length || 0})
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-4 max-h-60 overflow-y-auto">
                        {activeTab === 'counties' ? (
                          location.counties?.length > 0 ? (
                            <div className="grid grid-cols-2 gap-1">
                              {location.counties.map((county) => (
                                <a
                                  key={county.slug}
                                  href={getLocationPageUrl(county.file)} onClick={(e) => { e.preventDefault(); window.location.href = getLocationPageUrl(county.file); }}
                                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-lime-50 text-sm text-gray-700 hover:text-lime-700 transition-colors"
                                >
                                  <Building2 className="w-3 h-3 text-gray-400" />
                                  <span className="truncate">{county.name}</span>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm text-center py-4">No counties listed</p>
                          )
                        ) : (
                          location.cities?.length > 0 ? (
                            <div className="grid grid-cols-2 gap-1">
                              {location.cities.map((city) => (
                                <a
                                  key={city.slug}
                                  href={getLocationPageUrl(city.file)} onClick={(e) => { e.preventDefault(); window.location.href = getLocationPageUrl(city.file); }}
                                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-lime-50 text-sm text-gray-700 hover:text-lime-700 transition-colors"
                                >
                                  <HomeIcon className="w-3 h-3 text-gray-400" />
                                  <span className="truncate">{city.name}</span>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm text-center py-4">No cities listed</p>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-3" data-testid="states-list">
            {filteredLocations.map((location) => {
              const region = getRegion(location.name);
              const regionColor = REGION_COLORS[region] || 'from-gray-500 to-gray-600';
              const isExpanded = expandedState === location.slug;
              
              return (
                <div
                  key={location.slug}
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                    isExpanded ? 'ring-2 ring-lime-500' : ''
                  }`}
                  data-testid={`state-${location.slug}`}
                  data-state-slug={location.slug}
                >
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleState(location.slug)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 bg-gradient-to-br ${regionColor} rounded-xl flex items-center justify-center shadow`}>
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">{location.name}</h2>
                          <p className="text-sm text-gray-500">
                            {location.counties?.length || 0} counties • {location.cities?.length || 0} cities • {location.total_pages} pages
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="hidden sm:inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs capitalize">
                          {REGION_LABELS[region]}
                        </span>
                        <a
                          href={getLocationPageUrl(location.file)}
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.location.href = getLocationPageUrl(location.file); }}
                          className="hidden sm:flex items-center gap-1 text-lime-600 hover:text-lime-700 text-sm font-medium"
                        >
                          View Page
                          <ChevronRight className="w-4 h-4" />
                        </a>
                        <ChevronDown 
                          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t">
                      <div className="flex border-b bg-gray-50">
                        <button
                          onClick={() => setActiveTab('counties')}
                          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'counties'
                              ? 'text-lime-600 border-b-2 border-lime-500 bg-white'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Counties ({location.counties?.length || 0})
                        </button>
                        <button
                          onClick={() => setActiveTab('cities')}
                          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'cities'
                              ? 'text-lime-600 border-b-2 border-lime-500 bg-white'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Cities ({location.cities?.length || 0})
                        </button>
                      </div>

                      <div className="p-4 max-h-64 overflow-y-auto">
                        {activeTab === 'counties' ? (
                          location.counties?.length > 0 ? (
                            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {location.counties.map((county) => (
                                <a
                                  key={county.slug}
                                  href={getLocationPageUrl(county.file)} onClick={(e) => { e.preventDefault(); window.location.href = getLocationPageUrl(county.file); }}
                                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-lime-50 text-sm text-gray-700 hover:text-lime-700 transition-colors"
                                >
                                  <Building2 className="w-4 h-4 text-gray-400" />
                                  {county.name}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm text-center py-4">No counties listed</p>
                          )
                        ) : (
                          location.cities?.length > 0 ? (
                            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {location.cities.map((city) => (
                                <a
                                  key={city.slug}
                                  href={getLocationPageUrl(city.file)} onClick={(e) => { e.preventDefault(); window.location.href = getLocationPageUrl(city.file); }}
                                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-lime-50 text-sm text-gray-700 hover:text-lime-700 transition-colors"
                                >
                                  <HomeIcon className="w-4 h-4 text-gray-400" />
                                  {city.name}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm text-center py-4">No cities listed</p>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Features Section */}
        <section className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-lime-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-lime-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Free Delivery</h3>
            <p className="text-gray-600 text-sm">Medical equipment delivered directly to your home at no extra cost.</p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Medicare Approved</h3>
            <p className="text-gray-600 text-sm">We are a certified Medicare supplier with approved coverage.</p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Expert Support</h3>
            <p className="text-gray-600 text-sm">Our team helps you find the right equipment for your needs.</p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-16 bg-gradient-to-br from-navy-900 via-slate-800 to-navy-900 rounded-3xl p-10 md:p-12 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="relative">
            <h2 className="text-3xl font-bold mb-4">Do Not See Your Area?</h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto text-lg">
              We are constantly expanding our coverage. Call us today to check if we serve your location 
              or to learn about upcoming service areas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="tel:2488864363"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-white font-semibold px-8 py-4 rounded-xl transition-all text-lg shadow-lg shadow-amber-500/20"
              >
                <Phone className="w-5 h-5" />
                Call (248) 886-4-DME
              </a>
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-all border border-white/20"
              >
                Browse Products
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-navy-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3" data-testid="locations-page-footer-logo-wrap">
              <img src="/images/medinova/logo.webp" alt="MediNova Medical Supplies" className="h-10 max-w-[160px] object-contain brightness-0 invert opacity-90" data-testid="locations-page-footer-logo-image" />
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <Link to="/products" className="hover:text-white transition-colors">Products</Link>
              <Link to="/locations" className="hover:text-white transition-colors">Coverage Areas</Link>
              <span className="text-gray-600">|</span>
              <Link 
                to="/login" 
                className="hover:text-lime-400 transition-colors flex items-center gap-1"
                data-testid="admin-login-footer"
              >
                <Lock className="w-3 h-3" />
                Admin Login
              </Link>
            </div>
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} MediNova Medical Supplies. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
