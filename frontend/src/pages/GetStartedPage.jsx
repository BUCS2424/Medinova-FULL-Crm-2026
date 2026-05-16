import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { cn } from '@/lib/utils';
import {
  Activity, Hand, Dumbbell, Package, Shield, CreditCard, FileText,
  UserCheck, User, Phone, Mail, MapPin, Clock, MessageSquare,
  X, CheckCircle, ArrowLeft, Loader2, Send, AlertCircle, Info, Heart,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/* ─── Product / pain mapping ──────────────────────────────────────────────── */
const PAIN_OPTIONS = [
  { value: 'back',     label: 'Back',     sub: 'Upper or lower back',      Icon: Activity },
  { value: 'knee',     label: 'Knee',     sub: 'Joint pain or instability', Icon: Activity },
  { value: 'wrist',    label: 'Wrist',    sub: 'Wrist or hand pain',        Icon: Hand     },
  { value: 'shoulder', label: 'Shoulder', sub: 'Pain or stiffness',         Icon: Dumbbell },
  { value: 'other',    label: 'Other',    sub: 'All other products',         Icon: Package  },
];

const INSURANCE_OPTIONS = [
  { value: 'medicare',  label: 'Medicare',  sub: 'Federal health coverage',  Icon: Shield     },
  { value: 'medicaid',  label: 'Medicaid',  sub: 'State health assistance',  Icon: Heart      },
  { value: 'private',   label: 'Private',   sub: 'Employer / marketplace',   Icon: CreditCard },
  { value: 'other',     label: 'Other',     sub: 'VA, self-pay & more',      Icon: FileText   },
];

const PAIN_TO_PRODUCT = {
  back: 'Back Braces',
  knee: 'Knee Braces',
  wrist: 'Wrist & Hand Braces',
  shoulder: 'Shoulder Braces',
  other: 'Medical Equipment',
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function getUtmParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source:   p.get('utm_source')   || null,
    utm_medium:   p.get('utm_medium')   || null,
    utm_campaign: p.get('utm_campaign') || null,
    utm_term:     p.get('utm_term')     || null,
    utm_content:  p.get('utm_content')  || null,
    gclid:        p.get('gclid')        || null,
    referrer:     document.referrer     || null,
    landing_page: window.location.href  || null,
  };
}

/* ─── Selection tile ──────────────────────────────────────────────────────── */
function SelectTile({ option, selected, onClick, wide = false }) {
  const { label, sub, Icon } = option;
  const active = selected === option.value;
  return (
    <button
      type="button"
      onClick={() => onClick(option.value)}
      data-testid={`tile-${option.value}`}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-center transition-all duration-150 cursor-pointer select-none',
        'hover:border-[#0055CC] hover:bg-blue-50/60',
        wide ? 'py-6' : 'py-4',
        active
          ? 'border-[#0055CC] bg-blue-50 shadow-md shadow-blue-100'
          : 'border-gray-200 bg-white'
      )}
    >
      {active && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0055CC]">
          <CheckCircle className="h-3 w-3 text-white fill-white" />
        </span>
      )}
      <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', active ? 'bg-[#0055CC]' : 'bg-blue-50')}>
        <Icon className={cn('h-6 w-6', active ? 'text-white' : 'text-[#0055CC]')} />
      </span>
      <span className={cn('font-bold text-sm', active ? 'text-[#0055CC]' : 'text-gray-900')}>{label}</span>
      {sub && <span className="text-xs text-gray-400 leading-tight">{sub}</span>}
    </button>
  );
}

