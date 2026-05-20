import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useFeatures } from '../contexts/FeatureContext';
import { KB_SECTIONS, searchArticles } from '../data/kb_articles';
import {
  BookOpen, Search, X, ChevronRight, ChevronDown,
  LayoutDashboard, Users, UserPlus, ClipboardList, FileText,
  Shield, Newspaper, Video, BarChart3, Megaphone, Key,
  Phone, ShieldCheck, Stethoscope, PhoneCall, Settings,
  Ticket, ArrowLeft, Clock, Lightbulb, AlertTriangle,
  ListOrdered, Home, Menu,
} from 'lucide-react';

const ICON_MAP = {
  BookOpen, LayoutDashboard, Users, UserPlus, ClipboardList,
  FileText, Shield, Newspaper, Video, BarChart3, Megaphone,
  Key, Phone, ShieldCheck, Stethoscope, PhoneCall, Settings, Ticket,
};

function getIcon(name) {
  return ICON_MAP[name] || BookOpen;
}

// ── Article section renderer ────────────────────────────────────────────────
function ArticleSection({ section, index }) {
  if (section.type === 'tip') {
    return (
      <div className="flex gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 my-4">
        <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-200">{section.text}</p>
      </div>
    );
  }
  if (section.type === 'warning') {
    return (
      <div className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 my-4">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-200">{section.text}</p>
      </div>
    );
  }
  return (
    <div className="mb-6">
      {section.heading && (
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2 mt-5 first:mt-0">
          {section.heading}
        </h3>
      )}
      {section.text && (
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{section.text}</p>
      )}
      {section.bullets?.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {section.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      {section.steps?.length > 0 && (
        <ol className="mt-2 space-y-2">
          {section.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-400">
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Full article view ───────────────────────────────────────────────────────
function ArticleView({ article, section, onBack }) {
  const contentRef = useRef(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [article.id]);

  return (
    <div className="flex flex-col h-full" ref={contentRef}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-500 dark:text-slate-400">
        <button
          onClick={onBack}
          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          data-testid="kb-back-btn"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {section.title}
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-800 dark:text-slate-200 font-medium">{article.title}</span>
      </div>

      {/* Article header */}
      <div className="mb-6 pb-5 border-b border-slate-200 dark:border-slate-700">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {article.title}
        </h1>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{article.readTime} read</span>
          <span>·</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-medium">
            {section.title}
          </span>
        </div>
      </div>

      {/* Article body */}
      <div className="flex-1 overflow-y-auto">
        {article.sections.map((sec, i) => (
          <ArticleSection key={i} section={sec} index={i} />
        ))}

        {/* Footer nav */}
        <div className="mt-10 pt-5 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {section.title}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section landing (article list for a section) ───────────────────────────
function SectionLanding({ section, onSelectArticle }) {
  const Icon = getIcon(section.icon);
  return (
    <div data-testid={`kb-section-${section.id}`}>
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-200 dark:border-slate-700">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0055CC20, #00A3E020)' }}>
          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{section.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
        </div>
      </div>
      <div className="space-y-2">
        {section.articles.map(article => (
          <button
            key={article.id}
            onClick={() => onSelectArticle(article)}
            className="w-full text-left flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 hover:shadow-sm transition-all group"
            data-testid={`kb-article-btn-${article.id}`}
          >
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-500 mt-0.5 shrink-0 transition-colors" />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {article.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{article.readTime} read</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── KB Home (landing with all sections) ────────────────────────────────────
function KbHome({ visibleSections, onSelectSection }) {
  const categories = [
    { id: 'core', label: 'Core Features' },
    { id: 'features', label: 'Optional Features' },
    { id: 'admin', label: 'Administration' },
  ];
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Knowledge Base</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Complete guides and how-tos for the MediNova DME platform. Use the search or browse by category.
        </p>
      </div>
      {categories.map(cat => {
        const sections = visibleSections.filter(s => s.category === cat.id);
        if (sections.length === 0) return null;
        return (
          <div key={cat.id} className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1">
              {cat.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sections.map(section => {
                const Icon = getIcon(section.icon);
                return (
                  <button
                    key={section.id}
                    onClick={() => onSelectSection(section)}
                    className="text-left flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 hover:shadow-md transition-all group"
                    data-testid={`kb-home-section-${section.id}`}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30"
                      style={{ background: '#f1f5f9' }}>
                      <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {section.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{section.description}</p>
                      <p className="text-xs text-slate-400 mt-1.5">{section.articles.length} article{section.articles.length !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Left nav sidebar ────────────────────────────────────────────────────────
function KbNav({ visibleSections, selected, onSelectSection, onSelectArticle, activeArticle, collapsed, onToggle }) {
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (selected) {
      setExpanded(e => ({ ...e, [selected.id]: true }));
    }
  }, [selected]);

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <aside
      className={`shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 ${collapsed ? 'w-0 overflow-hidden' : 'w-64'}`}
      style={{ minHeight: 0 }}
    >
      <div className="flex-1 overflow-y-auto py-4">
        {/* Home link */}
        <button
          onClick={() => onSelectSection(null)}
          className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-lg mx-1 mb-2 ${!selected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          data-testid="kb-nav-home"
          style={{ width: 'calc(100% - 8px)' }}
        >
          <Home className="w-4 h-4 shrink-0" />
          <span>All Topics</span>
        </button>

        {/* Section groups */}
        {['core', 'features', 'admin'].map(cat => {
          const sections = visibleSections.filter(s => s.category === cat);
          if (sections.length === 0) return null;
          const labels = { core: 'Core', features: 'Features', admin: 'Admin' };
          return (
            <div key={cat} className="mb-4">
              <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {labels[cat]}
              </p>
              {sections.map(section => {
                const Icon = getIcon(section.icon);
                const isActive = selected?.id === section.id;
                const isOpen = expanded[section.id];
                return (
                  <div key={section.id}>
                    <button
                      onClick={() => { toggle(section.id); onSelectSection(section); }}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors rounded-lg mx-1 ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      style={{ width: 'calc(100% - 8px)' }}
                      data-testid={`kb-nav-${section.id}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{section.title}</span>
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
                        : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                    </button>
                    {isOpen && (
                      <div className="ml-6 border-l border-slate-200 dark:border-slate-700 pl-2 my-1 space-y-0.5">
                        {section.articles.map(article => (
                          <button
                            key={article.id}
                            onClick={() => onSelectArticle(article, section)}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${activeArticle?.id === article.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            data-testid={`kb-nav-article-${article.id}`}
                          >
                            {article.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ── Search results ─────────────────────────────────────────────────────────
function SearchResults({ results, query, onSelect }) {
  if (results.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="font-medium text-slate-600 dark:text-slate-400">No results for "{query}"</p>
        <p className="text-sm text-slate-400 mt-1">Try different keywords or browse by category</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {results.length} result{results.length !== 1 ? 's' : ''} for <span className="font-semibold text-slate-700 dark:text-slate-300">"{query}"</span>
      </p>
      <div className="space-y-2">
        {results.map(({ article, section }) => {
          const Icon = getIcon(section.icon);
          return (
            <button
              key={article.id}
              onClick={() => onSelect(article, section)}
              className="w-full text-left flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 hover:shadow-sm transition-all group"
              data-testid={`kb-search-result-${article.id}`}
            >
              <Icon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
                  {article.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{section.title} · {article.readTime} read</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 mt-0.5 ml-auto transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Knowledge Base Page ────────────────────────────────────────────────
export default function KnowledgeBasePage() {
  const { isFeatureEnabled, features } = useFeatures();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Filter sections based on active feature toggles
  const visibleSections = KB_SECTIONS.filter(section => {
    if (!section.feature) return true;
    const keys = Array.isArray(section.feature) ? section.feature : [section.feature];
    return keys.some(k => isFeatureEnabled(k));
  });

  const searchResults = debouncedSearch.length >= 2
    ? searchArticles(debouncedSearch, features || {})
    : [];

  const isSearching = debouncedSearch.length >= 2;

  const handleSelectSection = (section) => {
    setSelectedSection(section);
    setSelectedArticle(null);
    setSearch('');
    setDebouncedSearch('');
  };

  const handleSelectArticle = (article, section) => {
    setSelectedSection(section);
    setSelectedArticle(article);
    setSearch('');
    setDebouncedSearch('');
  };

  return (
    <div className="flex flex-col h-full -mx-6 -mt-6" style={{ height: 'calc(100vh - 48px)' }} data-testid="knowledge-base-page">

      {/* Top header bar */}
      <div
        className="shrink-0 px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-slate-700"
        style={{ background: 'linear-gradient(135deg, #0B1B33 0%, #0a2240 100%)' }}
      >
        {/* Nav toggle */}
        <button
          onClick={() => setNavCollapsed(v => !v)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          data-testid="kb-nav-toggle"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Logo + title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0055CC, #00A3E0)' }}>
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm hidden sm:block">Knowledge Base</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-lg relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search articles, topics, HCPCS codes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-xl text-sm bg-white/10 text-white placeholder-slate-400 border border-white/15 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
            data-testid="kb-search-input"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); searchRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Breadcrumb hint */}
        {selectedArticle && !isSearching && (
          <button
            onClick={() => setSelectedArticle(null)}
            className="hidden md:flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-3 h-3" /> Back to section
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left nav */}
        <KbNav
          visibleSections={visibleSections}
          selected={selectedSection}
          activeArticle={selectedArticle}
          onSelectSection={handleSelectSection}
          onSelectArticle={handleSelectArticle}
          collapsed={navCollapsed}
          onToggle={() => setNavCollapsed(v => !v)}
        />

        {/* Content area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-3xl mx-auto">
            {isSearching ? (
              <SearchResults
                results={searchResults}
                query={debouncedSearch}
                onSelect={handleSelectArticle}
              />
            ) : selectedArticle ? (
              <ArticleView
                article={selectedArticle}
                section={selectedSection}
                onBack={() => setSelectedArticle(null)}
              />
            ) : selectedSection ? (
              <SectionLanding
                section={selectedSection}
                onSelectArticle={(article) => handleSelectArticle(article, selectedSection)}
              />
            ) : (
              <KbHome
                visibleSections={visibleSections}
                onSelectSection={handleSelectSection}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
