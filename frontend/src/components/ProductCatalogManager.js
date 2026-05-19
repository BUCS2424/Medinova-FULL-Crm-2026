import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Plus, 
  Trash2, 
  Edit2,
  Save,
  X,
  Package,
  FolderOpen,
  Sparkles,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Search,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Hash,
  FileText,
  Tag,
  Globe,
  ExternalLink,
  Truck,
  Building2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default DME categories with AI-ready structure
const DEFAULT_CATEGORIES = [
  { name: 'Emergency / Monitoring', icon: 'activity', color: 'from-red-500 to-red-600' },
  { name: 'Pain Management / Therapeutic', icon: 'zap', color: 'from-purple-500 to-purple-600' },
  { name: 'Mobility', icon: 'accessibility', color: 'from-blue-500 to-blue-600' },
  { name: 'Lifts / Transfer Equipment', icon: 'arrow-up-down', color: 'from-green-500 to-emerald-600' },
  { name: 'Orthopedic / Orthotics', icon: 'bone', color: 'from-amber-500 to-orange-500' },
  { name: 'Respiratory / Oxygen', icon: 'wind', color: 'from-cyan-500 to-cyan-600' },
  { name: 'Hospital Beds / Bedroom', icon: 'bed', color: 'from-slate-500 to-slate-600' },
  { name: 'Urology / Ostomy / Clinical', icon: 'droplets', color: 'from-teal-500 to-teal-600' },
  { name: 'Enteral Nutrition', icon: 'utensils', color: 'from-pink-500 to-pink-600' },
  { name: 'Compression / Wound Care', icon: 'heart-pulse', color: 'from-indigo-500 to-indigo-600' },
  { name: 'Diabetes Supplies', icon: 'syringe', color: 'from-rose-500 to-rose-600' },
  { name: 'Bath Safety', icon: 'bath', color: 'from-sky-500 to-sky-600' },
];

