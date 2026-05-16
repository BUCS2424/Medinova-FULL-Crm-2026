import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import TestimonialsSection from '../components/TestimonialsSection';
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
  Search,
  X,
  ShoppingCart,
  Info,
  FileText,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Send,
  BadgeCheck,
  Sparkles,
  Grid3X3,
  List,
  Star,
  Heart,
  Zap,
  Award,
  HeartPulse,
  Activity,
  Wind,
  Accessibility,
  ArrowUpDown,
  Bone,
  Bed,
  Droplets,
  Utensils,
  Syringe,
  Bath,
  ChevronDown
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const SITE_URL = 'https://medinovadme.com';
const OG_IMAGE = 'https://customer-assets.emergentagent.com/job_7965af6d-d9f9-48a9-9447-d2e9a0ead878/artifacts/e812a763_durable-medical-equipment-wheelchair.jpg';

// Category icons mapping
const categoryIcons = {
  'Emergency / Monitoring': Activity,
  'Pain Management / Therapeutic': Zap,
  'Mobility': Accessibility,
  'Lifts / Transfer Equipment': ArrowUpDown,
  'Orthopedic / Orthotics': Bone,
  'Respiratory / Oxygen': Wind,
  'Hospital Beds / Bedroom': Bed,
  'Urology / Ostomy / Clinical': Droplets,
  'Enteral Nutrition': Utensils,
  'Compression / Wound Care': HeartPulse,
  'Diabetes Supplies': Syringe,
  'Bath Safety': Bath,
};

// Category color schemes with rich gradients
const categoryColors = {
  'Emergency / Monitoring': { 
    gradient: 'from-navy-700 via-navy-800 to-slate-700', 
    bg: 'bg-navy-700/10', 
    glow: 'shadow-navy-700/20',
    accent: 'text-navy-700'
  },
  'Pain Management / Therapeutic': { 
    gradient: 'from-lime-500 via-lime-400 to-emerald-500', 
    bg: 'bg-lime-500/10',
    glow: 'shadow-lime-500/20',
    accent: 'text-lime-600'
  },
  'Mobility': { 
    gradient: 'from-sky-500 via-cyan-500 to-navy-700', 
    bg: 'bg-sky-500/10',
    glow: 'shadow-sky-500/20',
    accent: 'text-sky-600'
  },
  'Lifts / Transfer Equipment': { 
    gradient: 'from-lime-500 via-lime-400 to-green-500', 
    bg: 'bg-emerald-500/10',
    glow: 'shadow-emerald-500/20',
    accent: 'text-emerald-500'
  },
  'Orthopedic / Orthotics': { 
    gradient: 'from-lime-400 via-lime-500 to-lime-600', 
    bg: 'bg-lime-500/10',
    glow: 'shadow-lime-500/20',
    accent: 'text-lime-500'
  },
  'Respiratory / Oxygen': { 
    gradient: 'from-emerald-500 via-teal-500 to-sky-500', 
    bg: 'bg-cyan-500/10',
    glow: 'shadow-cyan-500/20',
    accent: 'text-cyan-500'
  },
  'Hospital Beds / Bedroom': { 
    gradient: 'from-slate-500 via-slate-600 to-navy-700', 
    bg: 'bg-slate-500/10',
    glow: 'shadow-slate-500/20',
    accent: 'text-slate-500'
  },
  'Urology / Ostomy / Clinical': { 
    gradient: 'from-emerald-500 via-lime-500 to-teal-500', 
    bg: 'bg-emerald-500/10',
    glow: 'shadow-emerald-500/20',
    accent: 'text-emerald-600'
  },
  'Enteral Nutrition': { 
    gradient: 'from-lime-500 via-emerald-500 to-green-500', 
    bg: 'bg-lime-500/10',
    glow: 'shadow-lime-500/20',
    accent: 'text-lime-600'
  },
  'Compression / Wound Care': { 
    gradient: 'from-navy-700 via-sky-500 to-cyan-500', 
    bg: 'bg-sky-500/10',
    glow: 'shadow-sky-500/20',
    accent: 'text-sky-600'
  },
  'Diabetes Supplies': { 
    gradient: 'from-lime-500 via-emerald-500 to-navy-700', 
    bg: 'bg-lime-500/10',
    glow: 'shadow-lime-500/20',
    accent: 'text-lime-600'
  },
  'Bath Safety': { 
    gradient: 'from-sky-500 via-cyan-500 to-lime-500', 
    bg: 'bg-sky-500/10',
    glow: 'shadow-sky-500/20',
    accent: 'text-sky-500'
  },
};

