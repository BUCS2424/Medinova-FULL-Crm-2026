import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from './ui/tabs';
import { Globe, ImageIcon, CheckCircle2, AlertCircle, Loader2, Zap, ExternalLink, Edit2, Save, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// All 18 DME category names — every installation will have these
const ALL_CATEGORIES = [
  'Mobility Equipment', 'Respiratory Equipment', 'Orthopedic / Orthotics',
  'Hospital Beds & Accessories', 'Bathroom Safety', 'Diabetic Supplies',
  'Wound Care', 'Pain Management / Therapeutic', 'Emergency / Monitoring',
  'Lifts / Transfer Equipment', 'Enteral Nutrition', 'Urology / Ostomy',
  'Prosthetics', 'CPAP/BiPAP Accessories', 'Pediatric DME',
  'Bariatric Equipment', 'Vision Aids', 'Hearing Aids', 'Speech & Communication',
];

function ImageCard({ name, asset, onEdit }) {
  const hasImage = !!asset?.image_url;
  return (
    <div
      data-testid={`asset-card-${name.replace(/\s+/g, '-').toLowerCase()}`}
      className="border rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow"
    >
      <div className="relative h-36 bg-gray-50 flex items-center justify-center overflow-hidden">
        {hasImage ? (
          <img
            src={asset.image_url}
            alt={asset.alt_text || name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 ${hasImage ? 'hidden' : 'flex'}`}
          style={{ background: '#f8fafc' }}
        >
          <ImageIcon className="h-8 w-8 text-gray-300" />
          <span className="text-xs text-gray-400">No image yet</span>
        </div>
        {hasImage && (
          <div className="absolute top-2 right-2">
            <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
              <CheckCircle2 className="h-3 w-3 inline mr-0.5" />OK
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-gray-800 truncate">{name}</p>
        {hasImage && asset.source_url && (
          <a
            href={asset.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5 truncate"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{new URL(asset.source_url).hostname}</span>
          </a>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 h-7 text-xs w-full border border-gray-200"
          onClick={() => onEdit(name, asset)}
          data-testid={`edit-asset-${name.replace(/\s+/g, '-').toLowerCase()}`}
        >
          <Edit2 className="h-3 w-3 mr-1" />
          {hasImage ? 'Edit URL' : 'Add Image URL'}
        </Button>
      </div>
    </div>
  );
}

function EditAssetDialog({ open, name, asset, supplierId, onClose, onSaved }) {
  const [url, setUrl] = useState(asset?.image_url || '');
  const [source, setSource] = useState(asset?.source_url || '');
  const [alt, setAlt] = useState(asset?.alt_text || name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUrl(asset?.image_url || '');
    setSource(asset?.source_url || '');
    setAlt(asset?.alt_text || name || '');
  }, [asset, name]);

  const handleSave = async () => {
    if (!url.trim()) { toast.error('Image URL is required'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      if (asset?.id) {
        await axios.put(`${API_URL}/api/suppliers/${supplierId}/assets/${asset.id}`,
          { image_url: url.trim(), source_url: source.trim(), alt_text: alt.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      toast.success('Image URL saved');
      onSaved({ ...asset, image_url: url.trim(), source_url: source.trim(), alt_text: alt.trim(), entity_name: name });
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="edit-asset-dialog">
        <DialogHeader>
          <DialogTitle>Set Image: {name}</DialogTitle>
          <DialogDescription>Paste the direct image URL from the supplier's website</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {url && (
            <div className="rounded-lg overflow-hidden h-40 bg-gray-50 flex items-center justify-center">
              <img src={url} alt={alt} className="max-h-full max-w-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Image URL *</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://supplier.com/path/to/image.jpg"
              data-testid="asset-image-url-input" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Source Page URL</label>
            <Input value={source} onChange={(e) => setSource(e.target.value)}
              placeholder="https://supplier.com/products/category"
              data-testid="asset-source-url-input" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Alt Text</label>
            <Input value={alt} onChange={(e) => setAlt(e.target.value)}
              placeholder="Descriptive alt text" data-testid="asset-alt-input" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="save-asset-btn">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierCatalogImages({ supplier, open, onClose }) {
  const [assets, setAssets] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null); // { name, asset }
  const [applying, setApplying] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [activeTab, setActiveTab] = useState('categories');

  const token = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!supplier?.id) return;
    setLoading(true);
    try {
      const [assetsRes, statusRes] = await Promise.all([
        axios.get(`${API_URL}/api/suppliers/${supplier.id}/assets`, { headers }),
        axios.get(`${API_URL}/api/suppliers/${supplier.id}/assets/status`, { headers }),
      ]);
      setAssets(assetsRes.data || []);
      setStatus(statusRes.data);
    } catch {
      toast.error('Failed to load supplier assets');
    } finally {
      setLoading(false);
    }
  }, [supplier?.id]);

  useEffect(() => { if (open) load(); }, [open, load]);

  // Map assets by entity_name for O(1) lookup
  const assetMap = {};
  assets.forEach((a) => {
    const key = `${a.asset_type}::${a.entity_name}`;
    if (!assetMap[key] || a.image_url) assetMap[key] = a;
  });

  const categoryAssets = ALL_CATEGORIES.map((name) => ({
    name,
    asset: assetMap[`category::${name}`] || null,
  }));

  const productAssets = assets.filter((a) => a.asset_type === 'product');

  const hasCatImages = categoryAssets.filter((c) => c.asset?.image_url).length;

  const handleEditSaved = (updated) => {
    setAssets((prev) => {
      const idx = prev.findIndex((a) => a.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, { ...updated, id: updated.id || `tmp-${Date.now()}` }];
    });
    setEditTarget(null);
  };

  const handleApply = async () => {
    setConfirmApply(false);
    setApplying(true);
    try {
      const res = await axios.post(`${API_URL}/api/suppliers/${supplier.id}/apply`, {}, { headers });
      const d = res.data;
      toast.success(`Applied! ${d.categories_updated} categories + ${d.products_updated} products updated`);
      load();
    } catch {
      toast.error('Failed to apply catalog images');
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !applying && !o && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="supplier-catalog-images-dialog">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl">{supplier?.name} — Catalog Images</DialogTitle>
                <DialogDescription>
                  Product and category images sourced from {supplier?.website_url || 'the supplier website'}.
                  These are stored in the database and survive deployments.
                </DialogDescription>
              </div>
              {supplier?.website_url && (
                <a href={supplier.website_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1">
                  <Globe className="h-4 w-4" />Visit Site
                </a>
              )}
            </div>

            {/* Coverage summary */}
            {status && (
              <div className="flex gap-4 mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Categories:</span>
                  <Badge variant={hasCatImages > 0 ? 'default' : 'secondary'}>
                    {status.category_assets} / {status.total_categories}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Products:</span>
                  <Badge variant={status.product_assets > 0 ? 'default' : 'secondary'}>
                    {status.product_assets} / {status.total_products}
                  </Badge>
                </div>
                <div className="ml-auto">
                  <Button
                    size="sm"
                    disabled={applying || (hasCatImages + status.product_assets) === 0}
                    onClick={() => setConfirmApply(true)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="apply-to-catalog-btn"
                  >
                    {applying
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying…</>
                      : <><Zap className="h-4 w-4 mr-2" />Apply to Catalog</>}
                  </Button>
                </div>
              </div>
            )}
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
              <TabsList>
                <TabsTrigger value="categories" data-testid="tab-categories">
                  Categories
                  {hasCatImages > 0 && (
                    <Badge variant="secondary" className="ml-2">{hasCatImages}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="products" data-testid="tab-products">
                  Products
                  {productAssets.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{productAssets.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="categories" className="mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {categoryAssets.map(({ name, asset }) => (
                    <ImageCard
                      key={name}
                      name={name}
                      asset={asset}
                      onEdit={(n, a) => setEditTarget({ name: n, asset: a })}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-4 text-center">
                  Click "Add Image URL" on any card to paste an image URL from {supplier?.website_url || 'the supplier site'}.
                  Missing categories will be filled when the supplier connects their API.
                </p>
              </TabsContent>

              <TabsContent value="products" className="mt-4">
                {productAssets.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <ImageIcon className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-sm font-medium">No product images yet for this supplier</p>
                    <p className="text-xs mt-1">
                      Product-level images will be added as supplier API connections are configured.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {productAssets.map((a) => (
                      <ImageCard
                        key={a.id}
                        name={a.entity_name}
                        asset={a}
                        onEdit={(n, asset) => setEditTarget({ name: n, asset })}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editTarget && (
        <EditAssetDialog
          open={!!editTarget}
          name={editTarget.name}
          asset={editTarget.asset}
          supplierId={supplier?.id}
          onClose={() => setEditTarget(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* Confirm apply */}
      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent data-testid="confirm-apply-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply {supplier?.name} images to catalog?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the <strong>image_url</strong> on matching product categories and products
              in the active catalog. Existing images will be overwritten. You can re-apply any other
              supplier at any time to switch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApply}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="confirm-apply-btn"
            >
              Yes, apply images
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
