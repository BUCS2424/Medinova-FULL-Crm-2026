import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Search, FileText, BookOpen, ArrowLeft, ExternalLink, ChevronRight, X,
  RefreshCw, Newspaper, Heart, Database, Building2, Stethoscope, Activity,
  ClipboardList, Bell, BellOff, Shield, Scale, AlertCircle, FileCheck,
  Calendar, Download, ChevronLeft, Loader2,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

// ── HealthCare.gov categories ───────────────────────────────────────────────
const HCGOV_CATEGORIES = [
  {
    id: 'articles',
    title: 'Healthcare Articles',
    description: 'Educational content about health insurance, enrollment, coverage options, and more from HealthCare.gov.',
    icon: FileText,
    color: 'bg-blue-500',
    lightBg: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    id: 'glossary',
    title: 'Healthcare Glossary',
    description: 'Definitions of key healthcare and insurance terms to help your team and patients understand their coverage.',
    icon: BookOpen,
    color: 'bg-emerald-500',
    lightBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
];

// ── CMS Dataset config ──────────────────────────────────────────────────────
const CMS_ICONS = {
  'dme-suppliers': Building2,
  'dme-supplier-services': ClipboardList,
  'dme-referring-providers': Stethoscope,
  'dme-provider-services': Activity,
};
const CMS_COLORS = {
  'dme-suppliers': { lightBg: 'bg-orange-50 dark:bg-orange-900/20', textColor: 'text-orange-600 dark:text-orange-400', borderColor: 'border-orange-200 dark:border-orange-800' },
  'dme-supplier-services': { lightBg: 'bg-violet-50 dark:bg-violet-900/20', textColor: 'text-violet-600 dark:text-violet-400', borderColor: 'border-violet-200 dark:border-violet-800' },
  'dme-referring-providers': { lightBg: 'bg-teal-50 dark:bg-teal-900/20', textColor: 'text-teal-600 dark:text-teal-400', borderColor: 'border-teal-200 dark:border-teal-800' },
  'dme-provider-services': { lightBg: 'bg-rose-50 dark:bg-rose-900/20', textColor: 'text-rose-600 dark:text-rose-400', borderColor: 'border-rose-200 dark:border-rose-800' },
};
const FIELD_LABELS = {
  Suplr_NPI: 'NPI', Suplr_Prvdr_Last_Name_Org: 'Name/Org', Suplr_Prvdr_First_Name: 'First Name',
  Suplr_Prvdr_City: 'City', Suplr_Prvdr_State_Abrvtn: 'State', Suplr_Prvdr_Zip5: 'ZIP',
  Suplr_Prvdr_Crdntls: 'Credentials', Suplr_Prvdr_Spclty_Desc: 'Specialty',
  Tot_Suplrs: 'Total Suppliers', Tot_Suplr_Benes: 'Total Beneficiaries',
  Tot_Suplr_Clms: 'Total Claims', Tot_Suplr_Srvcs: 'Total Services',
  Avg_Suplr_Sbmtd_Chrg: 'Avg Submitted Charge', Avg_Suplr_Mdcr_Alowd_Amt: 'Avg Medicare Allowed',
  Avg_Suplr_Mdcr_Pymt_Amt: 'Avg Medicare Payment',
  Rfrg_NPI: 'NPI', Rfrg_Prvdr_Last_Name_Org: 'Name/Org', Rfrg_Prvdr_First_Name: 'First Name',
  Rfrg_Prvdr_City: 'City', Rfrg_Prvdr_State_Abrvtn: 'State', Rfrg_Prvdr_Zip5: 'ZIP',
  Rfrg_Prvdr_Crdntls: 'Credentials', Rfrg_Prvdr_Spclty_Desc: 'Specialty',
  HCPCS_Cd: 'HCPCS Code', HCPCS_Desc: 'Service Description',
  Tot_Suplr_HCPCS_Cds: 'HCPCS Codes', Tot_Rfrg_Prvdr_HCPCS_Cds: 'HCPCS Codes',
};
const DISPLAY_FIELDS = {
  'dme-suppliers': ['Suplr_NPI','Suplr_Prvdr_Last_Name_Org','Suplr_Prvdr_First_Name','Suplr_Prvdr_City','Suplr_Prvdr_State_Abrvtn','Suplr_Prvdr_Zip5','Tot_Suplr_Benes','Tot_Suplr_Clms','Avg_Suplr_Mdcr_Pymt_Amt'],
  'dme-supplier-services': ['Suplr_NPI','Suplr_Prvdr_Last_Name_Org','Suplr_Prvdr_State_Abrvtn','HCPCS_Cd','HCPCS_Desc','Tot_Suplr_Benes','Tot_Suplr_Srvcs','Avg_Suplr_Sbmtd_Chrg','Avg_Suplr_Mdcr_Pymt_Amt'],
  'dme-referring-providers': ['Rfrg_NPI','Rfrg_Prvdr_Last_Name_Org','Rfrg_Prvdr_First_Name','Rfrg_Prvdr_City','Rfrg_Prvdr_State_Abrvtn','Rfrg_Prvdr_Zip5','Rfrg_Prvdr_Crdntls','Tot_Suplrs','Tot_Suplr_Benes'],
  'dme-provider-services': ['Rfrg_NPI','Rfrg_Prvdr_Last_Name_Org','Rfrg_Prvdr_State_Abrvtn','HCPCS_Cd','HCPCS_Desc','Tot_Suplr_Benes','Tot_Suplr_Srvcs','Avg_Suplr_Sbmtd_Chrg','Avg_Suplr_Mdcr_Pymt_Amt'],
};

function formatNumber(val) {
  if (val === null || val === undefined || val === '') return '-';
  const n = Number(val);
  return isNaN(n) ? val : n.toLocaleString('en-US');
}
function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return '-';
  const n = Number(val);
  return isNaN(n) ? val : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}