// AI-generated product templates per category with HCPCS codes
const PRODUCT_TEMPLATES = {
  'Emergency / Monitoring': [
    { name: 'AEDs (Automated External Defibrillators)', short_description: 'Life-saving devices for cardiac emergencies', hcpcs: ['K0606'] },
    { name: 'Blood Glucose Monitors', short_description: 'For diabetes management and monitoring', hcpcs: ['E0607', 'E2100'] },
    { name: 'Blood Pressure Monitors', short_description: 'Digital monitors for home use', hcpcs: ['A4670'] },
    { name: 'Pulse Oximeters', short_description: 'Oxygen saturation monitoring devices', hcpcs: ['E0445'] },
  ],
  'Pain Management / Therapeutic': [
    { name: 'TENS Units', short_description: 'Transcutaneous electrical nerve stimulation for pain relief', hcpcs: ['E0720', 'E0730'] },
    { name: 'Electrical Stimulation Devices', short_description: 'Muscle stimulation therapy equipment', hcpcs: ['E0745', 'E0770'] },
    { name: 'Heat/Cold Therapy', short_description: 'Therapeutic heating pads and cold packs', hcpcs: ['E0210', 'E0215'] },
    { name: 'Ultrasound Therapy Devices', short_description: 'Deep tissue therapeutic ultrasound', hcpcs: ['E0659'] },
  ],
  'Mobility Equipment': [
    { name: 'Manual Wheelchairs', short_description: 'Standard and lightweight manual wheelchairs', hcpcs: ['K0001', 'K0002', 'K0003', 'K0004'] },
    { name: 'Power Wheelchairs', short_description: 'Electric-powered mobility chairs', hcpcs: ['K0813', 'K0814', 'K0815', 'K0816'] },
    { name: 'Walkers', short_description: 'Standard and wheeled walkers', hcpcs: ['E0130', 'E0135', 'E0141'] },
    { name: 'Rollators', short_description: '4-wheel rolling walkers with seats', hcpcs: ['E0143', 'E0144'] },
    { name: 'Mobility Scooters', short_description: '3 and 4-wheel power scooters', hcpcs: ['K0800', 'K0801', 'K0802'] },
    { name: 'Canes & Crutches', short_description: 'Walking aids for balance support', hcpcs: ['E0100', 'E0105', 'E0110', 'E0116'] },
    { name: 'Knee Scooters', short_description: 'Hands-free mobility for lower leg injuries', hcpcs: ['E0118'] },
  ],
  'Lifts / Transfer Equipment': [
    { name: 'Patient Lifts (Hoyer)', short_description: 'Hydraulic and electric patient lift systems', hcpcs: ['E0621', 'E0630', 'E0635', 'E0636'] },
    { name: 'Lift Slings', short_description: 'Various sling types for patient lifts', hcpcs: ['E0625', 'E0627', 'E0629'] },
    { name: 'Transfer Boards', short_description: 'Sliding boards for safe transfers', hcpcs: ['E0705'] },
    { name: 'Stand Assist Devices', short_description: 'Sit-to-stand transfer aids', hcpcs: ['E0640'] },
    { name: 'Ceiling Lifts', short_description: 'Overhead track lift systems', hcpcs: ['E0638'] },
  ],
  'Orthopedic / Orthotics': [
    { name: 'Back Braces (LSO/TLSO)', short_description: 'Lumbar and thoracic support braces', hcpcs: ['L0631', 'L0648', 'L0650'] },
    { name: 'Knee Braces', short_description: 'Hinged, OA, and post-operative knee supports', hcpcs: ['L1810', 'L1820', 'L1830', 'L1843'] },
    { name: 'Ankle Braces (AFO)', short_description: 'Ankle-foot orthoses for stability', hcpcs: ['L1900', 'L1902', 'L1904'] },
    { name: 'Wrist Braces', short_description: 'Carpal tunnel and wrist support braces', hcpcs: ['L3908', 'L3916'] },
    { name: 'Shoulder Braces', short_description: 'Shoulder immobilizers and supports', hcpcs: ['L3670', 'L3675'] },
    { name: 'Cervical Collars', short_description: 'Neck support braces', hcpcs: ['L0120', 'L0172', 'L0174'] },
    { name: 'Hip Braces', short_description: 'Hip abduction and support orthoses', hcpcs: ['L1680', 'L1685', 'L1686'] },
  ],
  'Respiratory Equipment': [
    { name: 'Oxygen Concentrators', short_description: 'Home oxygen therapy equipment', hcpcs: ['E1390', 'E1391', 'E1392'] },
    { name: 'Portable Oxygen', short_description: 'Portable oxygen concentrators and tanks', hcpcs: ['E1390', 'K0738'] },
    { name: 'CPAP Machines', short_description: 'Continuous positive airway pressure for sleep apnea', hcpcs: ['E0601'] },
    { name: 'BiPAP Machines', short_description: 'Bilevel positive airway pressure therapy', hcpcs: ['E0470', 'E0471'] },
    { name: 'Nebulizers', short_description: 'Medication delivery systems for respiratory conditions', hcpcs: ['E0570', 'E0575'] },
    { name: 'CPAP Masks & Supplies', short_description: 'Masks, tubing, and replacement parts', hcpcs: ['A7027', 'A7030', 'A7031', 'A7034'] },
  ],
  'Hospital Beds / Bedroom': [
    { name: 'Hospital Beds', short_description: 'Semi-electric and full-electric hospital beds', hcpcs: ['E0255', 'E0256', 'E0260', 'E0261', 'E0265', 'E0266'] },
    { name: 'Mattresses & Overlays', short_description: 'Pressure-relieving mattresses and toppers', hcpcs: ['E0181', 'E0184', 'E0186', 'E0277'] },
    { name: 'Bed Rails', short_description: 'Safety rails for fall prevention', hcpcs: ['E0305', 'E0310'] },
    { name: 'Overbed Tables', short_description: 'Adjustable tables for bedside use', hcpcs: ['E0274'] },
    { name: 'Trapeze Bars', short_description: 'Bed mobility assistance devices', hcpcs: ['E0910', 'E0911', 'E0912'] },
  ],
  'Urology / Ostomy / Clinical': [
    { name: 'Catheters', short_description: 'Intermittent and indwelling catheters', hcpcs: ['A4351', 'A4352', 'A4353'] },
    { name: 'Ostomy Supplies', short_description: 'Pouches, barriers, and accessories', hcpcs: ['A4361', 'A4364', 'A4366'] },
    { name: 'Incontinence Supplies', short_description: 'Adult briefs and protective underwear', hcpcs: ['T4521', 'T4522', 'T4523', 'T4524'] },
    { name: 'Drainage Bags', short_description: 'Leg bags and bedside drainage systems', hcpcs: ['A4357', 'A4358'] },
    { name: 'Male External Catheters', short_description: 'Condom catheters and collection devices', hcpcs: ['A4349'] },
  ],
  'Enteral Nutrition': [
    { name: 'Feeding Tubes', short_description: 'G-tubes, J-tubes, and NG tubes', hcpcs: ['B4034', 'B4035', 'B4036'] },
    { name: 'Enteral Pumps', short_description: 'Feeding pumps and accessories', hcpcs: ['B9000', 'B9002'] },
    { name: 'Nutritional Formulas', short_description: 'Specialized enteral nutrition formulas', hcpcs: ['B4150', 'B4152', 'B4153', 'B4154'] },
    { name: 'Feeding Supplies', short_description: 'Syringes, bags, and extension sets', hcpcs: ['B4082', 'B4083', 'B4087'] },
  ],
  'Compression / Wound Care': [
    { name: 'Compression Stockings', short_description: 'Graduated compression hosiery', hcpcs: ['A6530', 'A6531', 'A6532', 'A6533'] },
    { name: 'Compression Pumps', short_description: 'Lymphedema and DVT prevention pumps', hcpcs: ['E0650', 'E0651', 'E0652', 'E0656'] },
    { name: 'Wound Dressings', short_description: 'Specialized wound care dressings', hcpcs: ['A6196', 'A6197', 'A6198', 'A6199'] },
    { name: 'Negative Pressure Therapy', short_description: 'Wound VAC systems', hcpcs: ['E2402'] },
    { name: 'Compression Wraps', short_description: 'Adjustable compression bandages', hcpcs: ['A6545'] },
  ],
  'Diabetes Supplies': [
    { name: 'Insulin Pumps', short_description: 'Automated insulin delivery systems', hcpcs: ['E0784'] },
    { name: 'CGM Systems', short_description: 'Continuous glucose monitoring devices', hcpcs: ['E2103', 'A9276', 'A9277', 'A9278'] },
    { name: 'Diabetic Shoes', short_description: 'Therapeutic footwear for diabetics', hcpcs: ['A5500', 'A5501', 'A5503', 'A5504'] },
    { name: 'Lancets & Test Strips', short_description: 'Blood glucose testing supplies', hcpcs: ['A4253', 'A4256', 'A4259'] },
  ],
  'Bath Safety': [
    { name: 'Shower Chairs', short_description: 'Seated bathing aids', hcpcs: ['E0240'] },
    { name: 'Transfer Benches', short_description: 'Tub transfer and bathing benches', hcpcs: ['E0245', 'E0247', 'E0248'] },
    { name: 'Grab Bars', short_description: 'Bathroom safety rails', hcpcs: ['E0241'] },
    { name: 'Raised Toilet Seats', short_description: 'Elevated toilet seats with arms', hcpcs: ['E0163', 'E0165'] },
    { name: 'Commodes', short_description: 'Bedside and 3-in-1 commodes', hcpcs: ['E0163', 'E0165', 'E0167', 'E0168'] },
  ],
};

