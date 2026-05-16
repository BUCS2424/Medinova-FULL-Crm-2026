import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import { PublicBrandLogo } from '../components/PublicBrandLogo';
import { PublicMobileMenu } from '../components/PublicMobileMenu';
import { 
  Package, 
  ChevronRight, 
  Phone, 
  ArrowLeft,
  Loader2,
  Shield,
  Truck,
  CheckCircle,
  X,
  ShoppingCart,
  FileText,
  Clock,
  User,
  Mail,
  MapPin,
  MessageSquare,
  Send,
  BadgeCheck,
  Tag,
  Info,
  Heart,
  Share2,
  Printer
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const SITE_URL = 'https://medinovadme.com';

// Default product images by category
const defaultProductImages = {
  'Emergency / Monitoring': 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=600&fit=crop',
  'Pain Management / Therapeutic': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop',
  'Mobility': 'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&h=600&fit=crop',
  'Lifts / Transfer Equipment': 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&h=600&fit=crop',
  'Orthopedic / Orthotics': 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&h=600&fit=crop',
  'Respiratory / Oxygen': 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&h=600&fit=crop',
  'Hospital Beds / Bedroom': 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&h=600&fit=crop',
  'Urology / Ostomy / Clinical': 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&h=600&fit=crop',
  'Enteral Nutrition': 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=800&h=600&fit=crop',
  'Compression / Wound Care': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=800&h=600&fit=crop',
  'Diabetes Supplies': 'https://images.unsplash.com/photo-1593491034932-844ab981ed7c?w=800&h=600&fit=crop',
  'Bath Safety': 'https://images.unsplash.com/photo-1552693673-1bf958298935?w=800&h=600&fit=crop',
};

// Request Info Modal Component
function RequestInfoModal({ isOpen, onClose, product }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    zipCode: '',
    bestTime: 'morning',
    notes: '',
    consentContact: false,
    consentHipaa: false,
    consentInsurance: false,
    consentSms: false,
    consentTcpa: false,
    signature: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [consentError, setConsentError] = useState('');
  const formRef = useRef(null);

  // Consent language constants for audit trail
  const CONSENT_LANGUAGE = {
    contact: "I consent to be contacted by MediNova Medical Supplies via phone, text, or email regarding my equipment request. I understand I may receive automated calls or text messages at the number provided.",
    hipaa: "I authorize MediNova Medical Supplies to obtain and share my health information with my physician and insurance company for the purpose of processing this request.",
    insurance: "I understand that equipment coverage is subject to insurance verification and approval, and I may be responsible for any costs not covered by my insurance.",
    sms: "I consent to receive SMS text messages from MediNova Medical Supplies for appointment reminders, order updates, and promotional messages. Message and data rates may apply. Text STOP to opt out.",
    tcpa: "By providing my phone number and checking this box, I give express written consent under the Telephone Consumer Protection Act (TCPA) to receive calls and texts, including those made using an automatic telephone dialing system or prerecorded voice, from MediNova Medical Supplies or its representatives."
  };
  const CONSENT_VERSION = "1.2";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setConsentError('');
    
    // Validate consent boxes
    if (!formData.consentContact) {
      setConsentError('Please check the Consent to Contact box to continue');
      return;
    }
    if (!formData.consentHipaa) {
      setConsentError('Please check the HIPAA/PHI Permission box to continue');
      return;
    }
    if (!formData.consentInsurance) {
      setConsentError('Please check the Insurance Understanding box to continue');
      return;
    }
    if (!formData.signature.trim()) {
      setConsentError('Please type your full legal name as electronic signature');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Capture form HTML snapshot for audit trail
      let formHtmlSnapshot = '';
      if (formRef.current) {
        formHtmlSnapshot = formRef.current.innerHTML;
      }

      // Build full consent language that was displayed
      const fullConsentLanguage = [
        `CONSENT TO CONTACT: ${CONSENT_LANGUAGE.contact}`,
        `HIPAA/PHI PERMISSION: ${CONSENT_LANGUAGE.hipaa}`,
        `INSURANCE UNDERSTANDING: ${CONSENT_LANGUAGE.insurance}`,
        formData.consentSms ? `SMS CONSENT: ${CONSENT_LANGUAGE.sms}` : '',
        formData.consentTcpa ? `TCPA CONSENT: ${CONSENT_LANGUAGE.tcpa}` : ''
      ].filter(Boolean).join('\n\n');

      await axios.post(`${API_URL}/api/public/leads`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        email: formData.email,
        zipCode: formData.zipCode,
        bestTime: formData.bestTime,
        message: formData.notes,
        formType: 'product_detail',
        // Consent fields
        consentContact: formData.consentContact,
        consentHipaa: formData.consentHipaa,
        consentInsurance: formData.consentInsurance,
        consentSms: formData.consentSms,
        consentTcpa: formData.consentTcpa,
        electronicSignature: formData.signature,
        // Audit trail data
        consentLanguage: fullConsentLanguage,
        consentVersion: CONSENT_VERSION,
        formHtmlSnapshot: formHtmlSnapshot,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        referrer: document.referrer,
        landing_page: window.location.href,
        // UTM params from URL
        utm_source: new URLSearchParams(window.location.search).get('utm_source'),
        utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
        utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign')
      });
      
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit:', error);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      zipCode: '',
      bestTime: 'morning',
      notes: '',
      consentContact: false,
      consentHipaa: false,
      consentInsurance: false,
      consentSms: false,
      consentTcpa: false,
      signature: ''
    });
    setSubmitted(false);
    setConsentError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto" onClick={handleClose}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200 my-8"
          onClick={e => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-gray-100 p-6 rounded-t-3xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Request Information</h2>
              {product && (
                <p className="text-lime-600 font-medium mt-1 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {product.name}
                </p>
              )}
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h3>
              <p className="text-gray-600 mb-6">
                A specialist will contact you within 24 hours to discuss your eligibility for {product?.name}.
              </p>
              <button 
                onClick={handleClose}
                className="bg-gradient-to-r from-lime-500 to-lime-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-lime-600 hover:to-lime-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5" data-consent-form="true">
              <div className="bg-lime-50 border border-lime-200 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-lime-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  We'll verify your Medicare eligibility and coordinate with your doctor to get you the equipment you need at little to no cost.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Best Time to Call
                  </label>
                  <select
                    value={formData.bestTime}
                    onChange={(e) => setFormData({ ...formData, bestTime: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none"
                  >
                    <option value="morning">Morning (9am - 12pm)</option>
                    <option value="afternoon">Afternoon (12pm - 4pm)</option>
                    <option value="evening">Evening (4pm - 6pm)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Additional Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none resize-none"
                />
              </div>

              {/* Consent & Authorization Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3" data-consent-section="true">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">!</div>
                  <h4 className="text-sm font-semibold text-gray-900">Consent & Authorization</h4>
                </div>
                
                {consentError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {consentError}
                  </div>
                )}
                
                <label className="flex items-start gap-2 cursor-pointer" data-consent-type="contact">
                  <input type="checkbox" checked={formData.consentContact} onChange={(e) => setFormData({ ...formData, consentContact: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-lime-500 rounded border-gray-300 focus:ring-lime-500" />
                  <span className="text-xs text-gray-700"><strong>Consent to Contact:</strong> {CONSENT_LANGUAGE.contact}</span>
                </label>
                
                <label className="flex items-start gap-2 cursor-pointer" data-consent-type="hipaa">
                  <input type="checkbox" checked={formData.consentHipaa} onChange={(e) => setFormData({ ...formData, consentHipaa: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-lime-500 rounded border-gray-300 focus:ring-lime-500" />
                  <span className="text-xs text-gray-700"><strong>HIPAA / PHI Permission:</strong> {CONSENT_LANGUAGE.hipaa}</span>
                </label>
                
                <label className="flex items-start gap-2 cursor-pointer" data-consent-type="insurance">
                  <input type="checkbox" checked={formData.consentInsurance} onChange={(e) => setFormData({ ...formData, consentInsurance: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-lime-500 rounded border-gray-300 focus:ring-lime-500" />
                  <span className="text-xs text-gray-700"><strong>Insurance Understanding:</strong> {CONSENT_LANGUAGE.insurance}</span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer" data-consent-type="sms">
                  <input type="checkbox" checked={formData.consentSms} onChange={(e) => setFormData({ ...formData, consentSms: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-lime-500 rounded border-gray-300 focus:ring-lime-500" />
                  <span className="text-xs text-gray-700"><strong>SMS Consent (Optional):</strong> {CONSENT_LANGUAGE.sms}</span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer" data-consent-type="tcpa">
                  <input type="checkbox" checked={formData.consentTcpa} onChange={(e) => setFormData({ ...formData, consentTcpa: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-lime-500 rounded border-gray-300 focus:ring-lime-500" />
                  <span className="text-xs text-gray-700"><strong>TCPA Consent (Optional):</strong> {CONSENT_LANGUAGE.tcpa}</span>
                </label>
                
                <div className="pt-3 border-t border-blue-200">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Electronic Signature (Type Full Name) *</label>
                  <input type="text" value={formData.signature} onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                    placeholder="Type your full legal name" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 bg-white" data-field="electronic-signature" />
                  <p className="text-xs text-gray-500 mt-1">By typing your name above, you confirm you have read, understood, and agree to the terms stated. Timestamp and IP address will be recorded.</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Request Information
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { productSlug, categorySlug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [productSlug]);

  const fetchProduct = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/public/products/${productSlug}`);
      setProduct(response.data);
    } catch (err) {
      setError('Product not found');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultImage = () => {
    if (product?.category?.name && defaultProductImages[product.category.name]) {
      return defaultProductImages[product.category.name];
    }
    return 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=600&fit=crop';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h1>
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
          <Link to="/products" className="text-lime-600 hover:text-lime-700 font-medium">
            ← Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.short_description || product.full_description,
    "image": product.image_url || getDefaultImage(),
    "sku": product.sku,
    "brand": {
      "@type": "Brand",
      "name": "MediNova Medical Supplies"
    },
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "seller": {
        "@type": "Organization",
        "name": "MediNova Medical Supplies"
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "127"
    }
  };
  const menuItems = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'products', label: 'Products', href: '/products' },
    { key: 'service-areas', label: 'Coverage Areas', href: '/locations' },
    { key: 'resources', label: 'Medicare Resources', href: '/medicare-resources' },
    { key: 'login', label: 'Patient Login', href: '/login' },
  ];

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{product.meta_title || `${product.name} | Medicare-Covered DME | MediNova Medical Supplies`}</title>
        <meta name="description" content={product.meta_description || product.short_description} />
        <meta name="keywords" content={product.meta_keywords || `${product.name}, Medicare DME, medical equipment`} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={categorySlug ? `${SITE_URL}/products/${categorySlug}/${product.slug}` : `${SITE_URL}/products/${product.slug}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={product.name} />
        <meta property="og:description" content={product.short_description} />
        <meta property="og:image" content={product.image_url || getDefaultImage()} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={categorySlug ? `${SITE_URL}/products/${categorySlug}/${product.slug}` : `${SITE_URL}/products/${product.slug}`} />
        <meta property="og:site_name" content="MediNova Medical Supplies" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={product.name} />
        <meta name="twitter:description" content={product.short_description} />
        <meta name="twitter:image" content={product.image_url || getDefaultImage()} />
        <meta name="twitter:url" content={categorySlug ? `${SITE_URL}/products/${categorySlug}/${product.slug}` : `${SITE_URL}/products/${product.slug}`} />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-primary-50/40 to-white">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 text-navy-700 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <PublicBrandLogo testIdPrefix="product-detail-header-logo" />
              <div className="flex items-center gap-4">
                <nav className="hidden lg:flex items-center gap-6 text-sm text-slate-600">
                  <a href="/products" className="text-navy-700 font-semibold">Products</a>
                  <a href="/locations" className="hover:text-navy-700 transition-colors">Coverage Areas</a>
                  <a href="/medicare-resources" className="hover:text-navy-700 transition-colors">Resources</a>
                </nav>
                <a 
                  href="tel:2488864363" 
                  className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 px-4 py-2 rounded-xl font-medium transition-all shadow-lg"
                  data-testid="product-detail-call-button"
                >
                  <Phone className="w-4 h-4" />
                  (248) 886-4-DME
                </a>
                <div className="lg:hidden">
                  <PublicMobileMenu
                    pageKey="product-detail"
                    items={menuItems}
                    title="Product Navigation"
                    description="Move between products, service areas, and support from one quick menu."
                    primaryHref={`/get-started?formType=product_page&pain=${categorySlug || productSlug || ''}`}
                    primaryLabel="Check Eligibility"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Breadcrumb */}
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
              <Link to="/" className="text-lime-600 hover:text-lime-700">Home</Link>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <Link to="/products" className="text-lime-600 hover:text-lime-700">Products</Link>
              {(product.category || categorySlug) && (
                <>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <Link to={`/products/category/${categorySlug || product.category?.slug || ''}`} className="text-lime-600 hover:text-lime-700">
                    {product.category?.name || product.category_name || categorySlug}
                  </Link>
                </>
              )}
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</span>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Product Image */}
            <div className="space-y-4">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-gray-100 shadow-lg ring-1 ring-primary-100">
                <img 
                  src={product.image_url || getDefaultImage()}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = getDefaultImage(); }}
                />
                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  <span className="bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                    <BadgeCheck className="w-4 h-4" />
                    Medicare Covered
                  </span>
                  {product.sku && (
                    <span className="bg-white/90 backdrop-blur text-gray-700 text-sm font-mono px-3 py-1 rounded-full shadow">
                      {product.sku}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <Heart className="w-5 h-5" />
                  Save
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <Share2 className="w-5 h-5" />
                  Share
                </button>
                <button 
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Printer className="w-5 h-5" />
                  Print
                </button>
              </div>
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              {/* Category Badge */}
              {product.category && (
                <span className="inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium">
                  {product.category.name}
                </span>
              )}
              
              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{product.name}</h1>
              
              {/* Short Description */}
              <p className="text-xl text-gray-600">{product.short_description}</p>
              
              {/* Features */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-lime-50 rounded-xl border border-lime-100">
                  <CheckCircle className="w-6 h-6 text-lime-600" />
                  <span className="font-medium text-lime-800">Little to No Cost</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <Truck className="w-6 h-6 text-primary-600" />
                  <span className="font-medium text-primary-800">Free Delivery</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <FileText className="w-6 h-6 text-navy-700" />
                  <span className="font-medium text-navy-700">Rx Assistance</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <Shield className="w-6 h-6 text-emerald-600" />
                  <span className="font-medium text-emerald-800">Expert Support</span>
                </div>
              </div>
              
              {/* HCPCS Codes */}
              {product.hcpcs_codes && product.hcpcs_codes.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Medicare HCPCS Codes</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.hcpcs_codes.map(code => (
                      <span key={code} className="bg-white border border-gray-200 px-3 py-1 rounded-lg text-sm font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* CTA Button */}
              <button
                onClick={() => setModalOpen(true)}
                className="w-full bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-lg hover:shadow-xl"
                data-testid="request-info-btn"
              >
                <ShoppingCart className="w-6 h-6" />
                Request Information
              </button>
              
              {/* Phone CTA */}
              <div className="text-center">
                <span className="text-gray-500">or call us directly</span>
                <a href="tel:2488864363" className="block text-2xl font-bold text-lime-600 hover:text-lime-700 mt-1">
                  (248) 886-4-DME
                </a>
              </div>
            </div>
          </div>

          {/* Full Description */}
          {product.full_description && (
            <div className="mt-12 p-8 bg-white rounded-3xl border shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Product</h2>
              <p className="text-gray-600 leading-relaxed">{product.full_description}</p>
              
              {/* Features List */}
              {product.features && product.features.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Features</h3>
                  <ul className="grid md:grid-cols-2 gap-2">
                    {product.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Benefits List */}
              {product.benefits && product.benefits.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Benefits</h3>
                  <ul className="grid md:grid-cols-2 gap-2">
                    {product.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-gray-600">
                        <BadgeCheck className="w-5 h-5 text-lime-500 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Back to Products */}
          <div className="mt-8 text-center">
            <Link 
              to="/products"
              className="inline-flex items-center gap-2 text-lime-600 hover:text-lime-700 font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to All Products
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-navy-900 text-white py-12 mt-16">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-gray-400">
              © {new Date().getFullYear()} MediNova Medical Supplies. Medicare-Accredited DME Supplier.
            </p>
          </div>
        </footer>

        {/* Request Info Modal */}
        <RequestInfoModal 
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          product={product}
        />
      </div>
    </>
  );
}
