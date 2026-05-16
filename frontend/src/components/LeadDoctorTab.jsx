import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Loader2, Save, Search, Stethoscope, X, Download, Link2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const createEntryId = () => `doc-link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getHeaders = () => {
  const token = localStorage.getItem('dme_token');
  return { Authorization: `Bearer ${token}` };
};

const getProductNumber = (product) => {
  if (product?.sku) return product.sku;
  if (Array.isArray(product?.hcpcs_codes) && product.hcpcs_codes.length > 0) return product.hcpcs_codes[0];
  return product?.id || 'N/A';
};

const normalizeProduct = (product) => ({
  product_id: product.product_id || product.id,
  name: product.name,
  sku: product.sku || null,
  hcpcs_codes: Array.isArray(product.hcpcs_codes) ? product.hcpcs_codes : [],
});

const normalizeDoctorLink = (entry) => ({
  entry_id: entry.entry_id || createEntryId(),
  doctor_id: entry.doctor_id || entry.id || null,
  first_name: entry.first_name || '',
  last_name: entry.last_name || '',
  email: entry.email || '',
  phone: entry.phone || '',
  fax: entry.fax || '',
  npi: entry.npi || '',
  specialty: entry.specialty || '',
  practice_name: entry.practice_name || '',
  state: entry.state || '',
  address: entry.address || '',
  linked_products: (entry.linked_products || []).map(normalizeProduct),
});

const normalizeDoctorDirectoryRecord = (doctor) => ({
  entry_id: createEntryId(),
  doctor_id: doctor.doctor_id || doctor.id || null,
  first_name: doctor.first_name || '',
  last_name: doctor.last_name || '',
  email: doctor.email || '',
  phone: doctor.phone || '',
  fax: doctor.fax || '',
  npi: doctor.npi || '',
  specialty: doctor.specialty || '',
  practice_name: doctor.practice_name || '',
  state: doctor.state || '',
  address: doctor.address || '',
  linked_products: [],
});

const getDoctorDisplayName = (doctor) => `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim();

