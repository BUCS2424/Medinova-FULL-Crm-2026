import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const dmeCategoryOptions = [
  'Back Braces (LSO/TLSO)',
  'Knee Braces',
  'Wheelchairs (Manual)',
  'Power Wheelchairs',
  'CPAP/BiPAP',
  'Hospital Beds',
  'Oxygen Equipment',
  'Diabetic Supplies',
  'Wound Care Supplies',
  'Enteral Nutrition',
  'Bath Safety',
  'Walkers/Rollators',
];

const defaultInsuranceData = {
  primary: {
    status: 'active',
    payer_name: '',
    payer_id: '',
    payer_phone: '',
    member_id: '',
    group_number: '',
    subscriber_name: '',
    relationship: 'Self',
    plan_name: '',
    plan_type: '',
    coverage_type: 'Medical',
    effective_date: '',
    termination_date: '',
  },
  secondary: {
    payer_name: '',
    plan_name: '',
    plan_type: '',
    covers_coinsurance: false,
    covers_deductible: false,
  },
  financial_summary: {
    deductible_annual: null,
    deductible_met: null,
    deductible_remaining: null,
    coinsurance: null,
    coverage_percentage: null,
    oop_max_annual: null,
    oop_max_met: null,
  },
  dme_benefits: [],
  claims_summary: [],
  remittance: {
    last_era_date: '',
    last_era_number: '',
    payment_method: '',
    total_payments_ytd: null,
  },
  verification: {
    last_verified: '',
    verified_by: '',
    source: '',
  },
  section_verification: {
    primary: false,
    financial_summary: false,
    dme_benefits: false,
    claims_summary: false,
    remittance: false,
    secondary: false,
    verification: false,
  },
};

const parseNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const PatientInsuranceCoverage = ({ patientId, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insuranceData, setInsuranceData] = useState(defaultInsuranceData);
  const [openSections, setOpenSections] = useState({
    primary: true,
    financial_summary: true,
    dme_benefits: true,
    claims_summary: true,
    remittance: true,
    secondary: true,
    verification: true,
  });

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchInsuranceData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/patients/${patientId}/insurance-data`, { headers: getHeaders() });
      setInsuranceData({
        ...defaultInsuranceData,
        ...(response.data || {}),
        section_verification: {
          ...defaultInsuranceData.section_verification,
          ...((response.data || {}).section_verification || {}),
        },
      });
    } catch (error) {
      toast.error('Failed to load insurance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsuranceData();
  }, [patientId]);

  const setPrimaryField = (key, value) => {
    setInsuranceData((prev) => ({ ...prev, primary: { ...prev.primary, [key]: value } }));
  };

  const setSecondaryField = (key, value) => {
    setInsuranceData((prev) => ({ ...prev, secondary: { ...prev.secondary, [key]: value } }));
  };

  const setFinancialField = (key, value) => {
    setInsuranceData((prev) => ({
      ...prev,
      financial_summary: { ...prev.financial_summary, [key]: parseNumber(value) },
    }));
  };

  const setRemittanceField = (key, value) => {
    setInsuranceData((prev) => ({
      ...prev,
      remittance: {
        ...prev.remittance,
        [key]: key === 'total_payments_ytd' ? parseNumber(value) : value,
      },
    }));
  };

  const setVerificationField = (key, value) => {
    setInsuranceData((prev) => ({ ...prev, verification: { ...prev.verification, [key]: value } }));
  };

  const setSectionVerified = (sectionKey, checked) => {
    setInsuranceData((prev) => ({
      ...prev,
      section_verification: { ...prev.section_verification, [sectionKey]: checked },
    }));
  };

  const addDmeBenefit = () => {
    const newBenefit = { name: dmeCategoryOptions[0], covered: true, prior_auth: false, coinsurance: null, notes: '' };
    setInsuranceData((prev) => ({ ...prev, dme_benefits: [...(prev.dme_benefits || []), newBenefit] }));
  };

  const updateDmeBenefit = (index, key, value) => {
    setInsuranceData((prev) => {
      const updated = [...(prev.dme_benefits || [])];
      updated[index] = {
        ...updated[index],
        [key]: key === 'coinsurance' ? parseNumber(value) : value,
      };
      return { ...prev, dme_benefits: updated };
    });
  };

  const removeDmeBenefit = (index) => {
    setInsuranceData((prev) => ({
      ...prev,
      dme_benefits: (prev.dme_benefits || []).filter((_, idx) => idx !== index),
    }));
  };

  const addClaim = () => {
    const newClaim = {
      claim_id: '',
      date: '',
      description: '',
      billed: null,
      allowed: null,
      paid: null,
      patient_owes: null,
      status: 'pending',
    };
    setInsuranceData((prev) => ({ ...prev, claims_summary: [...(prev.claims_summary || []), newClaim] }));
  };

  const updateClaim = (index, key, value) => {
    setInsuranceData((prev) => {
      const updated = [...(prev.claims_summary || [])];
      updated[index] = {
        ...updated[index],
        [key]: ['billed', 'allowed', 'paid', 'patient_owes'].includes(key) ? parseNumber(value) : value,
      };
      return { ...prev, claims_summary: updated };
    });
  };

  const removeClaim = (index) => {
    setInsuranceData((prev) => ({
      ...prev,
      claims_summary: (prev.claims_summary || []).filter((_, idx) => idx !== index),
    }));
  };

  const saveAllInsuranceData = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/patients/${patientId}/insurance-data`, insuranceData, { headers: getHeaders() });
      toast.success('Insurance data saved successfully');
      onSaved?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save insurance data');
    } finally {
      setSaving(false);
    }
  };

  const isVerified = (sectionKey) => !!insuranceData.section_verification?.[sectionKey];

  const sectionCardClasses = (sectionKey) => (
    isVerified(sectionKey) ? 'border-green-300 bg-green-50/40' : ''
  );

  const renderSectionFrame = (sectionKey, title, content, options = {}) => {
    const { countBadge, headerActions } = options;
    const isOpen = !!openSections[sectionKey];

    return (
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, [sectionKey]: open }))}
      >
        <Card className={sectionCardClasses(sectionKey)} data-testid={`patient-insurance-${sectionKey}-section`}>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{title}</CardTitle>
                {typeof countBadge === 'number' && (
                  <Badge variant="secondary" data-testid={`patient-insurance-${sectionKey}-count-badge`}>
                    {countBadge}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {headerActions}
                <div className="flex items-center gap-2 border rounded-md px-2 py-1 bg-white/80" data-testid={`patient-insurance-${sectionKey}-verified-toggle-wrap`}>
                  <Label className="text-xs">Verified</Label>
                  <Switch
                    checked={isVerified(sectionKey)}
                    onCheckedChange={(checked) => setSectionVerified(sectionKey, checked)}
                    data-testid={`patient-insurance-${sectionKey}-verified-toggle`}
                  />
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid={`patient-insurance-${sectionKey}-toggle-button`}>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent>{content}</CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  if (loading) {
    return (
      <Card data-testid="patient-insurance-loading-card">
        <CardContent className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading insurance coverage...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="patient-insurance-coverage-container">
      <div className="flex justify-end">
        <Button onClick={saveAllInsuranceData} disabled={saving} data-testid="patient-insurance-save-all-top-button">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save All Insurance Data
        </Button>
      </div>

      {renderSectionFrame(
        'primary',
        'Primary Insurance',
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <select className="w-full border rounded-md h-10 px-3 bg-background" value={insuranceData.primary?.status || ''} onChange={(e) => setPrimaryField('status', e.target.value)} data-testid="patient-insurance-primary-status-select">
              {['active', 'inactive', 'pending'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          {[
            ['payer_name', 'Payer Name'], ['payer_id', 'Payer ID'], ['payer_phone', 'Payer Phone'],
            ['member_id', 'Member ID'], ['group_number', 'Group Number'], ['subscriber_name', 'Subscriber Name'],
            ['plan_name', 'Plan Name'], ['coverage_type', 'Coverage Type'],
          ].map(([key, label]) => (
            <div key={key}>
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input value={insuranceData.primary?.[key] || ''} onChange={(e) => setPrimaryField(key, e.target.value)} data-testid={`patient-insurance-primary-${key}-input`} />
            </div>
          ))}
          <div>
            <Label className="text-xs text-muted-foreground">Relationship</Label>
            <select className="w-full border rounded-md h-10 px-3 bg-background" value={insuranceData.primary?.relationship || ''} onChange={(e) => setPrimaryField('relationship', e.target.value)} data-testid="patient-insurance-primary-relationship-select">
              {['Self', 'Spouse', 'Child', 'Other'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Plan Type</Label>
            <select className="w-full border rounded-md h-10 px-3 bg-background" value={insuranceData.primary?.plan_type || ''} onChange={(e) => setPrimaryField('plan_type', e.target.value)} data-testid="patient-insurance-primary-plan-type-select">
              {['Medicare', 'Medicaid', 'Commercial', 'HMO', 'PPO', 'Medigap', 'Other'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Effective Date</Label>
            <Input type="date" value={insuranceData.primary?.effective_date || ''} onChange={(e) => setPrimaryField('effective_date', e.target.value)} data-testid="patient-insurance-primary-effective-date-input" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Termination Date</Label>
            <Input type="date" value={insuranceData.primary?.termination_date || ''} onChange={(e) => setPrimaryField('termination_date', e.target.value)} data-testid="patient-insurance-primary-termination-date-input" />
          </div>
        </div>
      )}

      {renderSectionFrame(
        'financial_summary',
        'Financial Summary',
        <div className="grid md:grid-cols-4 gap-3">
          {[
            ['deductible_annual', 'Annual Deductible ($)'],
            ['deductible_met', 'Deductible Met ($)'],
            ['deductible_remaining', 'Deductible Remaining ($)'],
            ['coinsurance', 'Coinsurance (%)'],
            ['coverage_percentage', 'Coverage (%)'],
            ['oop_max_annual', 'OOP Max Annual ($)'],
            ['oop_max_met', 'OOP Max Met ($)'],
          ].map(([key, label]) => (
            <div key={key}>
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input type="number" value={insuranceData.financial_summary?.[key] ?? ''} onChange={(e) => setFinancialField(key, e.target.value)} data-testid={`patient-insurance-financial-${key}-input`} />
            </div>
          ))}
        </div>
      )}

      {renderSectionFrame(
        'dme_benefits',
        'DME Coverage by Category',
        <div className="space-y-3">
          {(insuranceData.dme_benefits || []).length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="patient-insurance-dme-empty-text">No data — click Add.</p>
          ) : (
            insuranceData.dme_benefits.map((benefit, index) => (
              <div key={`dme-${index}`} className="p-3 border rounded-lg space-y-3" data-testid={`patient-insurance-dme-row-${index}`}>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">DME Category</Label>
                    <select className="w-full border rounded-md h-10 px-3 bg-background" value={benefit.name || ''} onChange={(e) => updateDmeBenefit(index, 'name', e.target.value)} data-testid={`patient-insurance-dme-${index}-name-select`}>
                      {dmeCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Coinsurance (%)</Label>
                    <Input type="number" value={benefit.coinsurance ?? ''} onChange={(e) => updateDmeBenefit(index, 'coinsurance', e.target.value)} data-testid={`patient-insurance-dme-${index}-coinsurance-input`} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm" data-testid={`patient-insurance-dme-${index}-covered-checkbox-wrap`}>
                    <input type="checkbox" checked={!!benefit.covered} onChange={(e) => updateDmeBenefit(index, 'covered', e.target.checked)} data-testid={`patient-insurance-dme-${index}-covered-checkbox`} /> Covered
                  </label>
                  <label className="flex items-center gap-2 text-sm" data-testid={`patient-insurance-dme-${index}-prior-auth-checkbox-wrap`}>
                    <input type="checkbox" checked={!!benefit.prior_auth} onChange={(e) => updateDmeBenefit(index, 'prior_auth', e.target.checked)} data-testid={`patient-insurance-dme-${index}-prior-auth-checkbox`} /> Prior Auth Required
                  </label>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea value={benefit.notes || ''} onChange={(e) => updateDmeBenefit(index, 'notes', e.target.value)} data-testid={`patient-insurance-dme-${index}-notes-textarea`} />
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => removeDmeBenefit(index)} data-testid={`patient-insurance-dme-${index}-delete-button`}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>,
        {
          countBadge: (insuranceData.dme_benefits || []).length,
          headerActions: (
            <Button variant="outline" size="sm" onClick={addDmeBenefit} data-testid="patient-insurance-dme-add-button">
              <Plus className="w-4 h-4 mr-1" /> Add DME Category
            </Button>
          ),
        }
      )}

      {renderSectionFrame(
        'claims_summary',
        'Claims History',
        <div className="space-y-3">
          {(insuranceData.claims_summary || []).length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="patient-insurance-claims-empty-text">No data — click Add.</p>
          ) : (
            insuranceData.claims_summary.map((claim, index) => (
              <div key={`claim-${index}`} className="p-3 border rounded-lg space-y-3" data-testid={`patient-insurance-claims-row-${index}`}>
                <div className="grid md:grid-cols-4 gap-3">
                  {[
                    ['claim_id', 'Claim ID'], ['date', 'Date', 'date'], ['description', 'Description'], ['status', 'Status', 'select'],
                    ['billed', 'Billed ($)', 'number'], ['allowed', 'Allowed ($)', 'number'], ['paid', 'Paid ($)', 'number'], ['patient_owes', 'Patient Owes ($)', 'number'],
                  ].map(([key, label, type]) => (
                    <div key={key}>
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      {type === 'select' ? (
                        <select className="w-full border rounded-md h-10 px-3 bg-background" value={claim.status || 'pending'} onChange={(e) => updateClaim(index, 'status', e.target.value)} data-testid={`patient-insurance-claims-${index}-status-select`}>
                          {['pending', 'paid', 'denied', 'appealed'].map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : (
                        <Input type={type || 'text'} value={claim[key] ?? ''} onChange={(e) => updateClaim(index, key, e.target.value)} data-testid={`patient-insurance-claims-${index}-${key}-input`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => removeClaim(index)} data-testid={`patient-insurance-claims-${index}-delete-button`}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>,
        {
          countBadge: (insuranceData.claims_summary || []).length,
          headerActions: (
            <Button variant="outline" size="sm" onClick={addClaim} data-testid="patient-insurance-claims-add-button">
              <Plus className="w-4 h-4 mr-1" /> Add Claim
            </Button>
          ),
        }
      )}

      {renderSectionFrame(
        'remittance',
        'Remittance (ERA/835)',
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Last ERA Date</Label>
            <Input type="date" value={insuranceData.remittance?.last_era_date || ''} onChange={(e) => setRemittanceField('last_era_date', e.target.value)} data-testid="patient-insurance-remittance-last-era-date-input" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Last ERA Number</Label>
            <Input value={insuranceData.remittance?.last_era_number || ''} onChange={(e) => setRemittanceField('last_era_number', e.target.value)} data-testid="patient-insurance-remittance-last-era-number-input" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Payment Method</Label>
            <select className="w-full border rounded-md h-10 px-3 bg-background" value={insuranceData.remittance?.payment_method || ''} onChange={(e) => setRemittanceField('payment_method', e.target.value)} data-testid="patient-insurance-remittance-payment-method-select">
              {['', 'EFT', 'Check', 'Virtual Card'].map((option) => <option key={option} value={option}>{option || 'Select method'}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Total Payments YTD ($)</Label>
            <Input type="number" value={insuranceData.remittance?.total_payments_ytd ?? ''} onChange={(e) => setRemittanceField('total_payments_ytd', e.target.value)} data-testid="patient-insurance-remittance-total-payments-ytd-input" />
          </div>
        </div>
      )}

      {renderSectionFrame(
        'secondary',
        'Secondary Insurance',
        <div className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Payer Name</Label>
              <Input value={insuranceData.secondary?.payer_name || ''} onChange={(e) => setSecondaryField('payer_name', e.target.value)} data-testid="patient-insurance-secondary-payer-name-input" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Plan Name</Label>
              <Input value={insuranceData.secondary?.plan_name || ''} onChange={(e) => setSecondaryField('plan_name', e.target.value)} data-testid="patient-insurance-secondary-plan-name-input" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Plan Type</Label>
              <Input value={insuranceData.secondary?.plan_type || ''} onChange={(e) => setSecondaryField('plan_type', e.target.value)} data-testid="patient-insurance-secondary-plan-type-input" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm" data-testid="patient-insurance-secondary-covers-coinsurance-wrap">
              <input type="checkbox" checked={!!insuranceData.secondary?.covers_coinsurance} onChange={(e) => setSecondaryField('covers_coinsurance', e.target.checked)} data-testid="patient-insurance-secondary-covers-coinsurance-checkbox" /> Covers Coinsurance
            </label>
            <label className="flex items-center gap-2 text-sm" data-testid="patient-insurance-secondary-covers-deductible-wrap">
              <input type="checkbox" checked={!!insuranceData.secondary?.covers_deductible} onChange={(e) => setSecondaryField('covers_deductible', e.target.checked)} data-testid="patient-insurance-secondary-covers-deductible-checkbox" /> Covers Deductible
            </label>
          </div>
        </div>
      )}

      {renderSectionFrame(
        'verification',
        'Verification',
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Last Verified</Label>
            <Input value={insuranceData.verification?.last_verified || ''} onChange={(e) => setVerificationField('last_verified', e.target.value)} data-testid="patient-insurance-verification-last-verified-input" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Verified By</Label>
            <Input value={insuranceData.verification?.verified_by || ''} onChange={(e) => setVerificationField('verified_by', e.target.value)} data-testid="patient-insurance-verification-verified-by-input" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Input value={insuranceData.verification?.source || ''} onChange={(e) => setVerificationField('source', e.target.value)} data-testid="patient-insurance-verification-source-input" />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={saveAllInsuranceData} disabled={saving} data-testid="patient-insurance-save-all-bottom-button">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save All Insurance Data
        </Button>
      </div>
    </div>
  );
};
