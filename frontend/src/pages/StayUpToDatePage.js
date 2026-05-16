import { useState, useEffect, useCallback } from 'react';
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
  Search,
  FileText,
  BookOpen,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  X,
  RefreshCw,
  Newspaper,
  Heart,
  Database,
  Building2,
  Stethoscope,
  Activity,
  ClipboardList,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

// ==================== HealthCare.gov Categories ====================
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

// ==================== CMS Dataset Card Icons ====================
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

// ==================== CMS field display names ====================
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

// Priority fields per dataset
const DISPLAY_FIELDS = {
  'dme-suppliers': ['Suplr_NPI','Suplr_Prvdr_Last_Name_Org','Suplr_Prvdr_First_Name','Suplr_Prvdr_City','Suplr_Prvdr_State_Abrvtn','Suplr_Prvdr_Zip5','Tot_Suplr_Benes','Tot_Suplr_Clms','Avg_Suplr_Mdcr_Pymt_Amt'],
  'dme-supplier-services': ['Suplr_NPI','Suplr_Prvdr_Last_Name_Org','Suplr_Prvdr_State_Abrvtn','HCPCS_Cd','HCPCS_Desc','Tot_Suplr_Benes','Tot_Suplr_Srvcs','Avg_Suplr_Sbmtd_Chrg','Avg_Suplr_Mdcr_Pymt_Amt'],
  'dme-referring-providers': ['Rfrg_NPI','Rfrg_Prvdr_Last_Name_Org','Rfrg_Prvdr_First_Name','Rfrg_Prvdr_City','Rfrg_Prvdr_State_Abrvtn','Rfrg_Prvdr_Zip5','Rfrg_Prvdr_Crdntls','Tot_Suplrs','Tot_Suplr_Benes'],
  'dme-provider-services': ['Rfrg_NPI','Rfrg_Prvdr_Last_Name_Org','Rfrg_Prvdr_State_Abrvtn','HCPCS_Cd','HCPCS_Desc','Tot_Suplr_Benes','Tot_Suplr_Srvcs','Avg_Suplr_Sbmtd_Chrg','Avg_Suplr_Mdcr_Pymt_Amt'],
};

function formatNumber(val) {
  if (val === null || val === undefined || val === '') return '-';
  const n = Number(val);
  if (isNaN(n)) return val;
  return n.toLocaleString('en-US');
}

function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return '-';
  const n = Number(val);
  if (isNaN(n)) return val;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function formatCell(key, val) {
  if (key.includes('Amt') || key.includes('Chrg') || key.includes('Pymt')) return formatCurrency(val);
  if (key.includes('Tot_') || key.includes('Benes') || key.includes('Clms') || key.includes('Srvcs')) return formatNumber(val);
  return val || '-';
}

// ==================== Shared Components ====================
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

// ==================== HealthCare.gov Content Viewer ====================
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
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold truncate pr-4" data-testid="content-viewer-title">
            {item.title}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`https://www.healthcare.gov${item.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              data-testid="content-external-link"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="content-viewer-close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : content?.content ? (
            <div
              className="prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-li:text-foreground/80"
              dangerouslySetInnerHTML={{ __html: content.content }}
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">Content not available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== HealthCare.gov Items List ====================
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, activeLetter]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dme_token');
      const params = { limit: PAGE_SIZE, skip: page * PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category.id === 'glossary' && activeLetter) params.letter = activeLetter;
      const resp = await axios.get(`${API_URL}/api/healthcare-gov/${category.id}`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(resp.data[category.id] || []);
      setTotal(resp.data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category.id, page, debouncedSearch, activeLetter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const Icon = category.icon;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div data-testid={`items-list-${category.id}`}>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="back-to-categories">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className={`p-2 rounded-lg ${category.lightBg}`}>
          <Icon className={`w-5 h-5 ${category.textColor}`} />
        </div>
        <div>
          <h2 className="text-xl font-bold">{category.title}</h2>
          <p className="text-sm text-muted-foreground">{total} items available</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${category.title.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
            data-testid="items-search-input"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchItems} data-testid="refresh-items-btn">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {category.id === 'glossary' && (
        <div className="flex flex-wrap gap-1 mb-4" data-testid="glossary-alphabet-filter">
          <Button variant={activeLetter === null ? 'default' : 'outline'} size="sm" className="h-7 w-8 text-xs p-0" onClick={() => setActiveLetter(null)}>All</Button>
          {alphabet.map(l => (
            <Button key={l} variant={activeLetter === l ? 'default' : 'outline'} size="sm" className="h-7 w-7 text-xs p-0" onClick={() => setActiveLetter(activeLetter === l ? null : l)}>{l}</Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No results found</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.url || idx}
              className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setSelectedItem(item)}
              data-testid={`item-row-${idx}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.title}</h4>
                  {item.bite && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.bite}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}

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