/* ─── Consent checkbox ────────────────────────────────────────────────────── */
function ConsentBox({ checked, onChange, children, required, testId }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <span className={cn(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
        checked ? 'border-[#0055CC] bg-[#0055CC]' : 'border-gray-300 bg-white group-hover:border-[#0055CC]'
      )}>
        {checked && <CheckCircle className="h-3 w-3 text-white fill-white" />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onChange}
        required={required}
        data-testid={testId}
      />
      <span className="text-xs text-gray-600 leading-relaxed">{children}</span>
    </label>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function GetStartedPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const startedAt = useRef(Date.now());

  const prefillPain = params.get('pain') || params.get('painLocation') || '';
  const prefillFormType = params.get('formType') || 'get_started_page';

  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [data, setData] = useState({
    painLocation:  prefillPain,
    insuranceType: '',
    hasDoctor:     '',
    firstName:     '',
    lastName:      '',
    phone:         '',
    email:         '',
    zipCode:       '',
    bestTime:      '',
    message:       '',
    consentContact: false,
    consentHipaa:   false,
    consentInsurance: false,
    electronicSignature: '',
    website: '', // honeypot
  });

  const set = (k, v) => setData(p => ({ ...p, [k]: v }));

  // If pain was pre-filled via URL, skip to step 2
  useEffect(() => {
    if (prefillPain && PAIN_OPTIONS.some(o => o.value === prefillPain)) {
      setStep(2);
    }
  }, [prefillPain]);

  const product = PAIN_TO_PRODUCT[data.painLocation] || 'Medical Equipment';
  const progress = [0, 25, 50, 75, 100];

  /* ── Navigation ─────────────────────────────────────────────── */
  function goNext() {
    setError('');
    if (step === 1 && !data.painLocation) { setError('Please select an option to continue.'); return; }
    if (step === 2 && !data.insuranceType) { setError('Please select an option to continue.'); return; }
    if (step === 3 && !data.hasDoctor) { setError('Please select an option to continue.'); return; }
    if (step === 4) { handleSubmit(); return; }
    setStep(s => s + 1);
  }

  function goBack() {
    setError('');
    setStep(s => Math.max(1, s - 1));
  }

  /* ── Submit ─────────────────────────────────────────────────── */
  async function handleSubmit() {
    if (!data.consentContact || !data.consentHipaa || !data.consentInsurance) {
      setError('Please accept all required consents to continue.');
      return;
    }
    if (!data.electronicSignature.trim()) {
      setError('Please type your full name as your electronic signature.');
      return;
    }
    if (!data.firstName.trim() || !data.lastName.trim() || !data.phone.trim() || !data.zipCode.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const consentText = `Consent to Contact, HIPAA Authorization, and Insurance Understanding accepted via /get-started page.`;
      await axios.post(`${API_URL}/api/public/leads`, {
        firstName:            data.firstName.trim(),
        lastName:             data.lastName.trim(),
        phone:                data.phone.trim(),
        email:                data.email.trim(),
        zipCode:              data.zipCode.trim(),
        painLocation:         data.painLocation,
        insuranceType:        data.insuranceType,
        hasDoctor:            data.hasDoctor,
        bestTime:             data.bestTime,
        message:              data.message.trim(),
        formType:             prefillFormType,
        consentContact:       data.consentContact,
        consentHipaa:         data.consentHipaa,
        consentInsurance:     data.consentInsurance,
        electronicSignature:  data.electronicSignature.trim(),
        consentLanguage:      consentText,
        consentVersion:       '2.0',
        website:              data.website,
        submissionDuration:   Date.now() - startedAt.current,
        userAgent:            navigator.userAgent,
        screenResolution:     `${window.screen.width}x${window.screen.height}`,
        timezone:             Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...getUtmParams(),
      });
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 5 (Success) ────────────────────────────────────────── */
  if (step === 5) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-3xl bg-white shadow-2xl p-10" data-testid="success-card">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600 fill-green-100 stroke-green-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-3">You're All Set!</h2>
            <p className="text-gray-500 mb-2">
              Thank you, <strong>{data.firstName}</strong>. Your request for{' '}
              <strong>{product}</strong> has been received.
            </p>
            <p className="text-gray-400 text-sm mb-8">
              A MediNova specialist will contact you within 24 hours to verify your Medicare eligibility and coordinate with your doctor.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full rounded-2xl bg-gradient-to-r from-[#0055CC] to-[#00A3E0] py-3.5 font-bold text-white hover:opacity-90 transition-opacity"
              data-testid="success-home-btn"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isStep4 = step === 4;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-[480px]" data-testid="get-started-form">

        {/* ── Card ─────────────────────────────────────────────── */}
        <div className="rounded-3xl overflow-hidden bg-white shadow-2xl">

          {/* ── Header ───────────────────────────────────────────── */}
          {isStep4 ? (
            <div className="bg-gradient-to-r from-[#0055CC] to-[#00C5A0] px-6 pt-6 pb-5">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white/70 text-xs font-medium tracking-widest uppercase mb-1">Step 4 of 4</p>
                  <h1 className="text-white text-2xl font-extrabold leading-tight">Request Information</h1>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Package className="h-3.5 w-3.5 text-white/70" />
                    <span className="text-white/80 text-sm font-medium">{product}</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(-1)}
                  className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors"
                  data-testid="close-btn"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-[#0055CC] text-xl font-extrabold leading-tight">Check Your Eligibility</h1>
                  <p className="text-gray-400 text-xs mt-0.5">Answer a few quick questions</p>
                </div>
                <button
                  onClick={() => navigate(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  data-testid="close-btn"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Progress bar ─────────────────────────────────────── */}
          {!isStep4 && (
            <div className="px-6 pt-3 pb-2 bg-blue-50/60">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500">Step {step} of 4</span>
                <span className="text-xs font-semibold text-[#0055CC]">{progress[step]}% complete</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-gray-900 transition-all duration-300"
                  style={{ width: `${progress[step]}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Body ─────────────────────────────────────────────── */}
          <div className="px-6 py-5">

            {/* Step 1 — Pain location */}
            {step === 1 && (
              <div data-testid="step-1">
                <h2 className="text-xl font-extrabold text-gray-900 mb-5">Where is your pain?</h2>
                <div className="grid grid-cols-3 gap-3 mb-2">
                  {PAIN_OPTIONS.slice(0, 3).map(o => (
                    <SelectTile key={o.value} option={o} selected={data.painLocation} onClick={v => set('painLocation', v)} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {PAIN_OPTIONS.slice(3).map(o => (
                    <SelectTile key={o.value} option={o} selected={data.painLocation} onClick={v => set('painLocation', v)} />
                  ))}
                </div>
              </div>
            )}

            {/* Step 2 — Insurance */}
            {step === 2 && (
              <div data-testid="step-2">
                <h2 className="text-xl font-extrabold text-gray-900 mb-5">What insurance do you have?</h2>
                <div className="grid grid-cols-2 gap-3">
                  {INSURANCE_OPTIONS.map(o => (
                    <SelectTile key={o.value} option={o} selected={data.insuranceType} onClick={v => set('insuranceType', v)} />
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 — Doctor */}
            {step === 3 && (
              <div data-testid="step-3">
                <h2 className="text-xl font-extrabold text-gray-900 mb-5">
                  Do you have a doctor you've seen in the last year?
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <SelectTile
                    wide
                    option={{ value: 'yes', label: 'Yes', sub: 'I have a regular doctor', Icon: UserCheck }}
                    selected={data.hasDoctor}
                    onClick={v => set('hasDoctor', v)}
                  />
                  <SelectTile
                    wide
                    option={{ value: 'no', label: 'No', sub: 'I need a doctor referral', Icon: User }}
                    selected={data.hasDoctor}
                    onClick={v => set('hasDoctor', v)}
                  />
                </div>
              </div>
            )}

            {/* Step 4 — Contact */}
            {step === 4 && (
              <div className="space-y-4" data-testid="step-4">
                {/* Info banner */}
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <Info className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    We'll verify your Medicare eligibility and coordinate with your doctor.
                  </p>
                </div>

                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input
                      type="text" required
                      placeholder="Jane"
                      value={data.firstName}
                      onChange={e => set('firstName', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#0055CC] focus:ring-1 focus:ring-[#0055CC] outline-none transition"
                      data-testid="first-name-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                    <input
                      type="text" required
                      placeholder="Doe"
                      value={data.lastName}
                      onChange={e => set('lastName', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#0055CC] focus:ring-1 focus:ring-[#0055CC] outline-none transition"
                      data-testid="last-name-input"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1">
                    <Phone className="h-3.5 w-3.5 text-[#0055CC]" />
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel" required
                    placeholder="(555) 000-0000"
                    value={data.phone}
                    onChange={e => set('phone', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#0055CC] focus:ring-1 focus:ring-[#0055CC] outline-none transition"
                    data-testid="phone-input"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1">
                    <Mail className="h-3.5 w-3.5 text-[#0055CC]" />
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="jane@example.com"
                    value={data.email}
                    onChange={e => set('email', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#0055CC] focus:ring-1 focus:ring-[#0055CC] outline-none transition"
                    data-testid="email-input"
                  />
                </div>

                {/* ZIP + Best time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1">
                      <MapPin className="h-3.5 w-3.5 text-[#0055CC]" />
                      ZIP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text" required maxLength={10}
                      placeholder="90210"
                      value={data.zipCode}
                      onChange={e => set('zipCode', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#0055CC] focus:ring-1 focus:ring-[#0055CC] outline-none transition"
                      data-testid="zip-input"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1">
                      <Clock className="h-3.5 w-3.5 text-[#0055CC]" />
                      Best Time
                    </label>
                    <select
                      value={data.bestTime}
                      onChange={e => set('bestTime', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#0055CC] focus:ring-1 focus:ring-[#0055CC] outline-none transition bg-white"
                      data-testid="best-time-select"
                    >
                      <option value="">Any time</option>
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1">
                    <MessageSquare className="h-3.5 w-3.5 text-[#0055CC]" />
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any additional details…"
                    value={data.message}
                    onChange={e => set('message', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#0055CC] focus:ring-1 focus:ring-[#0055CC] outline-none transition resize-none"
                    data-testid="notes-input"
                  />
                </div>

                {/* Consent & Authorization */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-[#0055CC] shrink-0" />
                    <span className="text-xs font-bold text-[#0055CC] uppercase tracking-wide">Consent &amp; Authorization</span>
                  </div>
                  <ConsentBox
                    checked={data.consentContact}
                    onChange={e => set('consentContact', e.target.checked)}
                    required
                    testId="consent-contact-checkbox"
                  >
                    <strong>Consent to Contact:</strong> I consent to be contacted by MediNova Medical Supplies via phone, text, or email regarding my equipment request.
                  </ConsentBox>
                  <ConsentBox
                    checked={data.consentHipaa}
                    onChange={e => set('consentHipaa', e.target.checked)}
                    required
                    testId="consent-hipaa-checkbox"
                  >
                    <strong>HIPAA / PHI Permission:</strong> I authorize MediNova Medical Supplies to obtain and share my health information with my physician and insurance company for the purpose of processing this request.
                  </ConsentBox>
                  <ConsentBox
                    checked={data.consentInsurance}
                    onChange={e => set('consentInsurance', e.target.checked)}
                    required
                    testId="consent-insurance-checkbox"
                  >
                    <strong>Insurance Understanding:</strong> I understand that equipment coverage is subject to insurance verification and approval, and I may be responsible for any costs not covered.
                  </ConsentBox>

                  {/* E-signature */}
                  <div className="pt-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Electronic Signature (Type Full Name) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Type your full legal name"
                      value={data.electronicSignature}
                      onChange={e => set('electronicSignature', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm italic focus:border-[#0055CC] focus:ring-1 focus:ring-[#0055CC] outline-none transition"
                      data-testid="esig-input"
                    />
                    <p className="text-[11px] text-gray-400 mt-1 leading-tight">
                      By typing your name above, you confirm you have read, understood, and agree to the terms stated.
                    </p>
                  </div>
                </div>

                {/* Honeypot */}
                <input
                  type="text"
                  name="website"
                  className="hidden"
                  value={data.website}
                  onChange={e => set('website', e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  data-testid="honeypot-input"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5" data-testid="form-error">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* ── Navigation ───────────────────────────────────────── */}
          <div className={cn(
            'flex items-center px-6 pb-6',
            step === 1 ? 'justify-end' : 'justify-between'
          )}>
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                data-testid="back-btn"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={loading}
              className={cn(
                'flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all',
                isStep4
                  ? 'w-full justify-center bg-gradient-to-r from-[#0055CC] to-[#00C040] hover:opacity-90 shadow-lg shadow-green-500/20'
                  : 'bg-[#0055CC] hover:bg-[#004299] shadow-md shadow-blue-200',
                loading && 'opacity-70 cursor-not-allowed'
              )}
              data-testid="next-btn"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
              ) : isStep4 ? (
                <><Send className="h-4 w-4" /> Get Started</>
              ) : (
                <>Next <span className="text-lg leading-none">→</span></>
              )}
            </button>
          </div>
        </div>

        {/* Trust line */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Medicare-covered • No upfront cost • Nationwide delivery
        </p>
      </div>
    </div>
  );
}
