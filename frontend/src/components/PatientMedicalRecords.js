import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const defaultMedicalRecords = {
  vitals: {
    height: '',
    weight: '',
    bmi: '',
    blood_pressure: '',
    heart_rate: '',
    temperature: '',
    last_recorded: '',
  },
  diagnoses: [],
  medications: [],
  allergies: [],
  dme_history: [],
  prior_authorizations: [],
  care_team: [],
  procedures: [],
};

const medicalSections = {
  diagnoses: {
    title: 'Diagnoses',
    template: { code: '', description: '', status: 'active', diagnosed_date: '', provider: '' },
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'managed', 'resolved'] },
      { key: 'diagnosed_date', label: 'Diagnosed Date', type: 'date' },
      { key: 'provider', label: 'Provider' },
    ],
  },
  medications: {
    title: 'Medications',
    template: { name: '', dosage: '', prescriber: '', start_date: '', status: 'active' },
    fields: [
      { key: 'name', label: 'Medication Name' },
      { key: 'dosage', label: 'Dosage' },
      { key: 'prescriber', label: 'Prescriber' },
      { key: 'start_date', label: 'Start Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'discontinued', 'as_needed'] },
    ],
  },
  allergies: {
    title: 'Allergies',
    template: { allergen: '', reaction: '', severity: 'mild' },
    fields: [
      { key: 'allergen', label: 'Allergen' },
      { key: 'reaction', label: 'Reaction' },
      { key: 'severity', label: 'Severity', type: 'select', options: ['mild', 'moderate', 'severe'] },
    ],
  },
  dme_history: {
    title: 'DME Equipment History',
    template: { item: '', delivered: '', status: 'active', replacement_eligible: '', supplier: '' },
    fields: [
      { key: 'item', label: 'Item' },
      { key: 'delivered', label: 'Delivered Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'returned', 'expired'] },
      { key: 'replacement_eligible', label: 'Replacement Eligible', type: 'date' },
      { key: 'supplier', label: 'Supplier' },
    ],
  },
  prior_authorizations: {
    title: 'Prior Authorizations',
    template: { auth_number: '', item: '', status: 'pending', submitted: '', expires: '', payer: '' },
    fields: [
      { key: 'auth_number', label: 'Auth Number' },
      { key: 'item', label: 'Item' },
      { key: 'status', label: 'Status', type: 'select', options: ['pending', 'approved', 'denied', 'expired'] },
      { key: 'submitted', label: 'Submitted', type: 'date' },
      { key: 'expires', label: 'Expires', type: 'date' },
      { key: 'payer', label: 'Payer' },
    ],
  },
  care_team: {
    title: 'Care Team',
    template: { name: '', role: '', npi: '', phone: '', last_visit: '' },
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'npi', label: 'NPI' },
      { key: 'phone', label: 'Phone' },
      { key: 'last_visit', label: 'Last Visit', type: 'date' },
    ],
  },
  procedures: {
    title: 'Procedures & Visits',
    template: { code: '', description: '', date: '', provider: '', status: 'completed' },
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'description', label: 'Description' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'provider', label: 'Provider' },
      { key: 'status', label: 'Status', type: 'select', options: ['completed', 'scheduled', 'cancelled'] },
    ],
  },
};

