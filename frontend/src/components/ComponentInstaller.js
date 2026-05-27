import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import {
  Upload, FileJson, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, RefreshCw, Trash2, Package,
  FileCode, FilePlus2, FilePen, FilePlus, Info, Loader2,
  PackagePlus, Terminal, RotateCcw, Eye, Blocks,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ── Helpers ────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    success:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    installed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    error:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    skipped:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    restored:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    deleted:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] || map.skipped}`}>
      {status}
    </span>
  );
}

function FileActionIcon({ action }) {
  const icons = {
    create: <FilePlus className="w-3.5 h-3.5 text-emerald-500" />,
    overwrite: <FilePen className="w-3.5 h-3.5 text-amber-500" />,
    patch: <FileCode className="w-3.5 h-3.5 text-blue-500" />,
    append: <FilePlus2 className="w-3.5 h-3.5 text-violet-500" />,
  };
  return icons[action] || <FileCode className="w-3.5 h-3.5 text-slate-400" />;
}

// ── Installed plugin card ───────────────────────────────────────────────────
function InstalledPluginCard({ plugin, onUninstall, uninstalling }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 shrink-0">
            <Blocks className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{plugin.name}</p>
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">v{plugin.version}</Badge>
              <StatusBadge status={plugin.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{plugin.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onUninstall(plugin.id, plugin.name)}
            disabled={uninstalling === plugin.id}
            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
            title="Uninstall / Rollback"
          >
            {uninstalling === plugin.id
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RotateCcw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-800/30 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-slate-400">Author</span><p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{plugin.author || '—'}</p></div>
            <div><span className="text-slate-400">Installed</span><p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{plugin.installed_at ? new Date(plugin.installed_at).toLocaleDateString() : '—'}</p></div>
            <div><span className="text-slate-400">Installed by</span><p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{plugin.installed_by || '—'}</p></div>
            <div><span className="text-slate-400">Feature key</span><p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 font-mono">{plugin.feature_key || 'none'}</p></div>
          </div>
          {plugin.tags?.length > 0 && (
            <div className="flex gap-1 flex-wrap pt-1">
              {plugin.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">{t}</span>
              ))}
            </div>
          )}
          {plugin.changelog && (
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Changelog</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{plugin.changelog}</p>
            </div>
          )}
          {plugin.notes && (
            <div className="flex gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">{plugin.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Preview panel ──────────────────────────────────────────────────────────
function PreviewPanel({ preview }) {
  return (
    <div className="space-y-4">
      {/* Plugin header */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-600 shrink-0">
          <Blocks className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-900 dark:text-slate-100">{preview.name}</p>
            <Badge variant="outline" className="font-mono text-[10px]">v{preview.version}</Badge>
            {preview.already_installed && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold">
                Update: v{preview.installed_version} → v{preview.version}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{preview.description}</p>
          {preview.author && <p className="text-xs text-slate-400 mt-0.5">by {preview.author}{preview.created_at ? ` · ${preview.created_at}` : ''}</p>}
        </div>
      </div>

      {/* File operations */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          File Operations ({preview.files?.length || 0})
        </p>
        <div className="space-y-1.5">
          {preview.files?.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <FileActionIcon action={f.action} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">{f.path}</p>
                {f.patches !== null && f.patches !== undefined && (
                  <p className="text-[10px] text-slate-400">{f.patches} patch{f.patches !== 1 ? 'es' : ''}</p>
                )}
                {f.size_bytes !== null && f.size_bytes !== undefined && (
                  <p className="text-[10px] text-slate-400">{(f.size_bytes / 1024).toFixed(1)} KB</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  f.action === 'create' ? 'bg-emerald-100 text-emerald-700' :
                  f.action === 'overwrite' ? 'bg-amber-100 text-amber-700' :
                  f.action === 'patch' ? 'bg-blue-100 text-blue-700' :
                  'bg-violet-100 text-violet-700'
                }`}>{f.action}</span>
                {f.exists && f.action !== 'patch' && (
                  <span className="text-[10px] text-amber-600" title="File already exists">⚠</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Packages */}
      {(preview.pip_packages?.length > 0 || preview.npm_packages?.length > 0) && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Required Packages</p>
          <div className="space-y-1">
            {preview.pip_packages?.map(p => (
              <div key={p} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-mono">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">pip install {p}</span>
              </div>
            ))}
            {preview.npm_packages?.map(p => (
              <div key={p} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-mono">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">yarn add {p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Env vars */}
      {preview.env_vars?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Required Environment Variables</p>
          <div className="space-y-1">
            {preview.env_vars.map((v, i) => (
              <div key={i} className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-mono font-semibold text-amber-800 dark:text-amber-300">{v.key}</p>
                {v.description && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{v.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Restart warnings */}
      {(preview.restart_backend || preview.restart_frontend) && (
        <div className="flex gap-2 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
          <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">Restart required after install</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
              {[preview.restart_backend && 'Backend (supervisor restart backend)', preview.restart_frontend && 'Frontend (hot reload will trigger automatically)'].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      {preview.notes && (
        <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">{preview.notes}</p>
        </div>
      )}

      {/* Changelog */}
      {preview.changelog && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Changelog</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{preview.changelog}</p>
        </div>
      )}
    </div>
  );
}

// ── Install result panel ───────────────────────────────────────────────────
function InstallResult({ result }) {
  const allOk = result.errors === 0;
  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${allOk ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
        {allOk
          ? <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          : <XCircle className="w-6 h-6 text-red-600 shrink-0" />}
        <div>
          <p className={`font-semibold text-sm ${allOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {allOk ? 'Plugin installed successfully' : `Install completed with ${result.errors} error${result.errors !== 1 ? 's' : ''}`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {result.files_applied} file{result.files_applied !== 1 ? 's' : ''} applied
            {result.reload_frontend ? ' · Frontend is reloading...' : ''}
            {result.restart_backend ? ' · Restart backend via supervisor' : ''}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {result.steps?.map((step, i) => (
          <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            {step.status === 'success'
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              : step.status === 'skipped'
              ? <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">{step.path}</p>
              {step.message && <p className="text-[10px] text-slate-500 mt-0.5">{step.message}</p>}
              {step.log?.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {step.log.map((l, li) => (
                    <li key={li} className={`text-[10px] font-mono ${l.startsWith('Applied') ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
            <StatusBadge status={step.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component Installer ───────────────────────────────────────────────
export default function ComponentInstaller() {
  const [plugins, setPlugins] = useState([]);
  const [loadingPlugins, setLoadingPlugins] = useState(true);
  const [jsonInput, setJsonInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [installResult, setInstallResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(null);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef(null);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('dme_token')}` });

  const loadPlugins = useCallback(async () => {
    setLoadingPlugins(true);
    try {
      const res = await axios.get(`${API_URL}/api/plugins`, { headers: headers() });
      setPlugins(res.data.plugins || []);
    } catch { setPlugins([]); } finally { setLoadingPlugins(false); }
  }, []);

  useEffect(() => { loadPlugins(); }, [loadPlugins]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonInput(ev.target.result);
      setPreview(null);
      setInstallResult(null);
      setParseError('');
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    setParseError('');
    setPreview(null);
    setInstallResult(null);
    let bundle;
    try {
      bundle = JSON.parse(jsonInput);
    } catch {
      setParseError('Invalid JSON — check your bundle format');
      return;
    }
    setPreviewing(true);
    try {
      const res = await axios.post(`${API_URL}/api/plugins/preview`, bundle, { headers: headers() });
      setPreview(res.data);
    } catch (e) {
      setParseError(e?.response?.data?.detail || 'Preview failed');
    } finally { setPreviewing(false); }
  };

  const handleInstall = async () => {
    if (!preview) return;
    let bundle;
    try { bundle = JSON.parse(jsonInput); } catch { return; }
    setInstalling(true);
    setInstallResult(null);
    try {
      const res = await axios.post(`${API_URL}/api/plugins/install`, bundle, { headers: headers() });
      setInstallResult(res.data);
      if (res.data.status === 'success') {
        toast.success(`Plugin "${preview.name}" installed successfully`);
        loadPlugins();
        setPreview(null);
        setJsonInput('');
      } else {
        toast.error(`Install completed with errors`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Installation failed');
    } finally { setInstalling(false); }
  };

  const handleUninstall = async (pluginId, pluginName) => {
    if (!window.confirm(`Uninstall "${pluginName}"? This will roll back all file changes.`)) return;
    setUninstalling(pluginId);
    try {
      await axios.delete(`${API_URL}/api/plugins/${pluginId}`, { headers: headers() });
      toast.success(`Plugin "${pluginName}" uninstalled`);
      loadPlugins();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Uninstall failed');
    } finally { setUninstalling(null); }
  };

  return (
    <div className="space-y-8" data-testid="component-installer">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0055CC, #00A3E0)' }}>
              <Blocks className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-bold">Component Installer</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Install packaged plugin bundles to add new features to this version of the app.
            Future builds can export components as <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">.json</code> bundles and install them here.
          </p>
        </div>
      </div>

      {/* Bundle format explainer */}
      <div className="flex gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">How Plugin Bundles Work</p>
          <p>A plugin bundle is a <strong>single .json file</strong> that describes files to create, patch, or append — along with any packages and env vars needed. When a new feature is developed in a future fork, it gets packaged as a bundle and installed here to update older versions.</p>
          <p className="text-xs text-slate-400">Supported actions: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">create</code> · <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">overwrite</code> · <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">patch</code> · <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">append</code></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* LEFT: Install new plugin */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-blue-600" />
            Install Plugin
          </h3>

          {/* Upload area */}
          <div
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = ev => { setJsonInput(ev.target.result); setPreview(null); setInstallResult(null); setParseError(''); };
                reader.readAsText(file);
              }
            }}
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Drop .json plugin bundle here</p>
            <p className="text-xs text-slate-400 mt-1">or click to browse</p>
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} data-testid="plugin-file-input" />
          </div>

          {/* OR paste JSON */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Or paste JSON directly</p>
            <textarea
              value={jsonInput}
              onChange={e => { setJsonInput(e.target.value); setPreview(null); setInstallResult(null); setParseError(''); }}
              placeholder={'{\n  "id": "my-plugin",\n  "name": "My Plugin",\n  "version": "1.0.0",\n  "files": [...]\n}'}
              rows={10}
              className="w-full font-mono text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:border-blue-400 transition-colors placeholder-slate-400"
              data-testid="plugin-json-input"
            />
          </div>

          {parseError && (
            <div className="flex gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400">{parseError}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handlePreview}
              disabled={!jsonInput.trim() || previewing}
              data-testid="preview-plugin-btn"
            >
              {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Preview
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleInstall}
              disabled={!preview || installing}
              style={{ background: preview ? 'linear-gradient(135deg, #0055CC, #00A3E0)' : undefined }}
              data-testid="install-plugin-btn"
            >
              {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
              Install
            </Button>
          </div>
        </div>

        {/* RIGHT: Preview / Result */}
        <div>
          {installResult ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                {installResult.status === 'success'
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  : <XCircle className="w-4 h-4 text-red-600" />}
                Install Result
              </h3>
              <InstallResult result={installResult} />
            </div>
          ) : preview ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                Preview — what will be installed
              </h3>
              <PreviewPanel preview={preview} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 text-slate-400">
              <FileJson className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Preview will appear here</p>
              <p className="text-xs mt-1 opacity-70">Paste or upload a plugin bundle, then click Preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Installed plugins list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-600" />
            Installed Plugins
            {!loadingPlugins && (
              <Badge variant="secondary" className="ml-1 text-xs">{plugins.length}</Badge>
            )}
          </h3>
          <button
            onClick={loadPlugins}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loadingPlugins ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingPlugins ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : plugins.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No plugins installed yet</p>
            <p className="text-xs mt-1 opacity-70">Install your first plugin bundle above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plugins.map(p => (
              <InstalledPluginCard
                key={p.id}
                plugin={p}
                onUninstall={handleUninstall}
                uninstalling={uninstalling}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