export default function ProductCatalogManager() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedCategoryForProduct, setSelectedCategoryForProduct] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(null);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState({});
  const [showImagePicker, setShowImagePicker] = useState(null);
  const [generatingCatalog, setGeneratingCatalog] = useState(false);
  const fileInputRef = useRef(null);

  // Generate full DME catalog
  const handleGenerateFullCatalog = async () => {
    if (!window.confirm('Generate complete DME product catalog? This will add all standard DME categories, products, and supplier associations.')) return;
    
    setGeneratingCatalog(true);
    try {
      const response = await axios.post(`${API_URL}/api/dev/products/generate-full-catalog`, {}, { headers: getHeaders() });
      const data = response.data;
      
      if (data.created_products > 0 || data.created_categories > 0) {
        toast.success(
          `Catalog generated! Created ${data.created_categories} categories, ${data.created_products} products.`
        );
      } else if (data.skipped_existing > 0) {
        toast.info(
          `Catalog already complete! ${data.skipped_existing} products exist. Total: ${data.total_catalog_products} products in ${data.total_catalog_categories} categories.`
        );
      } else {
        toast.success('Catalog generation complete!');
      }
      fetchData();
    } catch (error) {
      console.error('Catalog generation error:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate catalog');
    } finally {
      setGeneratingCatalog(false);
    }
  };
  
  // New category form
  const [newCategory, setNewCategory] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'package',
    color: 'from-gray-500 to-gray-600',
    enabled: true
  });
  
  // New product form
  const [newProduct, setNewProduct] = useState({
    name: '',
    slug: '',
    sku: '',
    short_description: '',
    full_description: '',
    image_url: '',
    hcpcs_codes: [],
    meta_title: '',
    meta_description: '',
    meta_keywords: '',
    enabled: true
  });

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, prodRes, suppRes] = await Promise.all([
        axios.get(`${API_URL}/api/dev/product-categories`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/dev/products`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/suppliers`, { headers: getHeaders() }).catch(() => ({ data: [] }))
      ]);
      setCategories(catRes.data);
      setProducts(prodRes.data);
      setSuppliers(suppRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch product data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Get supplier names by IDs
  const getSupplierNames = (supplierIds = []) => {
    if (!supplierIds || supplierIds.length === 0) return [];
    return supplierIds.map(id => {
      const supplier = suppliers.find(s => s.id === id);
      return supplier ? supplier.name : null;
    }).filter(Boolean);
  };

  const generateSlug = (name, hcpcsCode = null) => {
    let slug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    // Add dme- prefix if not present
    if (!slug.startsWith('dme-')) {
      slug = 'dme-' + slug;
    }
    
    // Add HCPCS code suffix if provided
    if (hcpcsCode) {
      slug = slug + '-' + hcpcsCode.toUpperCase();
    }
    
    return slug;
  };

  // Generate SEO-friendly slug with HCPCS code
  const generateProductSlug = (name, hcpcsCodes = []) => {
    const primaryHcpcs = hcpcsCodes && hcpcsCodes.length > 0 ? hcpcsCodes[0] : null;
    return generateSlug(name, primaryHcpcs);
  };

  // Generate SEO content for a product
  const generateSEOContent = (productName, categoryName) => {
    const title = `${productName} | Medicare-Covered DME | MediNova Medical Supplies`;
    const description = `Get Medicare-covered ${productName.toLowerCase()} from MediNova Medical Supplies. Free delivery, insurance verification, and expert support. ${categoryName} equipment for home health care.`;
    const keywords = `${productName.toLowerCase()}, Medicare ${productName.toLowerCase()}, DME ${productName.toLowerCase()}, ${categoryName.toLowerCase()}, medical equipment, durable medical equipment`;
    
    return { meta_title: title, meta_description: description, meta_keywords: keywords };
  };

  // AI Generate all default categories
  const handleGenerateAllCategories = async () => {
    if (!window.confirm('This will create all default DME categories. Continue?')) return;
    
    setGenerating(true);
    let created = 0;
    
    try {
      for (const cat of DEFAULT_CATEGORIES) {
        const slug = generateSlug(cat.name);
        const seo = generateSEOContent(cat.name, 'DME');
        
        try {
          await axios.post(`${API_URL}/api/dev/product-categories`, {
            name: cat.name,
            slug: slug,
            description: `Medicare-covered ${cat.name.toLowerCase()} equipment and supplies.`,
            icon: cat.icon,
            color: cat.color,
            enabled: true,
            sort_order: DEFAULT_CATEGORIES.indexOf(cat),
            ...seo
          }, { headers: getHeaders() });
          created++;
        } catch (e) {
          // Category might already exist
          console.log(`Category ${cat.name} might already exist`);
        }
      }
      
      toast.success(`Created ${created} categories`);
      fetchData();
    } catch (error) {
      toast.error('Failed to generate categories');
    } finally {
      setGenerating(false);
    }
  };

  // AI Generate products for a category
  const handleGenerateProductsForCategory = async (categoryId, categoryName) => {
    const templates = PRODUCT_TEMPLATES[categoryName];
    if (!templates) {
      toast.error('No product templates available for this category');
      return;
    }
    
    setGenerating(true);
    let created = 0;
    
    try {
      for (const prod of templates) {
        const primaryHcpcs = prod.hcpcs && prod.hcpcs.length > 0 ? prod.hcpcs[0] : null;
        const slug = generateProductSlug(prod.name, prod.hcpcs);
        const seo = generateSEOContent(prod.name, categoryName);
        
        try {
          await axios.post(`${API_URL}/api/dev/products`, {
            category_id: categoryId,
            name: prod.name,
            slug: slug,
            short_description: prod.short_description,
            full_description: `${prod.name} available through MediNova Medical Supplies. ${prod.short_description}. Medicare-covered with free delivery and expert support.`,
            features: ['Medicare covered', 'Free delivery', 'Insurance verification', 'Expert support'],
            benefits: ['Improved quality of life', 'Professional fitting', 'Ongoing support'],
            enabled: true,
            sort_order: templates.indexOf(prod),
            requires_prescription: true,
            hcpcs_codes: prod.hcpcs || [],
            ...seo
          }, { headers: getHeaders() });
          created++;
        } catch (e) {
          console.log(`Product ${prod.name} might already exist`);
        }
      }
      
      toast.success(`Created ${created} products for ${categoryName}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to generate products');
    } finally {
      setGenerating(false);
    }
  };

  // Upload product image
  const handleImageUpload = async (productId, file) => {
    setUploadingImage(productId);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(
        `${API_URL}/api/dev/products/${productId}/image`,
        formData,
        { 
          headers: { 
            ...getHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      toast.success('Image uploaded successfully');
      
      // Update local state
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, image_url: response.data.image_url } : p
      ));
    } catch (error) {
      toast.error('Failed to upload image');
      console.error(error);
    } finally {
      setUploadingImage(null);
    }
  };

  // Toggle category enabled status
  const handleToggleCategoryEnabled = async (categoryId, currentEnabled) => {
    try {
      await axios.put(`${API_URL}/api/dev/product-categories/${categoryId}`, {
        enabled: !currentEnabled
      }, { headers: getHeaders() });
      
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, enabled: !currentEnabled } : cat
      ));
      toast.success(`Category ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  // Toggle product enabled status
  const handleToggleProductEnabled = async (productId, currentEnabled) => {
    try {
      await axios.put(`${API_URL}/api/dev/products/${productId}`, {
        enabled: !currentEnabled
      }, { headers: getHeaders() });
      
      setProducts(prev => prev.map(prod => 
        prod.id === productId ? { ...prod, enabled: !currentEnabled } : prod
      ));
      toast.success(`Product ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update product');
    }
  };

  // Update product
  const handleUpdateProduct = async (productId, updates) => {
    try {
      await axios.put(`${API_URL}/api/dev/products/${productId}`, updates, { headers: getHeaders() });
      
      setProducts(prev => prev.map(prod => 
        prod.id === productId ? { ...prod, ...updates } : prod
      ));
      toast.success('Product updated');
      setEditingProduct(null);
    } catch (error) {
      toast.error('Failed to update product');
    }
  };

  // Delete category
  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Delete this category and all its products?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/dev/product-categories/${categoryId}`, { headers: getHeaders() });
      toast.success('Category deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/dev/products/${productId}`, { headers: getHeaders() });
      toast.success('Product deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  // Search for product images using web search
  const searchProductImages = async (productName) => {
    // Build search query for non-branded medical equipment images
    const searchQuery = `${productName} medical equipment product white background`;
    
    try {
      // Use the backend to search for images via Unsplash/Pexels
      const response = await axios.get(`${API_URL}/api/images/search`, {
        params: { query: searchQuery, count: 6 },
        headers: getHeaders()
      });
      return response.data.images || [];
    } catch (error) {
      console.error('Image search failed:', error);
      return [];
    }
  };

  // Generate images for all products without images
  const handleGenerateAllImages = async () => {
    const productsWithoutImages = products.filter(p => 
      !p.image_url || p.image_url === '' || p.image_url.includes('placeholder')
    );
    
    if (productsWithoutImages.length === 0) {
      toast.info('All products already have images');
      return;
    }
    
    setGeneratingImages(true);
    toast.info(`Finding images for ${productsWithoutImages.length} products...`);
    
    const results = {};
    for (const product of productsWithoutImages.slice(0, 10)) { // Limit to 10 at a time
      const images = await searchProductImages(product.name);
      if (images.length > 0) {
        results[product.id] = images;
      }
    }
    
    setImageSearchResults(results);
    setGeneratingImages(false);
    
    if (Object.keys(results).length > 0) {
      toast.success(`Found images for ${Object.keys(results).length} products. Click to select.`);
    } else {
      toast.warning('No images found. Try searching manually.');
    }
  };

  // Search images for a single product
  const handleSearchProductImage = async (product) => {
    setShowImagePicker(product.id);
    const images = await searchProductImages(product.name);
    setImageSearchResults(prev => ({ ...prev, [product.id]: images }));
  };

  // Set image from URL (downloads and stores in bucket)
  const handleSetImageFromUrl = async (productId, imageUrl) => {
    setUploadingImage(productId);
    try {
      const formData = new FormData();
      formData.append('image_url', imageUrl);
      
      const response = await axios.post(
        `${API_URL}/api/dev/products/${productId}/set-image-url`,
        formData,
        { headers: getHeaders() }
      );
      
      // Update local state
      setProducts(prev => prev.map(prod => 
        prod.id === productId ? { ...prod, image_url: response.data.image_url } : prod
      ));
      
      // Clear search results for this product
      setImageSearchResults(prev => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
      setShowImagePicker(null);
      
      toast.success('Image saved to product');
    } catch (error) {
      toast.error('Failed to save image');
      console.error(error);
    } finally {
      setUploadingImage(null);
    }
  };

  // Add new category
  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      const seo = generateSEOContent(newCategory.name, 'DME');
      await axios.post(`${API_URL}/api/dev/product-categories`, {
        ...newCategory,
        slug: newCategory.slug || generateSlug(newCategory.name),
        sort_order: categories.length,
        ...seo
      }, { headers: getHeaders() });
      
      toast.success('Category created');
      setShowAddCategory(false);
      setNewCategory({ name: '', slug: '', description: '', icon: 'package', color: 'from-gray-500 to-gray-600', enabled: true });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create category');
    }
  };

  // Add new product
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!selectedCategoryForProduct) {
      toast.error('Please select a category');
      return;
    }
    
    const category = categories.find(c => c.id === selectedCategoryForProduct);
    const hcpcsList = newProduct.hcpcs_codes.length > 0 ? newProduct.hcpcs_codes : [];
    const autoSlug = generateProductSlug(newProduct.name, hcpcsList);
    const seo = newProduct.meta_title ? {} : generateSEOContent(newProduct.name, category?.name || 'DME');
    
    try {
      await axios.post(`${API_URL}/api/dev/products`, {
        ...newProduct,
        category_id: selectedCategoryForProduct,
        slug: newProduct.slug || autoSlug,
        sort_order: products.filter(p => p.category_id === selectedCategoryForProduct).length,
        requires_prescription: true,
        hcpcs_codes: newProduct.hcpcs_codes.length > 0 ? newProduct.hcpcs_codes : [],
        ...seo
      }, { headers: getHeaders() });
      
      toast.success('Product created');
      setShowAddProduct(false);
      setNewProduct({ name: '', slug: '', sku: '', short_description: '', full_description: '', image_url: '', hcpcs_codes: [], meta_title: '', meta_description: '', meta_keywords: '', enabled: true });
      setSelectedCategoryForProduct(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create product');
    }
  };

  const getProductsForCategory = (categoryId) => {
    return products.filter(p => p.category_id === categoryId);
  };

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <Package className="w-5 h-5" />
            Product Catalog Manager
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage DME product categories, items, images, and SEO for the public catalog
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateAllCategories}
            disabled={generating}
            variant="outline"
            data-testid="generate-all-categories-btn"
          >
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Generate Categories
          </Button>
          <Button variant="outline" asChild>
            <a href="/products" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Public Catalog
            </a>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">Total Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{categories.filter(c => c.enabled).length}</div>
            <p className="text-xs text-muted-foreground">Enabled Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{products.filter(p => p.enabled).length}</div>
            <p className="text-xs text-muted-foreground">Enabled Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Suppliers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search categories..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddCategory(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
        <Button onClick={() => setShowAddProduct(true)} variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
        <Button 
          onClick={handleGenerateAllImages} 
          variant="outline"
          disabled={generatingImages}
          className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:from-purple-100 hover:to-pink-100"
        >
          {generatingImages ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Finding Images...</>
          ) : (
            <><ImageIcon className="w-4 h-4 mr-2" /> Generate Images</>
          )}
        </Button>
        <Button 
          onClick={handleGenerateFullCatalog} 
          variant="outline"
          disabled={generatingCatalog}
          className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:from-green-100 hover:to-emerald-100"
        >
          {generatingCatalog ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
          ) : (
            <><Package className="w-4 h-4 mr-2" /> Generate Full Catalog</>
          )}
        </Button>
      </div>

      {/* Add Category Modal */}
      {showAddCategory && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Add New Category</span>
              <Button variant="ghost" size="icon" onClick={() => setShowAddCategory(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Category Name *</Label>
                  <Input 
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value, slug: generateSlug(e.target.value) })}
                    placeholder="e.g. Respiratory Equipment"
                    required
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input 
                    value={newCategory.slug}
                    onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                    placeholder="respiratory-equipment"
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="Brief description of this category..."
                />
              </div>
              <div className="flex gap-4">
                <Button type="submit">Create Category</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddCategory(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Add New Product</span>
              <Button variant="ghost" size="icon" onClick={() => setShowAddProduct(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <Label>Category *</Label>
                <select 
                  className="w-full px-3 py-2 border rounded-lg"
                  value={selectedCategoryForProduct || ''}
                  onChange={(e) => setSelectedCategoryForProduct(e.target.value)}
                  required
                >
                  <option value="">Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Product Name *</Label>
                  <Input 
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value, slug: generateSlug(e.target.value) })}
                    placeholder="e.g. CPAP Machine"
                    required
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input 
                    value={newProduct.slug}
                    onChange={(e) => setNewProduct({ ...newProduct, slug: e.target.value })}
                    placeholder="cpap-machine"
                  />
                </div>
                <div>
                  <Label>
                    <Hash className="w-3 h-3 inline mr-1" />
                    SKU (auto-generated if empty)
                  </Label>
                  <Input 
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="DME-0001"
                  />
                </div>
              </div>
              <div>
                <Label>Short Description</Label>
                <Input 
                  value={newProduct.short_description}
                  onChange={(e) => setNewProduct({ ...newProduct, short_description: e.target.value })}
                  placeholder="Brief description for listings..."
                />
              </div>
              <div>
                <Label>Full Description</Label>
                <Textarea 
                  value={newProduct.full_description}
                  onChange={(e) => setNewProduct({ ...newProduct, full_description: e.target.value })}
                  placeholder="Detailed product description..."
                />
              </div>
              <div>
                <Label>
                  <ImageIcon className="w-3 h-3 inline mr-1" />
                  Image URL (can upload after creation)
                </Label>
                <Input 
                  value={newProduct.image_url}
                  onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              
              {/* SEO Fields */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  SEO Settings (auto-generated if empty)
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label>Meta Title</Label>
                    <Input 
                      value={newProduct.meta_title}
                      onChange={(e) => setNewProduct({ ...newProduct, meta_title: e.target.value })}
                      placeholder="Product Name | Medicare-Covered DME | MediNova"
                    />
                  </div>
                  <div>
                    <Label>Meta Description</Label>
                    <Textarea 
                      value={newProduct.meta_description}
                      onChange={(e) => setNewProduct({ ...newProduct, meta_description: e.target.value })}
                      placeholder="Get Medicare-covered product from MediNova..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Meta Keywords</Label>
                    <Input 
                      value={newProduct.meta_keywords}
                      onChange={(e) => setNewProduct({ ...newProduct, meta_keywords: e.target.value })}
                      placeholder="product, medicare, dme, medical equipment"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <Button type="submit">Create Product</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddProduct(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Categories List */}
      <div className="space-y-3">
        {filteredCategories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Categories Yet</h3>
              <p className="text-muted-foreground mb-4">Click "AI Generate Categories" to create all default DME categories</p>
            </CardContent>
          </Card>
        ) : (
          filteredCategories.map((category) => {
            const categoryProducts = getProductsForCategory(category.id);
            const isExpanded = expandedCategories[category.id];
            
            return (
              <Card key={category.id} className={!category.enabled ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  {/* Category Header */}
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setExpandedCategories(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
                      className="p-1 hover:bg-muted rounded"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${category.color || 'from-gray-500 to-gray-600'} flex items-center justify-center flex-shrink-0`}>
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{category.name}</h3>
                        <Badge variant={category.enabled ? 'default' : 'secondary'}>
                          {category.enabled ? 'Visible' : 'Hidden'}
                        </Badge>
                        <Badge variant="outline">{categoryProducts.length} products</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{category.description}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleGenerateProductsForCategory(category.id, category.name)}
                        disabled={generating}
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        AI Add Products
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleToggleCategoryEnabled(category.id, category.enabled)}
                        title={category.enabled ? 'Hide from catalog' : 'Show in catalog'}
                      >
                        {category.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Products List */}
                  {isExpanded && (
                    <div className="mt-4 ml-10 space-y-2">
                      {categoryProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">No products in this category. Click "AI Add Products" to generate.</p>
                      ) : (
                        categoryProducts.map((product) => (
                          <div 
                            key={product.id} 
                            className={`flex items-center gap-3 p-3 rounded-lg border ${product.enabled ? 'bg-white dark:bg-slate-900' : 'bg-muted/50 opacity-60'}`}
                          >
                            {/* Product Image */}
                            <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 relative group">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              {/* Upload overlay */}
                              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
                                {uploadingImage === product.id ? (
                                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                                ) : (
                                  <Upload className="w-5 h-5 text-white" />
                                )}
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      handleImageUpload(product.id, e.target.files[0]);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{product.name}</span>
                                {product.sku && (
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {product.sku}
                                  </Badge>
                                )}
                                {!product.enabled && <Badge variant="secondary">Hidden</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{product.short_description}</p>
                              {product.hcpcs_codes?.length > 0 && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  <Tag className="w-3 h-3 text-muted-foreground" />
                                  {product.hcpcs_codes.slice(0, 3).map(code => (
                                    <Badge key={code} variant="outline" className="text-xs">{code}</Badge>
                                  ))}
                                  {product.hcpcs_codes.length > 3 && (
                                    <span className="text-xs text-muted-foreground">+{product.hcpcs_codes.length - 3} more</span>
                                  )}
                                </div>
                              )}
                              {/* Supplier Badges */}
                              {product.supplier_ids?.length > 0 && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  <Truck className="w-3 h-3 text-blue-500" />
                                  {getSupplierNames(product.supplier_ids).slice(0, 2).map((name, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                      {name}
                                    </Badge>
                                  ))}
                                  {product.supplier_ids.length > 2 && (
                                    <span className="text-xs text-muted-foreground">+{product.supplier_ids.length - 2} more</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Upload Image Button */}
                              <label className="cursor-pointer">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  asChild
                                  title="Upload image"
                                  disabled={uploadingImage === product.id}
                                  data-testid={`upload-image-btn-${product.id}`}
                                >
                                  <span>
                                    {uploadingImage === product.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Upload className="w-4 h-4" />
                                    )}
                                  </span>
                                </Button>
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      handleImageUpload(product.id, e.target.files[0]);
                                    }
                                  }}
                                />
                              </label>
                              {/* Search Image Button */}
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleSearchProductImage(product)}
                                title="Search for images"
                              >
                                <Search className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setEditingProduct(editingProduct === product.id ? null : product.id)}
                                title="Edit product"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleToggleProductEnabled(product.id, product.enabled)}
                                title={product.enabled ? 'Hide from catalog' : 'Show in catalog'}
                              >
                                {product.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            {/* Image Picker - shown when searching for images */}
                            {(showImagePicker === product.id || imageSearchResults[product.id]?.length > 0) && (
                              <div className="col-span-full mt-3 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium text-purple-900 flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4" />
                                    Select an image for {product.name}
                                  </h4>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setShowImagePicker(null);
                                      setImageSearchResults(prev => {
                                        const updated = {...prev};
                                        delete updated[product.id];
                                        return updated;
                                      });
                                    }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                                
                                {imageSearchResults[product.id]?.length > 0 ? (
                                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                    {imageSearchResults[product.id].map((img, idx) => (
                                      <button
                                        key={img.id || idx}
                                        onClick={() => handleSetImageFromUrl(product.id, img.download_url || img.url)}
                                        disabled={uploadingImage === product.id}
                                        className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500 transition-all hover:scale-105"
                                      >
                                        <img 
                                          src={img.thumb || img.url} 
                                          alt={`Option ${idx + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                        {uploadingImage === product.id && (
                                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                ) : imageSearchResults[product.id]?.message ? (
                                  <div className="text-sm text-purple-700">
                                    <p className="mb-2">{imageSearchResults[product.id].message}</p>
                                    <p>Search manually:</p>
                                    <div className="flex gap-2 mt-2">
                                      {imageSearchResults[product.id]?.suggested_sources?.map((src, idx) => (
                                        <a 
                                          key={idx}
                                          href={src.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-purple-600 hover:underline"
                                        >
                                          {src.name}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                                    <span className="ml-2 text-purple-700">Searching for images...</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Edit Product Inline Form */}
                            {editingProduct === product.id && (
                              <div className="col-span-full mt-3 p-4 bg-muted/50 rounded-lg">
                                <ProductEditForm 
                                  product={product} 
                                  onSave={(updates) => handleUpdateProduct(product.id, updates)}
                                  onCancel={() => setEditingProduct(null)}
                                />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// Product Edit Form Component
function ProductEditForm({ product, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: product.name || '',
    sku: product.sku || '',
    short_description: product.short_description || '',
    full_description: product.full_description || '',
    image_url: product.image_url || '',
    meta_title: product.meta_title || '',
    meta_description: product.meta_description || '',
    meta_keywords: product.meta_keywords || '',
    hcpcs_codes: product.hcpcs_codes?.join(', ') || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      hcpcs_codes: formData.hcpcs_codes.split(',').map(c => c.trim()).filter(c => c)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Product Name</Label>
          <Input 
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div>
          <Label>SKU</Label>
          <Input 
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>Short Description</Label>
        <Input 
          value={formData.short_description}
          onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
        />
      </div>
      <div>
        <Label>Full Description</Label>
        <Textarea 
          value={formData.full_description}
          onChange={(e) => setFormData({ ...formData, full_description: e.target.value })}
          rows={3}
        />
      </div>
      <div>
        <Label>Image URL</Label>
        <Input 
          value={formData.image_url}
          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
        />
      </div>
      <div>
        <Label>HCPCS Codes (comma-separated)</Label>
        <Input 
          value={formData.hcpcs_codes}
          onChange={(e) => setFormData({ ...formData, hcpcs_codes: e.target.value })}
          placeholder="E0601, E0470, E0471"
        />
      </div>
      
      {/* SEO Fields */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          SEO Settings
        </h4>
        <div className="space-y-3">
          <div>
            <Label>Meta Title</Label>
            <Input 
              value={formData.meta_title}
              onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
            />
          </div>
          <div>
            <Label>Meta Description</Label>
            <Textarea 
              value={formData.meta_description}
              onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <Label>Meta Keywords</Label>
            <Input 
              value={formData.meta_keywords}
              onChange={(e) => setFormData({ ...formData, meta_keywords: e.target.value })}
            />
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          <Save className="w-4 h-4 mr-1" />
          Save Changes
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