export const LeadDoctorTab = ({ leadId, lead, onSaved }) => {
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchingDoctors, setSearchingDoctors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importingDoctor, setImportingDoctor] = useState(false);

  const [productCatalog, setProductCatalog] = useState([]);

  const [doctorLinks, setDoctorLinks] = useState([]);
  const [doctorSearchFilters, setDoctorSearchFilters] = useState({
    name: '',
    state: '',
    city: '',
    npi: '',
  });
  const [doctorSearchResults, setDoctorSearchResults] = useState([]);
  const [selectedDoctorPreview, setSelectedDoctorPreview] = useState(null);
  const [npiSearchError, setNpiSearchError] = useState('');
  const [productSearchByDoctor, setProductSearchByDoctor] = useState({});

  useEffect(() => {
    const existingLinks = (lead?.doctor_links || lead?.linked_doctors || []).map(normalizeDoctorLink);
    setDoctorLinks(existingLinks);
  }, [lead]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const productsRes = await axios.get(`${API_URL}/api/dev/products`, { headers: getHeaders() });
        const products = Array.isArray(productsRes.data) ? productsRes.data.filter((p) => p.enabled !== false) : [];
        setProductCatalog(products);
      } catch (error) {
        toast.error('Failed to load product catalog');
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  const addDoctorFromRecord = (doctorRecord) => {
    const normalized = normalizeDoctorDirectoryRecord(doctorRecord);
    const alreadyLinked = doctorLinks.some((entry) => {
      if (entry.npi && normalized.npi) return entry.npi === normalized.npi;
      if (entry.doctor_id && normalized.doctor_id) return entry.doctor_id === normalized.doctor_id;
      return false;
    });

    if (alreadyLinked) {
      toast.info('This doctor is already linked to this lead.');
      return;
    }

    setDoctorLinks((prev) => [...prev, normalized]);
    toast.success('Doctor linked to this lead');
  };

  const removeDoctor = (entryId) => {
    setDoctorLinks((prev) => prev.filter((entry) => entry.entry_id !== entryId));
  };

  const setProductSearchTerm = (entryId, value) => {
    setProductSearchByDoctor((prev) => ({ ...prev, [entryId]: value }));
  };

  const getFilteredProductsForDoctor = (entryId) => {
    const query = (productSearchByDoctor[entryId] || '').trim().toLowerCase();
    if (!query) return [];

    return productCatalog
      .filter((product) => {
        const hcpcs = Array.isArray(product.hcpcs_codes) ? product.hcpcs_codes.join(' ').toLowerCase() : '';
        return (
          product.name?.toLowerCase().includes(query) ||
          product.sku?.toLowerCase().includes(query) ||
          hcpcs.includes(query)
        );
      })
      .slice(0, 8);
  };

  const runDoctorSearch = async () => {
    const { name, state, city, npi } = doctorSearchFilters;
    if (![name, state, city, npi].some((value) => value.trim())) {
      toast.error('Please enter at least one search filter.');
      return;
    }

    setSearchingDoctors(true);
    setNpiSearchError('');

    try {
      const params = {};
      if (name.trim()) params.name = name.trim();
      if (state.trim()) params.state = state.trim().toUpperCase();
      if (city.trim()) params.city = city.trim();
      if (npi.trim()) params.npi = npi.trim();

      const response = await axios.get(`${API_URL}/api/doctors/unified-search`, {
        headers: getHeaders(),
        params,
      });

      const results = response.data?.results || [];
      setDoctorSearchResults(results);
      setSelectedDoctorPreview(results[0] || null);

      if (response.data?.npi_error) {
        setNpiSearchError('NPI registry is temporarily unavailable. Showing local doctors only.');
      }

      if (!results.length) {
        toast.info('No doctors matched this search.');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Doctor search failed');
    } finally {
      setSearchingDoctors(false);
    }
  };

  const importSelectedDoctorFromNpi = async () => {
    if (!selectedDoctorPreview?.npi) {
      toast.error('Select an NPI doctor from search results first.');
      return;
    }

    if (selectedDoctorPreview.already_local && selectedDoctorPreview.doctor_id) {
      addDoctorFromRecord(selectedDoctorPreview);
      return;
    }

    setImportingDoctor(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/doctors/import-from-npi`,
        { npi: selectedDoctorPreview.npi },
        { headers: getHeaders() }
      );

      const importedDoctor = response.data?.doctor;
      if (!importedDoctor) {
        throw new Error('Doctor import returned no doctor data');
      }

      const importedForPreview = {
        ...importedDoctor,
        doctor_id: importedDoctor.id,
        source: 'local+registry',
        already_local: true,
        import_needed: false,
      };

      setDoctorSearchResults((prev) =>
        prev.map((item) => (item.npi === importedForPreview.npi ? importedForPreview : item))
      );
      setSelectedDoctorPreview(importedForPreview);
      addDoctorFromRecord(importedForPreview);

      if (response.data?.action === 'updated') {
        toast.success('Doctor updated from NPI and linked.');
      } else if (response.data?.action === 'already_exists') {
        toast.success('Doctor already exists locally and was linked.');
      } else {
        toast.success('Doctor imported from NPI and linked.');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to import doctor from NPI');
    } finally {
      setImportingDoctor(false);
    }
  };

  const addProductToDoctor = (entryId, product) => {
    const normalized = normalizeProduct(product);

    setDoctorLinks((prev) =>
      prev.map((entry) => {
        if (entry.entry_id !== entryId) return entry;

        const alreadyLinked = (entry.linked_products || []).some(
          (linkedProduct) => linkedProduct.product_id === normalized.product_id
        );

        if (alreadyLinked) return entry;
        return { ...entry, linked_products: [...(entry.linked_products || []), normalized] };
      })
    );

    setProductSearchTerm(entryId, '');
  };

  const removeProductFromDoctor = (entryId, productId) => {
    setDoctorLinks((prev) =>
      prev.map((entry) => {
        if (entry.entry_id !== entryId) return entry;
        return {
          ...entry,
          linked_products: (entry.linked_products || []).filter((product) => product.product_id !== productId),
        };
      })
    );
  };

  const saveDoctorLinks = async () => {
    setSaving(true);
    try {
      const sanitizedLinks = doctorLinks.map(({ entry_id, ...entry }) => ({
        ...entry,
        linked_products: (entry.linked_products || []).map(normalizeProduct),
      }));

      await axios.put(
        `${API_URL}/api/leads/${leadId}/doctor-links`,
        { doctor_links: sanitizedLinks },
        { headers: getHeaders() }
      );

      toast.success('Doctor tab data saved');
      onSaved?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save doctor tab data');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="lead-doctor-tab-container">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="w-5 h-5" />
            Doctor Search (Local + NPI Registry)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <Label className="mb-2 block" htmlFor="lead-doctor-search-name-input">Doctor Name</Label>
              <Input
                id="lead-doctor-search-name-input"
                placeholder="Dr first/last name"
                value={doctorSearchFilters.name}
                onChange={(e) => setDoctorSearchFilters((prev) => ({ ...prev, name: e.target.value }))}
                data-testid="lead-doctor-search-name-input"
              />
            </div>
            <div>
              <Label className="mb-2 block" htmlFor="lead-doctor-search-state-input">State</Label>
              <Input
                id="lead-doctor-search-state-input"
                placeholder="FL"
                maxLength={2}
                value={doctorSearchFilters.state}
                onChange={(e) => setDoctorSearchFilters((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))}
                data-testid="lead-doctor-search-state-input"
              />
            </div>
            <div>
              <Label className="mb-2 block" htmlFor="lead-doctor-search-city-input">City</Label>
              <Input
                id="lead-doctor-search-city-input"
                placeholder="Tampa"
                value={doctorSearchFilters.city}
                onChange={(e) => setDoctorSearchFilters((prev) => ({ ...prev, city: e.target.value }))}
                data-testid="lead-doctor-search-city-input"
              />
            </div>
            <div>
              <Label className="mb-2 block" htmlFor="lead-doctor-search-npi-input">NPI</Label>
              <Input
                id="lead-doctor-search-npi-input"
                placeholder="10-digit NPI"
                value={doctorSearchFilters.npi}
                onChange={(e) => setDoctorSearchFilters((prev) => ({ ...prev, npi: e.target.value.replace(/[^0-9]/g, '') }))}
                data-testid="lead-doctor-search-npi-input"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" onClick={runDoctorSearch} disabled={searchingDoctors} data-testid="lead-doctor-unified-search-button">
              {searchingDoctors ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Search Local + NPI
            </Button>
            {npiSearchError && <p className="text-xs text-amber-700" data-testid="lead-doctor-npi-warning-text">{npiSearchError}</p>}
          </div>

          {(doctorSearchResults.length > 0 || selectedDoctorPreview) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-testid="lead-doctor-search-and-preview-panel">
              <div className="rounded-lg border overflow-hidden" data-testid="lead-doctor-search-results-panel">
                <div className="px-3 py-2 bg-muted/50 border-b text-sm font-medium">Search Results</div>
                <div className="max-h-72 overflow-y-auto">
                  {doctorSearchResults.map((result, index) => (
                    <button
                      key={`${result.npi || result.doctor_id || index}`}
                      type="button"
                      className={`w-full text-left px-3 py-3 border-b hover:bg-muted/50 ${selectedDoctorPreview?.npi === result.npi ? 'bg-muted/60' : ''}`}
                      onClick={() => setSelectedDoctorPreview(result)}
                      data-testid={`lead-doctor-search-result-row-${index}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">Dr. {result.first_name || ''} {result.last_name || ''}</p>
                        <Badge variant="outline" data-testid={`lead-doctor-search-result-source-${index}`}>
                          {result.source || 'local'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        NPI: {result.npi || 'N/A'} • Fax: {result.fax || 'N/A'} • {result.practice_name || 'Practice N/A'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-3" data-testid="lead-doctor-preview-panel">
                {!selectedDoctorPreview ? (
                  <p className="text-sm text-muted-foreground">Select a doctor to preview details before import/link.</p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-base">Dr. {selectedDoctorPreview.first_name || ''} {selectedDoctorPreview.last_name || ''}</h3>
                      <p className="text-xs text-muted-foreground">{selectedDoctorPreview.practice_name || 'Practice not provided'} • {selectedDoctorPreview.specialty || 'Specialty not provided'}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">NPI:</span> {selectedDoctorPreview.npi || 'N/A'}</div>
                      <div><span className="text-muted-foreground">Fax:</span> {selectedDoctorPreview.fax || 'N/A'}</div>
                      <div><span className="text-muted-foreground">Phone:</span> {selectedDoctorPreview.phone || 'N/A'}</div>
                      <div><span className="text-muted-foreground">Email:</span> {selectedDoctorPreview.email || 'N/A'}</div>
                      <div><span className="text-muted-foreground">State:</span> {selectedDoctorPreview.state || 'N/A'}</div>
                      <div><span className="text-muted-foreground">City:</span> {selectedDoctorPreview.city || 'N/A'}</div>
                      <div className="md:col-span-2"><span className="text-muted-foreground">Address:</span> {selectedDoctorPreview.address || 'N/A'}</div>
                    </div>

                    <Button
                      type="button"
                      onClick={importSelectedDoctorFromNpi}
                      disabled={importingDoctor}
                      data-testid="lead-doctor-preview-import-link-button"
                    >
                      {importingDoctor ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : selectedDoctorPreview.already_local ? (
                        <Link2 className="w-4 h-4 mr-2" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      {selectedDoctorPreview.already_local ? 'Link Existing Doctor' : 'Import to Directory & Link'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loadingProducts ? (
        <Card>
          <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground" data-testid="lead-doctor-tab-loading-state">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading product directory...
          </CardContent>
        </Card>
      ) : doctorLinks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground" data-testid="lead-doctor-tab-empty-state">
            Search and add a doctor, then link one or more products for this lead.
          </CardContent>
        </Card>
      ) : (
        doctorLinks.map((entry, index) => {
          const doctorName = getDoctorDisplayName(entry) || 'Unnamed doctor';
          const productResults = getFilteredProductsForDoctor(entry.entry_id);
          const productSearch = productSearchByDoctor[entry.entry_id] || '';

          return (
            <Card key={entry.entry_id} data-testid={`lead-doctor-linked-card-${index}`}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-base">Dr. {doctorName}</h3>
                        <p className="text-xs text-muted-foreground">{entry.practice_name || 'Practice not set'} • {entry.specialty || 'Specialty not set'}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDoctor(entry.entry_id)}
                        data-testid={`lead-doctor-remove-button-${index}`}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Email:</span> {entry.email || 'N/A'}</div>
                      <div><span className="text-muted-foreground">Phone:</span> {entry.phone || 'N/A'}</div>
                      <div><span className="text-muted-foreground">Fax:</span> {entry.fax || 'N/A'}</div>
                      <div><span className="text-muted-foreground">NPI:</span> {entry.npi || 'N/A'}</div>
                      <div><span className="text-muted-foreground">State:</span> {entry.state || 'N/A'}</div>
                      <div><span className="text-muted-foreground">Doctor ID:</span> {entry.doctor_id || 'Imported/linked'}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor={`lead-doctor-product-search-${entry.entry_id}`}>Product search (number + name)</Label>
                    <div className="relative">
                      <Input
                        id={`lead-doctor-product-search-${entry.entry_id}`}
                        placeholder="Type product name, SKU, or HCPCS"
                        value={productSearch}
                        onChange={(e) => setProductSearchTerm(entry.entry_id, e.target.value)}
                        data-testid={`lead-doctor-product-search-input-${index}`}
                      />

                      {productSearch.trim() && productResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-64 overflow-y-auto" data-testid={`lead-doctor-product-results-${index}`}>
                          {productResults.map((product) => (
                            <button
                              type="button"
                              key={product.id}
                              className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0"
                              onClick={() => addProductToDoctor(entry.entry_id, product)}
                              data-testid={`lead-doctor-product-result-${index}-${product.id}`}
                            >
                              <p className="font-medium text-sm">{getProductNumber(product)} • {product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.short_description || 'DME product'}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2" data-testid={`lead-doctor-linked-products-${index}`}>
                      {(entry.linked_products || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No linked products yet.</p>
                      ) : (
                        entry.linked_products.map((product) => (
                          <Badge key={product.product_id} variant="outline" className="flex items-center gap-1 px-2 py-1">
                            {product.sku || product.hcpcs_codes?.[0] || 'N/A'} • {product.name}
                            <button
                              type="button"
                              onClick={() => removeProductFromDoctor(entry.entry_id, product.product_id)}
                              className="ml-1"
                              data-testid={`lead-doctor-remove-product-${index}-${product.product_id}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <div className="flex justify-end">
        <Button onClick={saveDoctorLinks} disabled={saving} data-testid="lead-doctor-tab-save-button">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Doctor Tab
        </Button>
      </div>
    </div>
  );
};
