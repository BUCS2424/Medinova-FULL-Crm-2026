import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import {
  MapPin,
  Building,
  Globe,
  FileText,
  Loader2,
  Check,
  Trash2,
  ExternalLink,
  Eye,
  RefreshCw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LocationGenerator() {
  const [stats, setStats] = useState({
    states: 50,
    counties: 0,
    cities: 0,
    generatedPages: 0
  });
  const [usStates, setUsStates] = useState([]);
  const [generatedByState, setGeneratedByState] = useState({});
  const [loading, setLoading] = useState(true);
  const [generatingState, setGeneratingState] = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [deletingState, setDeletingState] = useState(null);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const [statesRes, pagesRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/dev/us-states`, { headers }),
        axios.get(`${API_URL}/api/dev/generated-pages-grouped`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/dev/location-stats`, { headers }).catch(() => ({ data: {} }))
      ]);
      
      setUsStates(statesRes.data || []);
      
      // Build generated pages by state
      const byState = {};
      if (Array.isArray(pagesRes.data)) {
        pagesRes.data.forEach(group => {
          byState[group.state_slug] = group.count;
        });
      }
      setGeneratedByState(byState);
      
      // Calculate stats
      let totalCounties = 0;
      let totalCities = 0;
      (statesRes.data || []).forEach(state => {
        totalCounties += state.county_count || 0;
        totalCities += state.city_count || 0;
      });
      
      const totalGenerated = Object.values(byState).reduce((a, b) => a + b, 0);
      
      setStats({
        states: 50,
        counties: totalCounties,
        cities: totalCities,
        generatedPages: totalGenerated
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load location data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateState = async (stateSlug) => {
    setGeneratingState(stateSlug);
    try {
      const headers = getHeaders();
      const response = await axios.post(
        `${API_URL}/api/dev/generate-state/${stateSlug}`,
        {},
        { headers }
      );
      
      toast.success(`Generated ${response.data.generated} pages for ${response.data.state}`);
      fetchData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate pages');
    } finally {
      setGeneratingState(null);
    }
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    const ungenerated = usStates.filter(s => !generatedByState[s.slug]);
    
    // Generate 5 at a time
    for (let i = 0; i < ungenerated.length; i += 5) {
      const batch = ungenerated.slice(i, i + 5);
      await Promise.all(batch.map(state => 
        axios.post(`${API_URL}/api/dev/generate-state/${state.slug}`, {}, { headers: getHeaders() })
          .catch(err => console.error(`Failed: ${state.name}`, err))
      ));
      
      toast.success(`Generated batch ${Math.floor(i/5) + 1} of ${Math.ceil(ungenerated.length/5)}`);
      await fetchData();
    }
    
    setGeneratingAll(false);
    toast.success('All states generated!');
  };

  const handleDeleteState = async (stateSlug) => {
    if (!window.confirm(`Delete all generated pages for this state?`)) return;
    
    setDeletingState(stateSlug);
    try {
      const headers = getHeaders();
      await axios.delete(`${API_URL}/api/dev/generated-pages/bulk/state/${stateSlug}`, { headers });
      toast.success('Pages deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete pages');
    } finally {
      setDeletingState(null);
    }
  };

  const handlePreviewSample = () => {
    // Open the preview template endpoint in a new tab
    const token = localStorage.getItem('dme_token');
    window.open(`${API_URL}/api/dev/preview-location-template`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ungeneratedCount = usStates.filter(s => !generatedByState[s.slug]).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700 dark:text-white" style={{ fontVariant: 'small-caps' }}>
            Location Generator
          </h1>
          <p className="text-muted-foreground">
            Generate location landing pages by state, county, and city.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreviewSample}>
            <Eye className="w-4 h-4 mr-2" />
            Preview Sample
          </Button>
          <Button 
            onClick={handleGenerateAll}
            disabled={generatingAll || ungeneratedCount === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {generatingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-2" />
                Generate All ({ungeneratedCount > 0 ? `${ungeneratedCount} at a time` : 'Done'})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-pink-400">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-pink-100 dark:bg-pink-900/30">
                <MapPin className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-navy-700 dark:text-white">{stats.states}</p>
                <p className="text-sm text-muted-foreground">States</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-400">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Building className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-navy-700 dark:text-white">{stats.counties.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Counties</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-amber-400">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Globe className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-navy-700 dark:text-white">{stats.cities.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Cities</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-lime-400">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-lime-100 dark:bg-lime-900/30">
                <FileText className="w-5 h-5 text-lime-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-navy-700 dark:text-white">{stats.generatedPages.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Generated Pages</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* US States Grid */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4 text-navy-700 dark:text-white">US States</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {usStates.map((state) => {
              const isGenerated = generatedByState[state.slug] > 0;
              const pageCount = generatedByState[state.slug] || 0;
              const isGenerating = generatingState === state.slug;
              const isDeleting = deletingState === state.slug;
              
              return (
                <Card 
                  key={state.slug} 
                  className={`relative ${isGenerated ? 'border-lime-200 bg-lime-50/30 dark:bg-lime-900/10' : ''}`}
                >
                  <CardContent className="pt-4 pb-4">
                    {/* Generated checkmark */}
                    {isGenerated && (
                      <div className="absolute top-3 right-3">
                        <Check className="w-5 h-5 text-lime-500" />
                      </div>
                    )}
                    
                    <h3 className="font-semibold text-navy-700 dark:text-white">{state.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {state.county_count} counties • {state.city_count} cities
                    </p>
                    
                    {isGenerated ? (
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-lime-600">{pageCount} pages</span>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(`/locations/${state.slug}`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteState(state.slug)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        className="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white"
                        size="sm"
                        onClick={() => handleGenerateState(state.slug)}
                        disabled={isGenerating || generatingAll}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate'
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
