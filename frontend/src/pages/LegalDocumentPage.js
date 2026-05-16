import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useBranding } from '../contexts/BrandingContext';
import { 
  Loader2,
  ArrowLeft,
  FileText,
  Calendar,
  AlertCircle,
  Shield,
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronRight,
  Scale,
  Lock,
  FileCheck,
  Accessibility,
  RotateCcw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Document type icons and colors
const DOC_TYPE_CONFIG = {
  terms:         { icon: Scale,         color: 'from-[#004299] to-[#0070E0]', bg: 'bg-blue-50',  text: 'text-[#0055CC]' },
  privacy:       { icon: Shield,        color: 'from-[#003FA3] to-[#0055CC]', bg: 'bg-blue-50',  text: 'text-[#0055CC]' },
  hipaa:         { icon: Lock,          color: 'from-[#002D80] to-[#0055CC]', bg: 'bg-blue-50',  text: 'text-[#0055CC]' },
  accessibility: { icon: Accessibility, color: 'from-[#0055CC] to-[#0090D0]', bg: 'bg-blue-50',  text: 'text-[#0055CC]' },
  refund:        { icon: RotateCcw,     color: 'from-[#003FA3] to-[#0070E0]', bg: 'bg-blue-50',  text: 'text-[#0055CC]' },
  cookie:        { icon: FileText,      color: 'from-[#004299] to-[#0090D0]', bg: 'bg-blue-50',  text: 'text-[#0055CC]' },
  other:         { icon: FileCheck,     color: 'from-[#0055CC] to-[#00A3E0]', bg: 'bg-blue-50',  text: 'text-[#0055CC]' },
};

export default function LegalDocumentPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState(null);
  const [error, setError] = useState(null);
  const [footerLinks, setFooterLinks] = useState([]);

  useEffect(() => {
    if (slug) {
      fetchDocument();
      fetchFooterLinks();
    }
  }, [slug]);

  const fetchDocument = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/site-documents/public/${slug}`);
      setDocument(res.data);
      
      // Update page title and meta
      if (res.data.meta_title) {
        window.document.title = res.data.meta_title;
      } else {
        window.document.title = `${res.data.title} | MediNova Medical Supplies`;
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Document not found');
    } finally {
      setLoading(false);
    }
  };

  const fetchFooterLinks = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/site-documents/public/list`);
      setFooterLinks(res.data.documents || []);
    } catch (err) {
      console.error('Failed to fetch footer links');
    }
  };

  const docConfig = DOC_TYPE_CONFIG[document?.doc_type] || DOC_TYPE_CONFIG.other;
  const DocIcon = docConfig.icon;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#0055CC] mx-auto mb-4" />
          <p className="text-slate-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50">
        {/* Header */}
        <Header />
        
        <div className="flex items-center justify-center py-24 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Document Not Found</h2>
            <p className="text-slate-600 mb-8">{error}</p>
            <Link 
              to="/"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#0055CC] to-[#0090D0] hover:from-[#004299] hover:to-[#007BB5] text-white px-6 py-3 rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
          </div>
        </div>
        
        <Footer links={footerLinks} currentSlug={slug} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50 flex flex-col">
      {/* Header */}
      <Header />

      {/* Hero Banner */}
      <div className={`bg-gradient-to-r ${docConfig.color} text-white py-12 md:py-16 relative overflow-hidden`}>
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 border-2 border-white rounded-full"></div>
          <div className="absolute bottom-10 right-20 w-48 h-48 border-2 border-white rounded-full"></div>
          <div className="absolute top-1/2 right-1/3 w-24 h-24 border-2 border-white rounded-full"></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hidden md:flex">
              <DocIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 text-white/80 text-sm mb-2">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Legal Document
                </span>
                {document?.last_updated && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      Last updated: {new Date(document.last_updated).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
                {document?.title}
              </h1>
              {document?.description && (
                <p className="text-white/80 mt-3 text-lg max-w-2xl">{document.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <main className="flex-1 py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Table of Contents hint */}
            <div className={`${docConfig.bg} border-b px-6 py-4`}>
              <p className={`text-sm ${docConfig.text} flex items-center gap-2`}>
                <Shield className="w-4 h-4" />
                This document outlines important legal information. Please read carefully.
              </p>
            </div>
            
            {/* Content */}
            <article className="p-8 md:p-12 lg:p-16">
              <div 
                className="legal-document-content"
                dangerouslySetInnerHTML={{ __html: document?.filled_content || document?.content || '' }}
              />
              <style>{`
                .legal-document-content {
                  color: #475569;
                  font-size: 1rem;
                  line-height: 1.8;
                }
                
                .legal-document-content h1 {
                  font-size: 1.875rem;
                  font-weight: 700;
                  color: #0f172a;
                  margin: 0 0 1.5rem 0;
                  padding-bottom: 1rem;
                  border-bottom: 2px solid #e2e8f0;
                }
                
                .legal-document-content h2 {
                  font-size: 1.5rem;
                  font-weight: 700;
                  color: #1e293b;
                  margin: 3rem 0 1.25rem 0;
                  padding-bottom: 0.75rem;
                  border-bottom: 1px solid #e2e8f0;
                }
                
                .legal-document-content h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  color: #334155;
                  margin: 2rem 0 1rem 0;
                }
                
                .legal-document-content h4 {
                  font-size: 1.125rem;
                  font-weight: 600;
                  color: #475569;
                  margin: 1.5rem 0 0.75rem 0;
                }
                
                .legal-document-content p {
                  margin: 0 0 1.25rem 0;
                  color: #475569;
                }
                
                .legal-document-content p:last-child {
                  margin-bottom: 0;
                }
                
                .legal-document-content ul,
                .legal-document-content ol {
                  margin: 1.25rem 0 1.5rem 0;
                  padding-left: 1.75rem;
                }
                
                .legal-document-content ul {
                  list-style-type: disc;
                }
                
                .legal-document-content ol {
                  list-style-type: decimal;
                }
                
                .legal-document-content li {
                  margin: 0.625rem 0;
                  padding-left: 0.5rem;
                  color: #475569;
                }
                
                .legal-document-content li::marker {
                  color: #94a3b8;
                }
                
                .legal-document-content strong,
                .legal-document-content b {
                  font-weight: 600;
                  color: #1e293b;
                }
                
                .legal-document-content a {
                  color: #d97706;
                  text-decoration: none;
                  font-weight: 500;
                  transition: color 0.2s;
                }
                
                .legal-document-content a:hover {
                  color: #b45309;
                  text-decoration: underline;
                }
                
                .legal-document-content blockquote {
                  margin: 1.5rem 0;
                  padding: 1rem 1.5rem;
                  background: #f8fafc;
                  border-left: 4px solid #f59e0b;
                  border-radius: 0 0.5rem 0.5rem 0;
                  font-style: italic;
                  color: #64748b;
                }
                
                .legal-document-content hr {
                  margin: 2.5rem 0;
                  border: none;
                  border-top: 1px solid #e2e8f0;
                }
                
                .legal-document-content table {
                  width: 100%;
                  margin: 1.5rem 0;
                  border-collapse: collapse;
                }
                
                .legal-document-content th,
                .legal-document-content td {
                  padding: 0.75rem 1rem;
                  border: 1px solid #e2e8f0;
                  text-align: left;
                }
                
                .legal-document-content th {
                  background: #f8fafc;
                  font-weight: 600;
                  color: #1e293b;
                }
                
                .legal-document-content td {
                  color: #475569;
                }
                
                /* First paragraph after heading - no top margin needed */
                .legal-document-content h1 + p,
                .legal-document-content h2 + p,
                .legal-document-content h3 + p,
                .legal-document-content h4 + p {
                  margin-top: 0;
                }
                
                /* Spacing between sections */
                .legal-document-content h2:first-child {
                  margin-top: 0;
                }
              `}</style>
            </article>

            {/* Contact Section */}
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-t px-6 md:px-10 py-8">
              <h3 className="font-bold text-navy-700 mb-4">Questions About This Document?</h3>
              <p className="text-slate-600 mb-6">
                If you have any questions or concerns regarding this document, please don't hesitate to contact us.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="tel:2488864363"
                  className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-[#0055CC] hover:bg-blue-50 px-4 py-2 rounded-lg text-slate-700 hover:text-[#0055CC] transition-all"
                >
                  <Phone className="w-4 h-4" />
                  (248) 886-4-DME (4363)
                </a>
                <a
                  href="mailto:info@medinovadme.com"
                  className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-[#0055CC] hover:bg-blue-50 px-4 py-2 rounded-lg text-slate-700 hover:text-[#0055CC] transition-all"
                >
                  <Mail className="w-4 h-4" />
                  info@medinovadme.com
                </a>
              </div>
            </div>
          </div>

          {/* Other Legal Documents */}
          {footerLinks.length > 1 && (
            <div className="mt-12">
              <h3 className="text-lg font-bold text-navy-700 mb-4">Other Legal Documents</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {footerLinks.filter(doc => doc.slug !== slug).map(doc => {
                  const config = DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other;
                  const Icon = config.icon;
                  return (
                    <Link 
                      key={doc.id}
                      to={`/legal/${doc.slug}`}
                      className="group bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 transition-all flex items-center gap-3"
                    >
                      <div className={`p-2 ${config.bg} rounded-lg group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-5 h-5 ${config.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-navy-700 truncate group-hover:text-[#0055CC] transition-colors">
                          {doc.title}
                        </h4>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0055CC] group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer links={footerLinks} currentSlug={slug} />
    </div>
  );
}

// Header Component
function Header() {
  const { branding, versionedLogoUrl } = useBranding();
  const logoSrc = versionedLogoUrl || branding.logo_url || '/images/medinova/logo.webp';
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img src={logoSrc} alt="MediNova Medical Supplies logo" className="h-[56px] max-w-[200px] object-contain" data-testid="legal-header-logo" />
        </Link>
        <div className="flex items-center gap-4">
          <a
            href="tel:2488864363"
            className="hidden md:flex items-center gap-2 text-slate-600 hover:text-[#0055CC] transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span className="text-sm font-medium">(248) 886-4-DME</span>
          </a>
          <Link
            to="/"
            className="bg-gradient-to-r from-[#0055CC] to-[#0090D0] hover:from-[#004299] hover:to-[#007BB5] text-white px-5 py-2 rounded-xl font-medium shadow-md hover:shadow-lg transition-all text-sm"
          >
            Check Eligibility
          </Link>
        </div>
      </div>
    </header>
  );
}

// Footer Component
function Footer({ links = [], currentSlug }) {
  const { branding, versionedLogoUrl } = useBranding();
  const logoSrc = versionedLogoUrl || branding.logo_url || '/images/medinova/logo.webp';
  return (
    <footer className="bg-gradient-to-br from-[#001A4D] via-[#002D80] to-[#003FA3] text-white py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src={logoSrc} alt="MediNova Medical Supplies" className="h-10 max-w-[160px] object-contain brightness-0 invert opacity-90" data-testid="legal-footer-logo" />
            </div>
            <p className="text-slate-400 text-sm max-w-sm">
              Your trusted partner for Medicare-covered durable medical equipment.
              Quality braces, wheelchairs, and supplies delivered to your door.
            </p>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold mb-4 text-blue-300">Legal</h4>
            <ul className="space-y-2">
              {links.map(doc => (
                <li key={doc.id}>
                  <Link
                    to={`/legal/${doc.slug}`}
                    className={`text-sm transition-colors ${
                      doc.slug === currentSlug
                        ? 'text-blue-300 font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4 text-blue-300">Contact</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>
                <a href="tel:2488864363" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone className="w-4 h-4" />
                  (248) 886-4-DME (4363)
                </a>
              </li>
              <li>
                <a href="mailto:info@medinovadme.com" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                  info@medinovadme.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5" />
                <span>Waterford, MI 48327 — Nationwide Delivery</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Mon–Fri: 8:30am – 6:00pm EST
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} MediNova Medical Supplies. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-slate-500 text-sm">
              <Shield className="w-4 h-4 text-green-400" />
              HIPAA Compliant
            </span>
            <span className="flex items-center gap-2 text-slate-500 text-sm">
              <Lock className="w-4 h-4 text-green-400" />
              Secure & Encrypted
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
