import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
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
import { Plus, Building2, Edit, Trash2, Globe, Key, Tag, X, Wifi, WifiOff, Package, DollarSign, Truck, CheckCircle2, AlertCircle, Loader2, ShoppingCart, Eye, Images } from 'lucide-react';
import SupplierCatalogImages from '../components/SupplierCatalogImages';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Common product type suggestions
const PRODUCT_SUGGESTIONS = [
  'Wheelchairs', 'Walkers', 'Hospital Beds', 'CPAP/BiPAP', 'Oxygen Equipment',
  'Diabetic Supplies', 'Wound Care', 'Orthopedic', 'Bathroom Safety', 
  'Patient Lifts', 'Compression', 'Nebulizers', 'Mobility Aids', 'Braces'
];

export default function SuppliersPage({ embedded = false }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [catalogImagesSupplier, setCatalogImagesSupplier] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(null);
  const [checkingInventory, setCheckingInventory] = useState(null);
  const [inventoryResults, setInventoryResults] = useState(null);
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [inventorySku, setInventorySku] = useState('E0601');
  const [formData, setFormData] = useState({
    name: '',
    api_endpoint_url: '',
    api_key: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    is_active: true,
    product_tags: []
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/suppliers`);
      setSuppliers(response.data);
    } catch (error) {
      toast.error('Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/suppliers`, formData);
      toast.success('Supplier created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create supplier');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const updateData = { ...formData };
      if (!updateData.api_key) delete updateData.api_key;
      
      await axios.put(`${API_URL}/api/suppliers/${selectedSupplier.id}`, updateData);
      toast.success('Supplier updated successfully');
      setIsEditOpen(false);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update supplier');
    }
  };

  const handleDelete = async (supplierId) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/suppliers/${supplierId}`);
      toast.success('Supplier deleted successfully');
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete supplier');
    }
  };

  const openEditDialog = (supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      api_endpoint_url: supplier.api_endpoint_url || '',
      api_key: '',
      contact_email: supplier.contact_email || '',
      contact_phone: supplier.contact_phone || '',
      address: supplier.address || '',
      is_active: supplier.is_active,
      product_tags: supplier.product_tags || []
    });
    setTagInput('');
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      api_endpoint_url: '',
      api_key: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      is_active: true,
      product_tags: []
    });
    setTagInput('');
    setSelectedSupplier(null);
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!formData.product_tags.includes(newTag)) {
        setFormData({
          ...formData,
          product_tags: [...formData.product_tags, newTag]
        });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({
      ...formData,
      product_tags: formData.product_tags.filter(tag => tag !== tagToRemove)
    });
  };

  const addSuggestedTag = (tag) => {
    if (!formData.product_tags.includes(tag)) {
      setFormData({
        ...formData,
        product_tags: [...formData.product_tags, tag]
      });
    }
  };

  // Test supplier API connection
  const handleTestConnection = async (supplierId) => {
    setTestingConnection(supplierId);
    try {
      const response = await axios.post(`${API_URL}/api/suppliers/${supplierId}/test-connection`);
      if (response.data.success) {
        toast.success(`${response.data.supplier}: Connection successful!`);
      } else {
        toast.warning(`${response.data.supplier}: ${response.data.message}`);
      }
      fetchSuppliers();
    } catch (error) {
      toast.error('Connection test failed');
    } finally {
      setTestingConnection(null);
    }
  };

  // Check inventory from supplier
  const handleCheckInventory = async (supplierId) => {
    setCheckingInventory(supplierId);
    try {
      const response = await axios.post(
        `${API_URL}/api/suppliers/${supplierId}/check-inventory?product_sku=${inventorySku}&quantity=1`
      );
      setInventoryResults(response.data);
      setShowInventoryDialog(true);
    } catch (error) {
      toast.error('Failed to check inventory');
    } finally {
      setCheckingInventory(null);
    }
  };

  // Bulk inventory check
  const handleBulkInventoryCheck = async () => {
    setCheckingInventory('bulk');
    try {
      const response = await axios.post(
        `${API_URL}/api/suppliers/bulk-inventory-check?product_sku=${inventorySku}&quantity=1`
      );
      setInventoryResults(response.data);
      setShowInventoryDialog(true);
    } catch (error) {
      toast.error('Failed to check inventory');
    } finally {
      setCheckingInventory(null);
    }
  };

  // Get pricing from supplier
  const handleGetPricing = async (supplierId) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/suppliers/${supplierId}/get-pricing?product_sku=${inventorySku}`
      );
      const data = response.data;
      const demoText = data.demo_mode ? ' (Demo)' : '';
      toast.success(
        `${data.supplier}${demoText}: List $${data.list_price?.toFixed(2)} | Contract $${data.contract_price?.toFixed(2)} | Medicare $${data.medicare_allowable?.toFixed(2)}`,
        { duration: 5000 }
      );
    } catch (error) {
      toast.error('Failed to get pricing');
    }
  };

  return (
    <div data-testid="suppliers-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">Manage DME suppliers and API integrations</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk Inventory Check */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="HCPCS/SKU"
              value={inventorySku}
              onChange={(e) => setInventorySku(e.target.value)}
              className="w-32"
            />
            <Button
              variant="outline"
              onClick={handleBulkInventoryCheck}
              disabled={checkingInventory === 'bulk'}
              data-testid="bulk-inventory-btn"
            >
              {checkingInventory === 'bulk' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Package className="w-4 h-4 mr-2" />
              )}
              Check All Suppliers
            </Button>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="create-supplier-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
              <DialogDescription>Enter supplier details and API configuration</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Supplier Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="supplier-name-input"
                />
              </div>
              
              {/* Product Tags Section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Product Types
                </Label>
                <div className="space-y-2">
                  {/* Tags Display */}
                  {formData.product_tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-navy-800 rounded-md">
                      {formData.product_tags.map((tag, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className="pl-2 pr-1 py-1 flex items-center gap-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* Tag Input */}
                  <Input
                    placeholder="Type product type and press Enter..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    data-testid="product-tag-input"
                  />
                  {/* Suggestions */}
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Quick add:</span>
                    {PRODUCT_SUGGESTIONS.filter(s => !formData.product_tags.includes(s)).slice(0, 6).map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addSuggestedTag(suggestion)}
                        className="text-xs px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-colors"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>API Endpoint URL</Label>
                <Input
                  type="url"
                  placeholder="https://api.supplier.com/v1"
                  value={formData.api_endpoint_url}
                  onChange={(e) => setFormData({ ...formData, api_endpoint_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="Enter API key"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="supplier-submit-btn">Create Supplier</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Suppliers Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : suppliers && suppliers.length > 0 ? (
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>API Status</TableHead>
                  <TableHead>Product Types</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id} data-testid={`supplier-row-${supplier.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.api_endpoint_url && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Globe className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{supplier.api_endpoint_url}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.api_key ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-green-600">
                            <Key className="w-3 h-3 mr-1" />
                            API Key Set
                          </Badge>
                          {supplier.api_status === 'connected' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-lime-600 border-lime-300">
                          <WifiOff className="w-3 h-3 mr-1" />
                          Demo Mode
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {supplier.product_tags && supplier.product_tags.length > 0 ? (
                          supplier.product_tags.slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">No tags</span>
                        )}
                        {supplier.product_tags && supplier.product_tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{supplier.product_tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {supplier.contact_email && <p className="truncate max-w-[150px]">{supplier.contact_email}</p>}
                        {supplier.contact_phone && <p className="text-muted-foreground">{supplier.contact_phone}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Test Connection */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTestConnection(supplier.id)}
                          disabled={testingConnection === supplier.id}
                          title="Test API Connection"
                        >
                          {testingConnection === supplier.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wifi className="w-4 h-4" />
                          )}
                        </Button>
                        {/* Check Inventory */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCheckInventory(supplier.id)}
                          disabled={checkingInventory === supplier.id}
                          title="Check Inventory"
                        >
                          {checkingInventory === supplier.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Package className="w-4 h-4" />
                          )}
                        </Button>
                        {/* Get Pricing */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleGetPricing(supplier.id)}
                          title="Get Pricing"
                        >
                          <DollarSign className="w-4 h-4" />
                        </Button>
                        {/* Catalog Images */}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Catalog Images"
                          onClick={() => setCatalogImagesSupplier(supplier)}
                          data-testid={`catalog-images-${supplier.id}`}
                        >
                          <Images className="w-4 h-4 text-blue-500" />
                        </Button>
                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(supplier)}
                          data-testid={`edit-supplier-${supplier.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(supplier.id)}
                          data-testid={`delete-supplier-${supplier.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state">
              <Building2 className="empty-state-icon" />
              <h3 className="font-semibold mb-1">No suppliers found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by adding your first supplier
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            {/* Product Tags Section */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Product Types
              </Label>
              <div className="space-y-2">
                {formData.product_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-navy-800 rounded-md">
                    {formData.product_tags.map((tag, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary"
                        className="pl-2 pr-1 py-1 flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Type product type and press Enter..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                />
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Quick add:</span>
                  {PRODUCT_SUGGESTIONS.filter(s => !formData.product_tags.includes(s)).slice(0, 5).map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => addSuggestedTag(suggestion)}
                      className="text-xs px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-colors"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>API Endpoint URL</Label>
              <Input
                type="url"
                placeholder="https://api.supplier.com/v1"
                value={formData.api_endpoint_url}
                onChange={(e) => setFormData({ ...formData, api_endpoint_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>API Key (leave blank to keep existing)</Label>
              <Input
                type="password"
                placeholder="Enter new API key"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inventory Results Dialog */}
      <Dialog open={showInventoryDialog} onOpenChange={setShowInventoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Inventory Check Results
            </DialogTitle>
            <DialogDescription>
              {inventoryResults?.product_sku ? `SKU: ${inventoryResults.product_sku}` : ''}
              {inventoryResults?.hcpcs_code ? ` | HCPCS: ${inventoryResults.hcpcs_code}` : ''}
            </DialogDescription>
          </DialogHeader>
          
          {inventoryResults?.results && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {inventoryResults.results.map((result, idx) => (
                <Card key={idx} className={result.available ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{result.supplier_name}</div>
                          {result.demo_mode && (
                            <Badge variant="outline" className="text-xs">Demo Mode</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {result.available ? (
                          <div>
                            <Badge className="bg-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {result.quantity_available} Available
                            </Badge>
                            {result.warehouse_location && (
                              <p className="text-xs text-muted-foreground mt-1">{result.warehouse_location}</p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {inventoryResults?.supplier && !inventoryResults?.results && (
            <Card className={inventoryResults.available ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{inventoryResults.supplier}</h3>
                    {inventoryResults.demo_mode && (
                      <Badge variant="outline" className="mt-1">Demo Mode - Add API Key for live data</Badge>
                    )}
                  </div>
                  {inventoryResults.available ? (
                    <div className="text-right">
                      <Badge className="bg-green-600 text-lg px-4 py-2">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        {inventoryResults.quantity_available} In Stock
                      </Badge>
                      {inventoryResults.estimated_ship_date && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Ships: {new Date(inventoryResults.estimated_ship_date).toLocaleDateString()}
                        </p>
                      )}
                      {inventoryResults.warehouse_location && (
                        <p className="text-sm text-muted-foreground">From: {inventoryResults.warehouse_location}</p>
                      )}
                    </div>
                  ) : (
                    <Badge variant="destructive" className="text-lg px-4 py-2">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Out of Stock
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInventoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Catalog Images */}
      <SupplierCatalogImages
        supplier={catalogImagesSupplier}
        open={!!catalogImagesSupplier}
        onClose={() => setCatalogImagesSupplier(null)}
      />
    </div>
  );
}