function formatCell(key, val) {
  if (key.includes('Amt') || key.includes('Chrg') || key.includes('Pymt')) return formatCurrency(val);
  if (key.includes('Tot_') || key.includes('Benes') || key.includes('Clms') || key.includes('Srvcs')) return formatNumber(val);
  return val || '-';
}

// ── Article type badge config ───────────────────────────────────────────────
function docTypeMeta(type) {
  switch ((type || '').toLowerCase()) {
    case 'rule':
      return { label: 'Final Rule', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: Scale };
    case 'proposed rule':
      return { label: 'Proposed Rule', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: AlertCircle };
    case 'notice':
      return { label: 'Notice', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: Bell };
    case 'presidential document':
      return { label: 'Presidential', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', icon: FileText };
    default:
      return { label: type || 'Document', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: FileCheck };
  }
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

// ── Article Detail Modal ────────────────────────────────────────────────────
function ArticleModal({ article, onClose }) {
  const meta = docTypeMeta(article.type);
  const TypeIcon = meta.icon;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      data-testid="article-modal-backdrop"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
        data-testid="article-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>
              <TypeIcon className="w-3 h-3" />
              {meta.label}
            </span>
            {article.id && (
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">#{article.id}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            data-testid="article-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Title */}
          <h2 className="text-lg font-bold leading-snug mb-4 text-slate-900 dark:text-slate-100">
            {article.title}
          </h2>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Published
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {fmtDate(article.published_at) || '—'}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Effective
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {fmtDate(article.effective_on) || 'See article'}
              </p>
            </div>
          </div>

          {/* Tags */}
          {article.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {article.tags.map(tag => (
                <span key={tag} className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium border border-blue-100 dark:border-blue-800">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Abstract */}
          {article.abstract ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Summary</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {article.abstract}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No summary available. Click "Read Full Article" to view on Federal Register.</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/30 rounded-b-2xl">
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
              data-testid="article-read-full"
            >
              <Button className="w-full gap-2 text-sm" style={{ background: 'linear-gradient(135deg, #0055CC, #00A3E0)' }}>
                <ExternalLink className="w-4 h-4" />
                Read Full Article
              </Button>
            </a>
          )}
          {article.pdf_url && (
            <a
              href={article.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="article-download-pdf"
            >
              <Button variant="outline" size="icon" className="shrink-0" title="Download PDF">
                <Download className="w-4 h-4" />
              </Button>
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 text-slate-500">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Single news item row ────────────────────────────────────────────────────
function NewsItem({ item, onClick }) {
  const meta = docTypeMeta(item.type);
  const isRule = (item.type || '').toLowerCase() === 'rule';

  return (
    <button
      className={`w-full text-left group px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 focus:outline-none ${isRule ? 'border-l-2 border-l-red-400' : ''}`}
      onClick={() => onClick(item)}
      data-testid={`news-item-${item.id}`}
    >
      {/* Row 1: type badge + NEW badge + date */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
          {item.is_new && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white animate-pulse shrink-0">
              NEW
            </span>
          )}
        </div>
        {item.published_at && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
            {fmtDate(item.published_at)}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1.5">
        {item.title}
      </p>

      {/* Effective date (for Final Rules) */}
      {isRule && item.effective_on && (
        <p className="text-[10px] text-red-600 dark:text-red-400 font-medium mb-1">
          Effective: {fmtDate(item.effective_on)}
        </p>
      )}

      {/* Tags */}
      {item.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ── CMS Compliance News Panel ───────────────────────────────────────────────
function CmsNewsPanel({ onArticleClick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');
  const [sortMode, setSortMode] = useState('priority'); // 'priority' | 'newest'
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = useCallback(async (force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    try {
      const token = localStorage.getItem('dme_token');
      const res = await axios.get(`${API_URL}/api/cms-news/feed`, {
        params: force ? { refresh: true } : {},
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res.data.items || []);
      setLastUpdated(res.data.last_updated);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  // All unique tags from the feed for quick-filter chips
  const allTags = [...new Set(items.flatMap(i => i.tags || []))].sort();

  const filtered = items.filter(item => {
    const matchType = typeFilter === 'all' || (item.type || '').toLowerCase() === typeFilter;
    const matchTag = !tagFilter || (item.tags || []).includes(tagFilter);
    const matchSearch = !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.abstract || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchTag && matchSearch;
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'priority') {
      const pd = (b.priority || 0) - (a.priority || 0);
      if (pd !== 0) return pd;
    }
    return (b.published_at || '') > (a.published_at || '') ? 1 : -1;
  });

  const docTypes = [...new Set(items.map(i => (i.type || '').toLowerCase()).filter(Boolean))];
  const newCount = items.filter(i => i.is_new).length;
  const ruleCount = items.filter(i => (i.type || '').toLowerCase() === 'rule').length;

  return (
    <div className="flex flex-col h-full" data-testid="cms-news-panel">
      {/* Panel header */}
      <div
        className="shrink-0 px-3 py-3 border-b border-slate-200 dark:border-slate-700"
        style={{ background: 'linear-gradient(135deg, #0B1B33 0%, #0a2240 100%)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0055CC, #00A3E0)' }}>
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">CMS Compliance</p>
              <p className="text-slate-400 text-[10px] mt-0.5">Federal Register · Live</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {newCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white">
                {newCount} NEW
              </span>
            )}
            <button
              onClick={() => fetchNews(true)}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Refresh feed"
              data-testid="news-panel-refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] text-slate-400">
            <span className="text-red-400 font-semibold">{ruleCount} Final Rules</span>
            {' · '}
            <span className="text-amber-400">{items.filter(i => (i.type||'').toLowerCase()==='proposed rule').length} Proposed</span>
            {' · '}
            <span className="text-blue-400">{items.filter(i => (i.type||'').toLowerCase()==='notice').length} Notices</span>
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search rules, topics, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white/10 text-white placeholder-slate-500 border border-white/10 focus:outline-none focus:border-blue-400 transition-colors"
            data-testid="news-search"
          />
        </div>

        {/* Sort toggle */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            <button
              onClick={() => setSortMode('priority')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${sortMode === 'priority' ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
              data-testid="sort-priority"
            >
              Priority
            </button>
            <button
              onClick={() => setSortMode('newest')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${sortMode === 'newest' ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
              data-testid="sort-newest"
            >
              Newest
            </button>
          </div>
          {tagFilter && (
            <button onClick={() => setTagFilter('')} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5">
              <X className="w-2.5 h-2.5" /> Clear tag
            </button>
          )}
        </div>

        {/* Type filter pills */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${typeFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
          >
            All
          </button>
          {docTypes.map(t => {
            const m = docTypeMeta(t);
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${typeFilter === t ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tag quick-filter chips (DME-specific tags) */}
      {allTags.length > 0 && !loading && (
        <div className="shrink-0 px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
          <div className="flex gap-1.5 flex-nowrap min-w-0">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors whitespace-nowrap ${
                  tagFilter === tag
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600'
                }`}
                data-testid={`tag-filter-${tag.replace(/\//g, '-').replace(/\s/g, '-').toLowerCase()}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Article count + last updated */}
      <div className="shrink-0 px-3 py-1.5 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[10px] text-slate-500">
          {loading ? 'Loading...' : `${sorted.length} of ${items.length} updates`}
        </span>
        {lastUpdated && (
          <span className="text-[10px] text-slate-400">
            {new Date(lastUpdated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
        {loading ? (
          <div className="p-3 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">No matching updates</p>
            {(search || typeFilter !== 'all' || tagFilter) && (
              <button
                onClick={() => { setSearch(''); setTypeFilter('all'); setTagFilter(''); }}
                className="mt-2 text-xs text-blue-500 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {sorted.map(item => (
              <NewsItem key={item.id} item={item} onClick={onArticleClick} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
        <a
          href="https://www.federalregister.gov/agencies/centers-for-medicare-medicaid-services"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 hover:text-blue-500 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View all CMS documents on Federal Register
        </a>
      </div>
    </div>
  );
}

// ── Shared category card ────────────────────────────────────────────────────
function CategoryCard({ id, title, description, icon: Icon, lightBg, textColor, borderColor, itemCount, onClick }) {
  return (
    <Card
      data-testid={`category-card-${id}`}
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-2 ${borderColor}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${lightBg}`}>
            <Icon className={`w-6 h-6 ${textColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
            <div className="flex items-center justify-between mt-4">
              {itemCount !== null ? (
                <Badge variant="secondary" className={textColor}>
                  {typeof itemCount === 'number' ? itemCount.toLocaleString() : itemCount} items
                </Badge>
              ) : (
                <Skeleton className="h-5 w-20" />
              )}
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── HealthCare.gov content viewer modal ────────────────────────────────────
function ContentViewer({ item, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('dme_token');
        const url = item.url.replace(/\/$/, '');
        const resp = await axios.get(`${API_URL}/api/healthcare-gov/content`, {
          params: { url },
          headers: { Authorization: `Bearer ${token}` },
        });
        setContent(resp.data);
      } catch {
        setContent(null);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [item.url]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold truncate pr-4" data-testid="content-viewer-title">{item.title}</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={`https://www.healthcare.gov${item.url}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" data-testid="content-external-link">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="content-viewer-close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-5/6" /></div>
          ) : content?.content ? (
            <div className="prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-li:text-foreground/80" dangerouslySetInnerHTML={{ __html: content.content }} />
          ) : (
            <p className="text-muted-foreground text-center py-8">Content not available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HealthCare.gov items list ───────────────────────────────────────────────
function HcgovItemsList({ category, onBack }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeLetter, setActiveLetter] = useState(null);
  const PAGE_SIZE = 30;

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(0); }, [debouncedSearch, activeLetter]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dme_token');
      const params = { limit: PAGE_SIZE, skip: page * PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category.id === 'glossary' && activeLetter) params.letter = activeLetter;
      const resp = await axios.get(`${API_URL}/api/healthcare-gov/${category.id}`, { params, headers: { Authorization: `Bearer ${token}` } });
      setItems(resp.data[category.id] || []);
      setTotal(resp.data.total || 0);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [category.id, page, debouncedSearch, activeLetter]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const Icon = category.icon;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div data-testid={`items-list-${category.id}`}>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="back-to-categories"><ArrowLeft className="w-5 h-5" /></Button>
        <div className={`p-2 rounded-lg ${category.lightBg}`}><Icon className={`w-5 h-5 ${category.textColor}`} /></div>
        <div><h2 className="text-xl font-bold">{category.title}</h2><p className="text-sm text-muted-foreground">{total} items available</p></div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={`Search ${category.title.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="items-search-input" />
        </div>
        <Button variant="outline" size="icon" onClick={fetchItems} data-testid="refresh-items-btn"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
      </div>
      {category.id === 'glossary' && (
        <div className="flex flex-wrap gap-1 mb-4" data-testid="glossary-alphabet-filter">
          <Button variant={activeLetter === null ? 'default' : 'outline'} size="sm" className="h-7 w-8 text-xs p-0" onClick={() => setActiveLetter(null)}>All</Button>
          {alphabet.map(l => (<Button key={l} variant={activeLetter === l ? 'default' : 'outline'} size="sm" className="h-7 w-7 text-xs p-0" onClick={() => setActiveLetter(activeLetter === l ? null : l)}>{l}</Button>))}
        </div>
      )}
      {loading ? <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
        : items.length === 0 ? <div className="text-center py-12 text-muted-foreground"><Search className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="font-medium">No results found</p></div>
        : <div className="space-y-2">{items.map((item, idx) => (
          <div key={item.url || idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelectedItem(item)} data-testid={`item-row-${idx}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0"><h4 className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.title}</h4>{item.bite && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.bite}</p>}</div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        ))}</div>}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6" data-testid="pagination-controls">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="prev-page-btn">Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="next-page-btn">Next</Button>
        </div>
      )}
      {selectedItem && <ContentViewer item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

// ── CMS Data Table ──────────────────────────────────────────────────────────
function CmsDataTable({ dataset, onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedRow, setSelectedRow] = useState(null);
  const PAGE_SIZE = 30;
  const colors = CMS_COLORS[dataset.key] || CMS_COLORS['dme-suppliers'];
  const Icon = CMS_ICONS[dataset.key] || Database;
  const fields = DISPLAY_FIELDS[dataset.key] || [];

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(0); }, [debouncedSearch, stateFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dme_token');
      const params = { size: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (stateFilter) params.state = stateFilter;
      const resp = await axios.get(`${API_URL}/api/cms-data/${dataset.key}/data`, { params, headers: { Authorization: `Bearer ${token}` } });
      setRows(resp.data.rows || []);
    } catch { setRows([]); } finally { setLoading(false); }
  }, [dataset.key, page, debouncedSearch, stateFilter]);
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div data-testid={`cms-data-${dataset.key}`}>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="back-to-categories"><ArrowLeft className="w-5 h-5" /></Button>
        <div className={`p-2 rounded-lg ${colors.lightBg}`}><Icon className={`w-5 h-5 ${colors.textColor}`} /></div>
        <div><h2 className="text-xl font-bold">{dataset.title}</h2><p className="text-sm text-muted-foreground">{dataset.total_rows?.toLocaleString()} records</p></div>
      </div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="cms-search-input" /></div>
        <Select value={stateFilter} onValueChange={v => setStateFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px]" data-testid="cms-state-filter"><SelectValue placeholder="All States" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All States</SelectItem>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchData} data-testid="cms-refresh-btn"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
      </div>
      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        : rows.length === 0 ? <div className="text-center py-12 text-muted-foreground"><Database className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="font-medium">No records found</p><p className="text-sm mt-1">Try adjusting your search or state filter</p></div>
        : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 dark:bg-slate-800/50">{fields.filter(f => rows[0]?.[f] !== undefined).map(f => (<th key={f} className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">{FIELD_LABELS[f] || f}</th>))}<th className="px-3 py-2.5 w-8"></th></tr></thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {rows.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors" onClick={() => setSelectedRow(selectedRow === idx ? null : idx)} data-testid={`cms-row-${idx}`}>{fields.filter(f => row[f] !== undefined).map(f => (<td key={f} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate" title={row[f]}>{formatCell(f, row[f])}</td>))}<td className="px-3 py-2"><ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selectedRow === idx ? 'rotate-90' : ''}`} /></td></tr>))}
                </tbody>
              </table>
            </div>
            {selectedRow !== null && rows[selectedRow] && (
              <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-4">
                <h4 className="font-medium mb-3 text-sm">Full Record Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{Object.entries(rows[selectedRow]).map(([k, v]) => (<div key={k} className="text-xs"><span className="text-muted-foreground block">{FIELD_LABELS[k] || k.replace(/_/g, ' ')}</span><span className="font-medium">{formatCell(k, v)}</span></div>))}</div>
              </div>
            )}
          </div>
        )}
      <div className="flex items-center justify-between mt-4" data-testid="cms-pagination">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="cms-prev-btn">Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page + 1} &middot; Showing {rows.length} records</span>
        <Button variant="outline" size="sm" disabled={rows.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} data-testid="cms-next-btn">Next</Button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function StayUpToDatePage() {
  const [activeView, setActiveView] = useState(null);
  const [hcgovCounts, setHcgovCounts] = useState({});
  const [cmsDatasets, setCmsDatasets] = useState([]);
  const [cmsLoading, setCmsLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('dme_token');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API_URL}/api/healthcare-gov/articles`, { params: { limit: 1 }, headers }),
      axios.get(`${API_URL}/api/healthcare-gov/glossary`, { params: { limit: 1 }, headers }),
    ]).then(([a, g]) => setHcgovCounts({ articles: a.data.total, glossary: g.data.total })).catch(() => {});
    setCmsLoading(true);
    axios.get(`${API_URL}/api/cms-data/datasets`, { headers })
      .then(res => setCmsDatasets(res.data.datasets || []))
      .catch(() => {})
      .finally(() => setCmsLoading(false));
  }, []);

  const mainContent = (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stay Up To Date</h1>
          <p className="text-muted-foreground">Healthcare resources, Medicare data, and educational content</p>
        </div>
        <Button
          variant={panelOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPanelOpen(v => !v)}
          className="gap-2 shrink-0"
          data-testid="toggle-news-panel"
          style={panelOpen ? { background: 'linear-gradient(135deg, #0055CC, #00A3E0)' } : {}}
        >
          {panelOpen ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {panelOpen ? 'Hide' : 'CMS News'}
        </Button>
      </div>

      {/* HealthCare.gov */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="gap-1.5 text-xs py-1"><Heart className="w-3 h-3" />HealthCare.gov</Badge>
          <span className="text-sm text-muted-foreground">Educational content and glossary</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HCGOV_CATEGORIES.map(cat => (
            <CategoryCard key={cat.id} id={cat.id} title={cat.title} description={cat.description} icon={cat.icon}
              lightBg={cat.lightBg} textColor={cat.textColor} borderColor={cat.borderColor}
              itemCount={hcgovCounts[cat.id] ?? null}
              onClick={() => setActiveView({ type: 'hcgov', category: cat })}
            />
          ))}
        </div>
      </div>

      {/* CMS & Medicare */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="gap-1.5 text-xs py-1"><Database className="w-3 h-3" />CMS.gov &amp; Medicare</Badge>
          <span className="text-sm text-muted-foreground">DME supplier and provider data from CMS</span>
        </div>
        {cmsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cmsDatasets.map(ds => {
              const colors = CMS_COLORS[ds.key] || CMS_COLORS['dme-suppliers'];
              const Icon = CMS_ICONS[ds.key] || Database;
              return (
                <CategoryCard key={ds.key} id={`cms-${ds.key}`} title={ds.title} description={ds.description}
                  icon={Icon} lightBg={colors.lightBg} textColor={colors.textColor} borderColor={colors.borderColor}
                  itemCount={ds.total_rows}
                  onClick={() => setActiveView({ type: 'cms', dataset: ds })}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (activeView?.type === 'hcgov') {
    return (
      <div data-testid="stay-up-to-date-page">
        <HcgovItemsList category={activeView.category} onBack={() => setActiveView(null)} />
      </div>
    );
  }
  if (activeView?.type === 'cms') {
    return (
      <div data-testid="stay-up-to-date-page">
        <CmsDataTable dataset={activeView.dataset} onBack={() => setActiveView(null)} />
      </div>
    );
  }

  return (
    <div className="flex gap-5 items-start" data-testid="stay-up-to-date-page">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {mainContent}
      </div>

      {/* Slide-out CMS news panel */}
      <div
        className="shrink-0 self-start sticky top-0 overflow-hidden transition-all duration-300 ease-in-out rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg"
        style={{
          width: panelOpen ? '340px' : '0px',
          opacity: panelOpen ? 1 : 0,
          maxHeight: 'calc(100vh - 80px)',
          display: 'flex',
          flexDirection: 'column',
        }}
        data-testid="news-panel-container"
      >
        {panelOpen && <CmsNewsPanel onArticleClick={setSelectedArticle} />}
      </div>

      {/* Article modal */}
      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
    </div>
  );
}