// ==================== CMS Data Table ====================
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, stateFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dme_token');
      const params = { size: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (stateFilter) params.state = stateFilter;
      const resp = await axios.get(`${API_URL}/api/cms-data/${dataset.key}/data`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      setRows(resp.data.rows || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dataset.key, page, debouncedSearch, stateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div data-testid={`cms-data-${dataset.key}`}>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="back-to-categories">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className={`p-2 rounded-lg ${colors.lightBg}`}>
          <Icon className={`w-5 h-5 ${colors.textColor}`} />
        </div>
        <div>
          <h2 className="text-xl font-bold">{dataset.title}</h2>
          <p className="text-sm text-muted-foreground">{dataset.total_rows?.toLocaleString()} records</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
            data-testid="cms-search-input"
          />
        </div>
        <Select value={stateFilter} onValueChange={v => setStateFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px]" data-testid="cms-state-filter">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchData} data-testid="cms-refresh-btn">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No records found</p>
          <p className="text-sm mt-1">Try adjusting your search or state filter</p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  {fields.filter(f => rows[0]?.[f] !== undefined).map(f => (
                    <th key={f} className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                      {FIELD_LABELS[f] || f}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedRow(selectedRow === idx ? null : idx)}
                    data-testid={`cms-row-${idx}`}
                  >
                    {fields.filter(f => row[f] !== undefined).map(f => (
                      <td key={f} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate" title={row[f]}>
                        {formatCell(f, row[f])}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selectedRow === idx ? 'rotate-90' : ''}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded row detail */}
          {selectedRow !== null && rows[selectedRow] && (
            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-4">
              <h4 className="font-medium mb-3 text-sm">Full Record Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(rows[selectedRow]).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="text-muted-foreground block">{FIELD_LABELS[k] || k.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{formatCell(k, v)}</span>
                  </div>
                ))}
              </div>
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

// ==================== Main Page ====================
export default function StayUpToDatePage() {
  const [activeView, setActiveView] = useState(null); // { type: 'hcgov', category } or { type: 'cms', dataset }
  const [hcgovCounts, setHcgovCounts] = useState({});
  const [cmsDatasets, setCmsDatasets] = useState([]);
  const [cmsLoading, setCmsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dme_token');
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch HealthCare.gov counts
    Promise.all([
      axios.get(`${API_URL}/api/healthcare-gov/articles`, { params: { limit: 1 }, headers }),
      axios.get(`${API_URL}/api/healthcare-gov/glossary`, { params: { limit: 1 }, headers }),
    ]).then(([a, g]) => {
      setHcgovCounts({ articles: a.data.total, glossary: g.data.total });
    }).catch(() => {});

    // Fetch CMS datasets
    setCmsLoading(true);
    axios.get(`${API_URL}/api/cms-data/datasets`, { headers })
      .then(res => setCmsDatasets(res.data.datasets || []))
      .catch(() => {})
      .finally(() => setCmsLoading(false));
  }, []);

  if (activeView?.type === 'hcgov') {
    return (
      <div className="space-y-4 animate-fade-in" data-testid="stay-up-to-date-page">
        <HcgovItemsList category={activeView.category} onBack={() => setActiveView(null)} />
      </div>
    );
  }

  if (activeView?.type === 'cms') {
    return (
      <div className="space-y-4 animate-fade-in" data-testid="stay-up-to-date-page">
        <CmsDataTable dataset={activeView.dataset} onBack={() => setActiveView(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" data-testid="stay-up-to-date-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stay Up To Date</h1>
          <p className="text-muted-foreground">Healthcare resources, Medicare data, and educational content</p>
        </div>
      </div>

      {/* HealthCare.gov Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="gap-1.5 text-xs py-1">
            <Heart className="w-3 h-3" />
            HealthCare.gov
          </Badge>
          <span className="text-sm text-muted-foreground">Educational content and glossary</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HCGOV_CATEGORIES.map(cat => (
            <CategoryCard
              key={cat.id}
              id={cat.id}
              title={cat.title}
              description={cat.description}
              icon={cat.icon}
              lightBg={cat.lightBg}
              textColor={cat.textColor}
              borderColor={cat.borderColor}
              itemCount={hcgovCounts[cat.id] ?? null}
              onClick={() => setActiveView({ type: 'hcgov', category: cat })}
            />
          ))}
        </div>
      </div>

      {/* CMS & Medicare Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="gap-1.5 text-xs py-1">
            <Database className="w-3 h-3" />
            CMS.gov &amp; Medicare
          </Badge>
          <span className="text-sm text-muted-foreground">DME supplier and provider data from CMS</span>
        </div>
        {cmsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cmsDatasets.map(ds => {
              const colors = CMS_COLORS[ds.key] || CMS_COLORS['dme-suppliers'];
              const Icon = CMS_ICONS[ds.key] || Database;
              return (
                <CategoryCard
                  key={ds.key}
                  id={`cms-${ds.key}`}
                  title={ds.title}
                  description={ds.description}
                  icon={Icon}
                  lightBg={colors.lightBg}
                  textColor={colors.textColor}
                  borderColor={colors.borderColor}
                  itemCount={ds.total_rows}
                  onClick={() => setActiveView({ type: 'cms', dataset: ds })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Coming Soon */}
      <Card className="border-dashed border-2">
        <CardContent className="p-6 text-center">
          <Newspaper className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="font-medium text-muted-foreground">More Sources Coming Soon</p>
          <p className="text-sm text-muted-foreground mt-1">
            Additional healthcare data feeds and resources will be added here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
