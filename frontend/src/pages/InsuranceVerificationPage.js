import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  ShieldCheck, AlertTriangle, Loader2, Settings, CheckCircle2,
  XCircle, Clock, RefreshCw, Search, Activity
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('dme_token')}` });

// --- Shared form fields --------------------------------------------------
const EMPTY_FORM = {
  payer_id: '',
  member_id: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  service_type: 'DME',
};

// --- Status badge helper ------------------------------------------------
function StatusBadge({ connected, configured }) {
  if (connected) return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" />Connected</Badge>;
  if (configured) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1"><AlertTriangle className="w-3 h-3" />Auth Failed</Badge>;
  return <Badge variant="outline" className="text-gray-500 gap-1"><XCircle className="w-3 h-3" />Not Configured</Badge>;
}

// --- Result Panel -------------------------------------------------------
function ResultPanel({ result }) {
  if (!result) return null;
  const isEligible = result.eligible === true || result.status === 'active' || result.coverageStatus === 'ACTIVE';
  const isError = result.error;
  return (
    <div className={`rounded-xl border p-5 ${isError ? 'bg-red-50 border-red-200' : isEligible ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
      <div className="flex items-center gap-2 mb-3">
        {isError ? <XCircle className="w-5 h-5 text-red-500" /> : isEligible ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-yellow-600" />}
        <span className="font-semibold text-sm">
          {isError ? 'Check Failed' : isEligible ? 'Eligible — Coverage Active' : 'Not Eligible / Inactive Coverage'}
        </span>
      </div>
      {isError && <p className="text-sm text-red-600">{result.message || JSON.stringify(result)}</p>}
      {!isError && (
        <pre className="text-xs bg-white/70 rounded-lg p-3 overflow-auto max-h-64 text-gray-700">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

// --- Logs Table ---------------------------------------------------------
function LogsTable({ logs }) {
  if (!logs.length) return <p className="text-sm text-gray-400 py-4 text-center">No checks run yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Timestamp</th>
            <th className="text-left px-4 py-3 font-medium">Member</th>
            <th className="text-left px-4 py-3 font-medium">Payer</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-500">
                {l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3 font-medium text-gray-800">
                {[l.request?.member_first_name || l.request?.first_name, l.request?.member_last_name || l.request?.last_name].filter(Boolean).join(' ') || l.request?.member_id || '—'}
              </td>
              <td className="px-4 py-3 text-gray-600">{l.request?.payer_id || '—'}</td>
              <td className="px-4 py-3">
                {l.status_code === 200
                  ? <Badge className="bg-green-100 text-green-700 text-xs">Success</Badge>
                  : <Badge className="bg-red-100 text-red-700 text-xs">HTTP {l.status_code}</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Check Form ---------------------------------------------------------
function EligibilityForm({ onResult, endpoint, disabled }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [running, setRunning] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.payer_id || !form.member_id || !form.first_name || !form.last_name || !form.date_of_birth) {
      toast.error('Please fill in all required fields');
      return;
    }
    setRunning(true);
    try {
      const payload = endpoint.includes('availity')
        ? { payer_id: form.payer_id, member_id: form.member_id, member_first_name: form.first_name, member_last_name: form.last_name, member_dob: form.date_of_birth, service_type_codes: ['DM'] }
        : { payer_id: form.payer_id, member_id: form.member_id, first_name: form.first_name, last_name: form.last_name, date_of_birth: form.date_of_birth, service_type: form.service_type };
      const res = await axios.post(`${API_URL}${endpoint}`, payload, { headers: getHeaders() });
      onResult(res.data);
      toast.success('Eligibility check complete');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Check failed';
      onResult({ error: true, message: msg });
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="eligibility-check-form">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Payer ID <span className="text-red-500">*</span></Label>
          <Input data-testid="elig-payer-id" placeholder="e.g. MCARE, BCBS001" value={form.payer_id} onChange={e => set('payer_id', e.target.value)} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label>Member / Insurance ID <span className="text-red-500">*</span></Label>
          <Input data-testid="elig-member-id" placeholder="Insurance Member ID" value={form.member_id} onChange={e => set('member_id', e.target.value)} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label>First Name <span className="text-red-500">*</span></Label>
          <Input data-testid="elig-first-name" placeholder="Patient first name" value={form.first_name} onChange={e => set('first_name', e.target.value)} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label>Last Name <span className="text-red-500">*</span></Label>
          <Input data-testid="elig-last-name" placeholder="Patient last name" value={form.last_name} onChange={e => set('last_name', e.target.value)} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label>Date of Birth <span className="text-red-500">*</span></Label>
          <Input data-testid="elig-dob" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label>Service Type</Label>
          <Select value={form.service_type} onValueChange={v => set('service_type', v)} disabled={disabled}>
            <SelectTrigger data-testid="elig-service-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DME">DME (Durable Medical Equipment)</SelectItem>
              <SelectItem value="30">Health Benefit Plan Coverage</SelectItem>
              <SelectItem value="MH">Mental Health</SelectItem>
              <SelectItem value="UC">Urgent Care</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={running || disabled} data-testid="run-eligibility-btn" className="gap-2">
          {running ? <><Loader2 className="w-4 h-4 animate-spin" />Checking...</> : <><Search className="w-4 h-4" />Run Eligibility Check</>}
        </Button>
      </div>
    </form>
  );
}

// ========================================================================
// Main Page
// ========================================================================
export default function InsuranceVerificationPage() {
  const [availityStatus, setAvailityStatus] = useState(null);
  const [waystarStatus, setWaystarStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [availityResult, setAvailityResult] = useState(null);
  const [waystarResult, setWaystarResult] = useState(null);
  const [availityLogs, setAvailityLogs] = useState([]);
  const [waystarLogs, setWaystarLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = async () => {
    try {
      setLoadingStatus(true);
      const [av, ws, avLogs, wsLogs] = await Promise.allSettled([
        axios.get(`${API_URL}/api/availity/status`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/waystar/status`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/availity/logs`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/waystar/logs`, { headers: getHeaders() }),
      ]);
      if (av.status === 'fulfilled') setAvailityStatus(av.value.data);
      if (ws.status === 'fulfilled') setWaystarStatus(ws.value.data);
      if (avLogs.status === 'fulfilled') setAvailityLogs(avLogs.value.data?.logs || []);
      if (wsLogs.status === 'fulfilled') setWaystarLogs(wsLogs.value.data?.logs || []);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  };

  const anyConfigured = availityStatus?.configured || waystarStatus?.configured;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6" data-testid="insurance-verification-page">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#0055CC]" />
            Insurance Verification
          </h1>
          <p className="text-sm text-gray-500 mt-1">Real-time eligibility checks via Availity (270/271) and Waystar</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} data-testid="refresh-status-btn" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Status Banner — Not Configured */}
      {!loadingStatus && !anyConfigured && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="not-configured-banner">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">No integration configured</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Enable Availity or Waystar in Features, then enter credentials in{' '}
              <a href="/admin-settings?tab=availity" className="underline font-medium hover:no-underline">Admin Settings → Availity</a>
              {' '}or{' '}
              <a href="/admin-settings?tab=waystar" className="underline font-medium hover:no-underline">Waystar</a>.
            </p>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card data-testid="availity-status-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" />Availity</span>
              {loadingStatus ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <StatusBadge connected={availityStatus?.connected} configured={availityStatus?.configured} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-gray-500">{availityStatus?.environment === 'production' ? 'Production' : 'Test'} · Eligibility 270/271, Member Cards, Payer List</p>
            {availityStatus?.message && !availityStatus?.connected && (
              <p className="text-xs text-red-500 mt-1">{availityStatus.message}</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="waystar-status-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-purple-500" />Waystar</span>
              {loadingStatus ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <StatusBadge connected={waystarStatus?.connected} configured={waystarStatus?.configured} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-gray-500">{waystarStatus?.environment === 'production' ? 'Production' : 'Sandbox'} · Eligibility 270/271, Claims 276/277</p>
            {waystarStatus?.message && !waystarStatus?.connected && (
              <p className="text-xs text-red-500 mt-1">{waystarStatus.message}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Check + Logs Tabs */}
      <Tabs defaultValue={availityStatus?.configured ? 'availity' : 'waystar'}>
        <TabsList data-testid="service-tabs">
          <TabsTrigger value="availity" data-testid="tab-availity">Availity</TabsTrigger>
          <TabsTrigger value="waystar" data-testid="tab-waystar">Waystar</TabsTrigger>
        </TabsList>

        {/* ---- Availity Tab ---- */}
        <TabsContent value="availity" className="space-y-5 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Run Eligibility Check — Availity</CardTitle></CardHeader>
            <CardContent>
              {!availityStatus?.configured ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Settings className="w-4 h-4" />
                  <span>Configure Availity credentials in <a href="/admin-settings?tab=availity" className="text-[#0055CC] underline">Admin Settings</a> first.</span>
                </div>
              ) : (
                <EligibilityForm
                  endpoint="/api/availity/eligibility/check"
                  onResult={setAvailityResult}
                  disabled={!availityStatus?.configured}
                />
              )}
            </CardContent>
          </Card>
          {availityResult && (
            <Card>
              <CardHeader><CardTitle className="text-base">Result</CardTitle></CardHeader>
              <CardContent><ResultPanel result={availityResult} /></CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" />Recent Checks</CardTitle></CardHeader>
            <CardContent><LogsTable logs={availityLogs.slice(0, 20)} /></CardContent>
          </Card>
        </TabsContent>

        {/* ---- Waystar Tab ---- */}
        <TabsContent value="waystar" className="space-y-5 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Run Eligibility Check — Waystar</CardTitle></CardHeader>
            <CardContent>
              {!waystarStatus?.configured ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Settings className="w-4 h-4" />
                  <span>Configure Waystar credentials in <a href="/admin-settings?tab=waystar" className="text-[#0055CC] underline">Admin Settings</a> first.</span>
                </div>
              ) : (
                <EligibilityForm
                  endpoint="/api/waystar/eligibility/check"
                  onResult={setWaystarResult}
                  disabled={!waystarStatus?.configured}
                />
              )}
            </CardContent>
          </Card>
          {waystarResult && (
            <Card>
              <CardHeader><CardTitle className="text-base">Result</CardTitle></CardHeader>
              <CardContent><ResultPanel result={waystarResult} /></CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" />Recent Checks</CardTitle></CardHeader>
            <CardContent><LogsTable logs={waystarLogs.slice(0, 20)} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