export const PatientMedicalRecords = ({ patientId, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [medicalData, setMedicalData] = useState(defaultMedicalRecords);
  const [openSections, setOpenSections] = useState({
    vitals: true,
    diagnoses: true,
    medications: true,
    allergies: true,
    dme_history: true,
    prior_authorizations: true,
    care_team: true,
    procedures: true,
  });

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchMedicalRecords = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/patients/${patientId}/medical`, { headers: getHeaders() });
      setMedicalData({ ...defaultMedicalRecords, ...(response.data || {}) });
    } catch (error) {
      toast.error('Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicalRecords();
  }, [patientId]);

  const updateVitals = (key, value) => {
    setMedicalData((prev) => ({ ...prev, vitals: { ...prev.vitals, [key]: value } }));
  };

  const addSectionRow = (sectionKey) => {
    const template = medicalSections[sectionKey].template;
    setMedicalData((prev) => ({ ...prev, [sectionKey]: [...(prev[sectionKey] || []), { ...template }] }));
  };

  const updateSectionRow = (sectionKey, rowIndex, fieldKey, value) => {
    setMedicalData((prev) => {
      const updatedRows = [...(prev[sectionKey] || [])];
      updatedRows[rowIndex] = { ...updatedRows[rowIndex], [fieldKey]: value };
      return { ...prev, [sectionKey]: updatedRows };
    });
  };

  const removeSectionRow = (sectionKey, rowIndex) => {
    setMedicalData((prev) => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] || []).filter((_, idx) => idx !== rowIndex),
    }));
  };

  const saveAllMedicalRecords = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/patients/${patientId}/medical`, medicalData, { headers: getHeaders() });
      toast.success('Medical records saved successfully');
      onSaved?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save medical records');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  if (loading) {
    return (
      <Card data-testid="patient-medical-records-loading-card">
        <CardContent className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading medical records...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="patient-medical-records-container">
      <div className="flex justify-end">
        <Button onClick={saveAllMedicalRecords} disabled={saving} data-testid="patient-medical-save-all-top-button">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save All
        </Button>
      </div>

      <Collapsible open={openSections.vitals} onOpenChange={() => toggleSection('vitals')}>
        <Card className="border-sky-100 bg-sky-50/40" data-testid="patient-medical-vitals-section">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Vitals</CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="patient-medical-vitals-toggle-button">
                  {openSections.vitals ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="grid md:grid-cols-7 gap-3">
              {[
                ['height', 'Height'],
                ['weight', 'Weight'],
                ['bmi', 'BMI'],
                ['blood_pressure', 'BP'],
                ['heart_rate', 'Heart Rate'],
                ['temperature', 'Temp'],
                ['last_recorded', 'Date', 'date'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type={type || 'text'}
                    value={medicalData.vitals?.[key] || ''}
                    onChange={(e) => updateVitals(key, e.target.value)}
                    data-testid={`patient-medical-vitals-${key}-input`}
                  />
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {Object.entries(medicalSections).map(([sectionKey, sectionConfig]) => {
        const rows = medicalData[sectionKey] || [];
        const isOpen = !!openSections[sectionKey];

        return (
          <Collapsible key={sectionKey} open={isOpen} onOpenChange={() => toggleSection(sectionKey)}>
            <Card data-testid={`patient-medical-${sectionKey}-section`}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{sectionConfig.title}</CardTitle>
                    <Badge variant="secondary" data-testid={`patient-medical-${sectionKey}-count-badge`}>{rows.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addSectionRow(sectionKey)}
                      data-testid={`patient-medical-${sectionKey}-add-button`}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`patient-medical-${sectionKey}-toggle-button`}>
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-3">
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid={`patient-medical-${sectionKey}-empty-text`}>
                      No data — click Add.
                    </p>
                  ) : (
                    rows.map((row, rowIndex) => (
                      <div key={`${sectionKey}-${rowIndex}`} className="p-3 border rounded-lg space-y-3" data-testid={`patient-medical-${sectionKey}-row-${rowIndex}`}>
                        <div className="grid md:grid-cols-3 gap-3">
                          {sectionConfig.fields.map((field) => (
                            <div key={field.key}>
                              <Label className="text-xs text-muted-foreground">{field.label}</Label>
                              {field.type === 'select' ? (
                                <select
                                  className="w-full border rounded-md h-10 px-3 bg-background"
                                  value={row[field.key] || ''}
                                  onChange={(e) => updateSectionRow(sectionKey, rowIndex, field.key, e.target.value)}
                                  data-testid={`patient-medical-${sectionKey}-${rowIndex}-${field.key}-select`}
                                >
                                  {field.options.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  type={field.type === 'date' ? 'date' : 'text'}
                                  value={row[field.key] || ''}
                                  onChange={(e) => updateSectionRow(sectionKey, rowIndex, field.key, e.target.value)}
                                  data-testid={`patient-medical-${sectionKey}-${rowIndex}-${field.key}-input`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSectionRow(sectionKey, rowIndex)}
                            data-testid={`patient-medical-${sectionKey}-${rowIndex}-delete-button`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      <div className="flex justify-end">
        <Button onClick={saveAllMedicalRecords} disabled={saving} data-testid="patient-medical-save-all-bottom-button">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save All Medical Records
        </Button>
      </div>
    </div>
  );
};