// Default product images by category
const defaultProductImages = {
  'Emergency / Monitoring': 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop',
  'Pain Management / Therapeutic': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
  'Mobility': 'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=400&h=300&fit=crop',
  'Lifts / Transfer Equipment': 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400&h=300&fit=crop',
  'Orthopedic / Orthotics': 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&h=300&fit=crop',
  'Respiratory / Oxygen': 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=400&h=300&fit=crop',
  'Hospital Beds / Bedroom': 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop',
  'Urology / Ostomy / Clinical': 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=300&fit=crop',
  'Enteral Nutrition': 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400&h=300&fit=crop',
  'Compression / Wound Care': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&h=300&fit=crop',
  'Diabetes Supplies': 'https://images.unsplash.com/photo-1593491034932-844ab981ed7c?w=400&h=300&fit=crop',
  'Bath Safety': 'https://images.unsplash.com/photo-1552693673-1bf958298935?w=400&h=300&fit=crop',
};

// Request Info Modal Component
function RequestInfoModal({ isOpen, onClose, product, categoryName }) {
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
    signature: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [consentError, setConsentError] = useState('');

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
      await axios.post(`${API_URL}/api/public/leads`, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        email: formData.email,
        zip_code: formData.zipCode,
        best_call_time: formData.bestTime,
        notes: formData.notes,
        form_source: 'product',
        product_tags: [product?.name || 'General Inquiry'],
        pain_location: categoryName || 'other',
        status: 'new',
        consent_contact: formData.consentContact,
        consent_hipaa: formData.consentHipaa,
        consent_insurance: formData.consentInsurance,
        electronic_signature: formData.signature
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
    setFormData({ firstName: '', lastName: '', phone: '', email: '', zipCode: '', bestTime: 'morning', notes: '', consentContact: false, consentHipaa: false, consentInsurance: false, signature: '' });
    setSubmitted(false);
    setConsentError('');
  };

  const handleClose = () => { resetForm(); onClose(); };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 overflow-y-auto" onClick={handleClose}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-300 my-8 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Gradient Header */}
          <div className="relative bg-gradient-to-r from-lime-500 via-lime-600 to-emerald-600 p-6 text-white">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Request Information</h2>
                  {product && (
                    <p className="text-white/90 font-medium mt-1 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      {product.name}
                    </p>
                  )}
                </div>
                <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h3>
                <p className="text-gray-600 mb-6">A specialist will contact you within 24 hours.</p>
                <button onClick={handleClose} className="bg-gradient-to-r from-lime-500 to-lime-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all">
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-lime-200 rounded-xl p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-lime-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">We'll verify your Medicare eligibility and coordinate with your doctor.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                    <input type="text" required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                    <input type="text" required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"><Phone className="w-4 h-4 inline mr-1" />Phone *</label>
                  <input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none transition-all" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"><Mail className="w-4 h-4 inline mr-1" />Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2"><MapPin className="w-4 h-4 inline mr-1" />ZIP *</label>
                    <input type="text" required value={formData.zipCode} onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2"><Clock className="w-4 h-4 inline mr-1" />Best Time</label>
                    <select value={formData.bestTime} onChange={(e) => setFormData({ ...formData, bestTime: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none transition-all">
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2"><MessageSquare className="w-4 h-4 inline mr-1" />Notes</label>
                  <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none transition-all resize-none" />
                </div>

                {/* Consent & Authorization Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">!</div>
                    <h4 className="text-sm font-semibold text-gray-900">Consent & Authorization</h4>
                  </div>
                  
                  {consentError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                      {consentError}
                    </div>
                  )}
                  
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.consentContact} onChange={(e) => setFormData({ ...formData, consentContact: e.target.checked })}
                      className="w-4 h-4 mt-0.5 text-lime-500 rounded border-gray-300 focus:ring-lime-500" />
                    <span className="text-xs text-gray-700"><strong>Consent to Contact:</strong> I consent to be contacted by MediNova Medical Supplies via phone, text, or email regarding my equipment request.</span>
                  </label>
                  
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.consentHipaa} onChange={(e) => setFormData({ ...formData, consentHipaa: e.target.checked })}
                      className="w-4 h-4 mt-0.5 text-lime-500 rounded border-gray-300 focus:ring-lime-500" />
                    <span className="text-xs text-gray-700"><strong>HIPAA / PHI Permission:</strong> I authorize MediNova Medical Supplies to obtain and share my health information with my physician and insurance company for the purpose of processing this request.</span>
                  </label>
                  
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.consentInsurance} onChange={(e) => setFormData({ ...formData, consentInsurance: e.target.checked })}
                      className="w-4 h-4 mt-0.5 text-lime-500 rounded border-gray-300 focus:ring-lime-500" />
                    <span className="text-xs text-gray-700"><strong>Insurance Understanding:</strong> I understand that equipment coverage is subject to insurance verification and approval, and I may be responsible for any costs not covered.</span>
                  </label>
                  
                  <div className="pt-3 border-t border-blue-200">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Electronic Signature (Type Full Name) *</label>
                    <input type="text" value={formData.signature} onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                      placeholder="Type your full legal name" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 bg-white" />
                    <p className="text-xs text-gray-500 mt-1">By typing your name above, you confirm you have read, understood, and agree to the terms stated.</p>
                  </div>
                </div>

                <button type="submit" disabled={submitting}
                  className="w-full bg-gradient-to-r from-lime-500 via-lime-600 to-emerald-600 hover:from-lime-600 hover:via-lime-700 hover:to-emerald-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
                  {submitting ? <><Loader2 className="w-5 h-5 animate-spin" />Submitting...</> : <><Send className="w-5 h-5" />Get Started</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Floating particles background
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-lime-500/20 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${5 + Math.random() * 10}s`
          }}
        />
      ))}
    </div>
  );
}

// Premium Category Card
function CategoryCard({ category, onClick, index }) {
  const colors = categoryColors[category.name] || { gradient: 'from-gray-500 to-gray-600', bg: 'bg-gray-500/10', glow: 'shadow-gray-500/25', accent: 'text-gray-500' };
  const defaultImage = defaultProductImages[category.name] || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop';
  const IconComponent = categoryIcons[category.name] || Package;

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white rounded-3xl overflow-hidden cursor-pointer transform transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2 shadow-lg hover:shadow-2xl ${colors.glow}`}
      style={{ animationDelay: `${index * 100}ms` }}
      data-testid={`category-card-${category.slug}`}
    >
      {/* Image with gradient overlay */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <img 
          src={category.image_url || defaultImage}
          alt={category.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          onError={(e) => { e.target.src = defaultImage; }}
        />
        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-70" />
        <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
        
        {/* Floating icon */}
        <div className={`absolute top-4 right-4 w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-6`}>
          <IconComponent className="w-7 h-7 text-white" />
        </div>
        
        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${colors.gradient} text-white text-sm font-semibold shadow-lg`}>
              {category.products?.length || 0} Products
            </span>
            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
              Medicare Covered
            </span>
          </div>
          <h3 className="font-bold text-2xl text-white mb-1 group-hover:text-lime-300 transition-colors">{category.name}</h3>
          <p className="text-white/70 text-sm line-clamp-1">{category.description}</p>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between border-t border-gray-100">
        <div className="flex items-center gap-2 text-gray-500">
          <Truck className="w-4 h-4" />
          <span className="text-sm">Free Delivery</span>
        </div>
        <div className={`flex items-center gap-2 ${colors.accent} font-semibold text-sm group-hover:gap-3 transition-all`}>
          <span>Explore</span>
          <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* Shine effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>
    </div>
  );
}

// Premium Product Card
function ProductCard({ product, categoryName, categorySlug, onRequestInfo }) {
  const colors = categoryColors[categoryName] || { gradient: 'from-gray-500 to-gray-600', bg: 'bg-gray-500/10', glow: 'shadow-gray-500/25', accent: 'text-gray-500' };
  const defaultImage = defaultProductImages[categoryName] || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop';

  return (
    <div 
      className={`group relative bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2 ${colors.glow}`}
      data-testid={`product-card-${product.slug}`}
    >
      {/* Image */}
      <Link to={categorySlug ? `/products/${categorySlug}/${product.slug}` : `/products/${product.slug}`} className="block relative aspect-square overflow-hidden">
        <img 
          src={product.image_url || defaultImage}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          onError={(e) => { e.target.src = defaultImage; }}
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <BadgeCheck className="w-3.5 h-3.5" />
            Medicare
          </span>
        </div>
        
        {/* SKU */}
        {product.sku && (
          <div className="absolute top-3 right-3">
            <span className="bg-black/70 backdrop-blur-sm text-white text-xs font-mono px-2 py-1 rounded-lg">
              {product.sku}
            </span>
          </div>
        )}

        {/* Quick action on hover */}
        <div className="absolute bottom-4 left-4 right-4 transform translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <span className="block w-full bg-white/95 backdrop-blur text-gray-900 text-center py-3 rounded-xl font-semibold shadow-lg">
            View Details
          </span>
        </div>
      </Link>

      {/* Content */}
      <div className="p-5">
        <Link to={categorySlug ? `/products/${categorySlug}/${product.slug}` : `/products/${product.slug}`}>
          <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-lime-600 transition-colors line-clamp-2 min-h-[3.5rem]">
            {product.name}
          </h3>
        </Link>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
          {product.short_description}
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
            <CheckCircle className="w-3 h-3" /> No Cost
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
            <Truck className="w-3 h-3" /> Free Ship
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={() => onRequestInfo(product)}
          className={`w-full bg-gradient-to-r ${colors.gradient} text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]`}
        >
          <ShoppingCart className="w-4 h-4" />
          Request Info
        </button>
      </div>

      {/* Corner accent */}
      <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${colors.gradient} opacity-10 rounded-bl-full`} />
    </div>
  );
}

// Stats Card
function StatCard({ icon: Icon, value, label, gradient }) {
  return (
    <div className="relative bg-white rounded-2xl p-5 shadow-lg overflow-hidden group hover:shadow-xl transition-shadow">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-10 rounded-bl-full transform group-hover:scale-110 transition-transform`} />
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function ProductCatalogPage() {
  const { categorySlug } = useParams();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchCatalog();
  }, []);

  // Auto-select category from URL slug
  useEffect(() => {
    if (categorySlug && catalog.length > 0) {
      const found = catalog.find(c => c.slug === categorySlug);
      if (found) {
        setSelectedCategory(found);
      }
    } else if (!categorySlug) {
      setSelectedCategory(null);
    }
  }, [categorySlug, catalog]);

  const fetchCatalog = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/public/catalog`);
      setCatalog(response.data);
    } catch (error) {
      console.error('Failed to fetch catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCatalog = catalog.filter(category => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const categoryMatch = category.name.toLowerCase().includes(term);
    const productMatch = category.products?.some(p => 
      p.name.toLowerCase().includes(term) || 
      p.short_description?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term)
    );
    return categoryMatch || productMatch;
  });

  const allFilteredProducts = searchTerm 
    ? filteredCatalog.flatMap(cat => 
        cat.products?.filter(p => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.short_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
        ).map(p => ({ ...p, categoryName: cat.name, categorySlug: cat.slug })) || []
      )
    : [];

  const handleRequestInfo = (product, categoryName) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const getCategoryName = (product) => {
    const cat = catalog.find(c => c.id === product.category_id);
    return cat?.name || '';
  };

  const totalProducts = catalog.reduce((sum, cat) => sum + (cat.products?.length || 0), 0);
  const menuItems = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'products', label: 'Products', href: '/products' },
    { key: 'service-areas', label: 'Coverage Areas', href: '/locations' },
    { key: 'resources', label: 'Medicare Resources', href: '/medicare-resources' },
    { key: 'login', label: 'Patient Login', href: '/login' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100/60 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-r from-lime-500 to-lime-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse shadow-lg shadow-lime-500/30">
              <ShoppingCart className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-2xl bg-gradient-to-r from-lime-500 to-lime-600 animate-ping opacity-30" />
          </div>
          <Loader2 className="w-8 h-8 animate-spin text-lime-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/40 via-white to-gray-50">
      <Helmet>
        <title>{selectedCategory ? `${selectedCategory.name} | MediNova Medical Supplies` : 'MediNova Products | Medicare-covered Medical Equipment Catalog'}</title>
        <meta
          name="description"
          content={selectedCategory 
            ? `Browse ${selectedCategory.name} from MediNova Medical Supplies. ${selectedCategory.description || 'Medicare-covered durable medical equipment with free delivery.'}`
            : 'Browse Medicare-covered DME products from MediNova Medical Supplies, including mobility equipment, braces, respiratory support, hospital beds, and more.'
          }
        />
        <link rel="canonical" href={selectedCategory ? `${SITE_URL}/products/category/${selectedCategory.slug}` : `${SITE_URL}/products`} />
        <meta property="og:title" content={selectedCategory ? `${selectedCategory.name} | MediNova Medical Supplies` : 'MediNova Products | Medicare-covered Medical Equipment Catalog'} />
        <meta
          property="og:description"
          content={selectedCategory 
            ? `Browse ${selectedCategory.name} from MediNova Medical Supplies. ${selectedCategory.description || 'Medicare-covered durable medical equipment with free delivery.'}`
            : 'Browse Medicare-covered DME products from MediNova Medical Supplies, including mobility equipment, braces, respiratory support, hospital beds, and more.'
          }
        />
        <meta property="og:url" content={selectedCategory ? `${SITE_URL}/products/category/${selectedCategory.slug}` : `${SITE_URL}/products`} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={selectedCategory ? `${selectedCategory.name} | MediNova Medical Supplies` : 'MediNova Products | Medicare-covered Medical Equipment Catalog'} />
        <meta
          name="twitter:description"
          content={selectedCategory 
            ? `Browse ${selectedCategory.name} from MediNova Medical Supplies. ${selectedCategory.description || 'Medicare-covered durable medical equipment with free delivery.'}`
            : 'Browse Medicare-covered DME products from MediNova Medical Supplies, including mobility equipment, braces, respiratory support, hospital beds, and more.'
          }
        />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: selectedCategory ? `${selectedCategory.name} - MediNova Medical Supplies` : 'MediNova Product Catalog',
            url: selectedCategory ? `${SITE_URL}/products/category/${selectedCategory.slug}` : `${SITE_URL}/products`,
            description: selectedCategory
              ? `Browse ${selectedCategory.name} from MediNova Medical Supplies. ${selectedCategory.description || ''}`
              : 'Browse Medicare-covered DME products from MediNova Medical Supplies, including mobility equipment, braces, respiratory support, hospital beds, and more.',
            isPartOf: {
              '@type': 'WebSite',
              name: 'MediNova Medical Supplies',
              url: SITE_URL,
            },
          })}
        </script>
      </Helmet>
      {/* Hero Header */}
      <header className="relative bg-gradient-to-br from-primary-50 via-white to-primary-50/40 text-navy-700 overflow-hidden border-b border-gray-100 shadow-sm">
        <FloatingParticles />
        
        {/* Navigation */}
        <nav className="relative z-10 max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <PublicBrandLogo testIdPrefix="product-catalog-header-logo" />
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-6 text-sm text-slate-600">
                <a href="/products" className="text-navy-700 font-semibold">Products</a>
                <a href="/locations" className="hover:text-navy-700 transition-colors">Coverage Areas</a>
                <a href="/medicare-resources" className="hover:text-navy-700 transition-colors">Resources</a>
              </div>
              <a href="tel:2488864363" className="hidden md:flex items-center gap-2 bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-lime-500/30 hover:shadow-lime-500/50 hover:scale-105">
                <Phone className="w-4 h-4" />
                (248) 886-4-DME
              </a>
              <a href="/login" className="hidden md:inline-flex text-slate-600 hover:text-navy-700 transition-colors">Portal</a>
              <div className="lg:hidden">
                <PublicMobileMenu
                  pageKey="product-catalog"
                  items={menuItems}
                  title="Browse Products"
                  description="Shop categories, compare options, and request Medicare-covered equipment support."
                  primaryHref="/get-started?formType=product_catalog"
                  primaryLabel="Request Callback"
                />
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        {!selectedCategory && (
          <div className="relative z-10 max-w-7xl mx-auto px-4 py-16 md:py-24 pb-20 md:pb-28 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 border border-primary-200 rounded-full text-primary-700 text-sm mb-6">
              <Sparkles className="w-4 h-4 text-primary-600" />
              <span>Medicare-Covered Equipment</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-navy-700">
              Medical Equipment
              <span className="block text-primary-500">
                Delivered to Your Door
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              Quality durable medical equipment covered by Medicare. Free delivery, expert support, and zero hassle.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search wheelchairs, CPAP, braces..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-14 py-4 bg-white border border-gray-200 rounded-2xl text-navy-700 placeholder-gray-400 focus:border-lime-500 outline-none transition-all shadow-sm"
                data-testid="catalog-search-input"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy-700">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-8 mt-12">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-500">{catalog.length}</p>
                <p className="text-sm text-gray-500">Categories</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-500">{totalProducts}+</p>
                <p className="text-sm text-gray-500">Products</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-500">100%</p>
                <p className="text-sm text-gray-500">Medicare Covered</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-500">Free</p>
                <p className="text-sm text-gray-500">Home Delivery</p>
              </div>
            </div>
          </div>
        )}

        {/* Category Header */}
        {selectedCategory && (
          <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
            <button
              onClick={() => navigate('/products')}
              className="flex items-center gap-2 text-lime-600 hover:text-lime-700 font-medium mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Categories
            </button>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${categoryColors[selectedCategory.name]?.gradient || 'from-gray-500 to-gray-600'} flex items-center justify-center shadow-lg`}>
                {(() => { const Icon = categoryIcons[selectedCategory.name] || Package; return <Icon className="w-8 h-8 text-white" />; })()}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">{selectedCategory.name}</h1>
                <p className="text-gray-500 mt-1">{selectedCategory.products?.length || 0} Products Available</p>
              </div>
            </div>
          </div>
        )}

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="currentColor" className="text-gray-50"/>
          </svg>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-8">
          <Link to="/" className="text-lime-600 hover:text-lime-700 font-medium">Home</Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">Products</span>
          {selectedCategory && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900 font-medium">{selectedCategory.name}</span>
            </>
          )}
        </div>

        {/* Search Results */}
        {searchTerm && allFilteredProducts.length > 0 && !selectedCategory && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Search className="w-6 h-6 text-lime-500" />
              Search Results
              <span className="text-lg font-normal text-gray-500">({allFilteredProducts.length} products)</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {allFilteredProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  categoryName={product.categoryName}
                  categorySlug={product.categorySlug}
                  onRequestInfo={(p) => handleRequestInfo(p, product.categoryName)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Categories Grid */}
        {!selectedCategory && !searchTerm && (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Browse Categories</h2>
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow text-lime-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-lime-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className={`grid ${viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`} data-testid="categories-grid">
              {filteredCatalog.length === 0 ? (
                <div className="col-span-full text-center py-20">
                  <Package className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-2xl font-bold text-gray-600 mb-2">No Products Found</h3>
                  <p className="text-gray-500">Try a different search term.</p>
                </div>
              ) : (
                filteredCatalog.map((category, index) => (
                  <CategoryCard 
                    key={category.id}
                    category={category}
                    index={index}
                    onClick={() => navigate(`/products/category/${category.slug}`)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* Products Grid */}
        {selectedCategory && (
          <div className="space-y-8">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Package} value={selectedCategory.products?.length || 0} label="Products" gradient="from-blue-500 to-cyan-500" />
              <StatCard icon={BadgeCheck} value="100%" label="Medicare Covered" gradient="from-green-500 to-emerald-500" />
              <StatCard icon={Truck} value="Free" label="Home Delivery" gradient="from-lime-500 to-lime-600" />
              <StatCard icon={Award} value="Full" label="Rx Support" gradient="from-purple-500 to-violet-500" />
            </div>

            {/* Products */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="products-grid">
              {selectedCategory.products?.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-white rounded-3xl border shadow-sm">
                  <Package className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-2xl font-bold text-gray-600 mb-2">Coming Soon</h3>
                  <p className="text-gray-500">Products in this category are being added.</p>
                </div>
              ) : (
                selectedCategory.products?.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product}
                    categoryName={selectedCategory.name}
                    categorySlug={selectedCategory.slug}
                    onRequestInfo={(p) => handleRequestInfo(p, selectedCategory.name)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Trust Badges */}
        <div className="mt-20 py-12 border-t border-gray-200">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="group">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h3 className="font-bold text-xl text-gray-900 mb-2">Medicare Accepted</h3>
              <p className="text-gray-600">Accredited supplier. Most equipment covered with little to no cost.</p>
            </div>
            <div className="group">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <Truck className="w-10 h-10 text-white" />
              </div>
              <h3 className="font-bold text-xl text-gray-900 mb-2">Free Delivery</h3>
              <p className="text-gray-600">We deliver directly to your door at no additional cost.</p>
            </div>
            <div className="group">
              <div className="w-20 h-20 bg-gradient-to-br from-lime-500 to-lime-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-lime-500/30 group-hover:scale-110 transition-transform">
                <HeartPulse className="w-10 h-10 text-white" />
              </div>
              <h3 className="font-bold text-xl text-gray-900 mb-2">Expert Care</h3>
              <p className="text-gray-600">Insurance verification, doctor coordination, and ongoing support.</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-12 relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50/60 rounded-3xl p-8 md:p-12 text-center border border-primary-100 shadow-xl">
          <FloatingParticles />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-700 mb-4">Ready to Get Started?</h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto text-lg">
              Call us today to check your eligibility and get equipment delivered to your door.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:2488864363"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg shadow-lime-500/30 hover:shadow-lime-500/50 hover:scale-105 text-lg">
                <Phone className="w-5 h-5" />
                Call (248) 886-4-DME
              </a>
              <button
                onClick={() => { setSelectedProduct(null); setModalOpen(true); }}
                className="inline-flex items-center gap-2 bg-white hover:bg-primary-50 text-navy-700 font-semibold px-8 py-4 rounded-xl transition-all border border-gray-200 hover:border-primary-200">
                <Mail className="w-5 h-5" />
                Request Callback
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Testimonials Section - Full Width */}
      <TestimonialsSection />

      {/* Footer */}
      <footer className="bg-navy-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-lime-500 to-lime-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold">MediNova Medical Supplies</h3>
                <p className="text-sm text-gray-400">Medicare DME Supplier</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <Link to="/products" className="hover:text-white transition-colors">Products</Link>
              <Link to="/locations" className="hover:text-white transition-colors">Coverage Areas</Link>
              <Link to="/write-review" className="hover:text-white transition-colors">Write a Review</Link>
            </div>
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} MediNova Medical Supplies</p>
          </div>
        </div>
      </footer>

      {/* Modal */}
      <RequestInfoModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        product={selectedProduct}
        categoryName={selectedProduct ? getCategoryName(selectedProduct) : ''}
      />

      {/* Custom styles for animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.6; }
        }
        .animate-float {
          animation: float 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
