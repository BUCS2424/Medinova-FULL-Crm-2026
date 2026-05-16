import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { toast } from 'sonner';
import {
  Building2,
  User,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Package,
  FileText,
  Plus,
  Trash2,
  Loader2,
  Stethoscope,
  Truck,
  ClipboardList,
  PenTool,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Common ICD-10 codes for DME
const COMMON_DIAGNOSES = [
  { code: 'M17.11', description: 'Unilateral primary osteoarthritis, right knee' },
  { code: 'M17.12', description: 'Unilateral primary osteoarthritis, left knee' },
  { code: 'M17.0', description: 'Bilateral primary osteoarthritis of knee' },
  { code: 'G47.33', description: 'Obstructive sleep apnea' },
  { code: 'J44.1', description: 'Chronic obstructive pulmonary disease with acute exacerbation' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'R26.2', description: 'Difficulty in walking' },
  { code: 'Z99.81', description: 'Dependence on supplemental oxygen' },
];

// Common HCPCS codes for DME supplies - fallback only if API fails
const FALLBACK_SUPPLIES = [
  { code: 'E0143', description: 'Front Wheel Walker', price: 85.00 },
  { code: 'E0601', description: 'CPAP Device', price: 800.00 },
  { code: 'K0001', description: 'Standard Wheelchair', price: 350.00 },
];

// Handwriting font styles for AI signature - realistic handwriting
const HANDWRITING_FONTS = [
  { name: 'Natural', font: 'Homemade Apple', style: 'cursive' },
  { name: 'Quick', font: 'Nothing You Could Do', style: 'cursive' },
  { name: 'Fluid', font: 'Kristi', style: 'cursive' },
  { name: 'Signature', font: 'Mr De Haviland', style: 'cursive' },
  { name: 'Scribble', font: 'Rock Salt', style: 'cursive' },
  { name: 'Doctor', font: 'Marck Script', style: 'cursive' },
];

export default function DMEOrderForm({ 
  isOpen, 
  onClose, 
  onSuccess,
  onCancel,
  patient = null,
  patientId = null,
  prescriber = null,
  editingOrder = null,
  embedded = false
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const signatureRef = useRef(null);
  const typedSignatureRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [signatureMode, setSignatureMode] = useState('draw'); // 'draw' or 'type'
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState(HANDWRITING_FONTS[0]);

  // Catalog products from database and supplier picker
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [supplierPickerData, setSupplierPickerData] = useState({ index: null, product: null, suppliers: [] });

  const [formData, setFormData] = useState({
    diagnoses: [],
    items: [{ hcpcs_code: '', description: '', quantity: 1, unit_price: 0, sig: 'Use as directed.', supplier_id: '', supplier_name: '' }],
    refills_allowed: 0,
    daw: false,
    note_to_supplier: '',
    notes: '',
    send_for_verification: true
  });

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  // Load Google Fonts for handwriting signatures
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Homemade+Apple&family=Nothing+You+Could+Do&family=Kristi&family=Mr+De+Haviland&family=Rock+Salt&family=Marck+Script&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // Generate typed signature on canvas when name or font changes
  useEffect(() => {
    if (signatureMode === 'type' && typedName && typedSignatureRef.current) {
      const canvas = typedSignatureRef.current;
      const ctx = canvas.getContext('2d');
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set handwriting font
      ctx.font = `48px "${selectedFont.font}", ${selectedFont.style}`;
      ctx.fillStyle = '#1e40af';
      ctx.textBaseline = 'middle';
      
      // Add slight rotation for natural look
      ctx.save();
      ctx.translate(30, canvas.height / 2);
      ctx.rotate(-0.02); // Slight tilt
      ctx.fillText(typedName, 0, 0);
      ctx.restore();
      
      // Capture the signature
      setSignatureData(canvas.toDataURL());
    }
  }, [typedName, selectedFont, signatureMode]);

  useEffect(() => {
    if (isOpen || embedded) {
      fetchData();
      if (patient) {
        setSelectedPatient(patient);
      }
    }
  }, [isOpen, patient, embedded]);

  const fetchData = async () => {
    try {
      const [patientsRes, doctorsRes, suppliersRes, catalogRes] = await Promise.all([
        axios.get(`${API_URL}/api/patients`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/doctors`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/suppliers`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/suppliers/products-for-orders`, { headers: getHeaders() }).catch(() => ({ data: [] }))
      ]);
      setPatients(patientsRes.data || []);
      setDoctors(doctorsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setCatalogProducts(catalogRes.data || []);
      
      // If patient prop is provided, pre-select it
      if (patient) {
        setSelectedPatient(patient);
      } else if (patientId) {
        const foundPatient = (patientsRes.data || []).find(p => p.id === patientId);
        if (foundPatient) {
          setSelectedPatient(foundPatient);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { hcpcs_code: '', description: '', quantity: 1, unit_price: 0, sig: 'Use as directed.', supplier_id: '', supplier_name: '' }]
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems.length > 0 ? newItems : [{ hcpcs_code: '', description: '', quantity: 1, unit_price: 0, sig: 'Use as directed.', supplier_id: '', supplier_name: '' }] });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-fill description when HCPCS code is selected from catalog
    if (field === 'hcpcs_code') {
      // Find the product in catalog that has this HCPCS code
      const product = catalogProducts.find(p => p.hcpcs_codes?.includes(value));
      if (product) {
        newItems[index].description = product.name;
        newItems[index].supplier_id = '';
        newItems[index].supplier_name = '';
        
        // Check suppliers for this product
        if (product.suppliers?.length === 1) {
          // Auto-assign single supplier
          newItems[index].supplier_id = product.suppliers[0].id;
          newItems[index].supplier_name = product.suppliers[0].name;
        } else if (product.suppliers?.length > 1) {
          // Multiple suppliers — open picker modal
          setFormData({ ...formData, items: newItems });
          setSupplierPickerData({ index, product, suppliers: product.suppliers });
          setSupplierPickerOpen(true);
          return;
        }
      } else {
        // Fallback for codes not in catalog
        const fallback = FALLBACK_SUPPLIES.find(s => s.code === value);
        if (fallback) {
          newItems[index].description = fallback.description;
          newItems[index].unit_price = fallback.price;
        }
      }
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleSupplierSelected = (supplier) => {
    const { index } = supplierPickerData;
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], supplier_id: supplier.id, supplier_name: supplier.name };
    setFormData({ ...formData, items: newItems });
    setSupplierPickerOpen(false);
  };

  const handleAddDiagnosis = (diagnosis) => {
    if (!formData.diagnoses.find(d => d.code === diagnosis.code)) {
      setFormData({
        ...formData,
        diagnoses: [...formData.diagnoses, diagnosis]
      });
    }
  };

  const handleRemoveDiagnosis = (code) => {
    setFormData({
      ...formData,
      diagnoses: formData.diagnoses.filter(d => d.code !== code)
    });
  };

  // Signature canvas handlers - fixed coordinate mapping
  const getCanvasCoordinates = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    // Calculate the scaling factor between displayed size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(e, canvas);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(e, canvas);
    const ctx = canvas.getContext('2d');
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  // Touch support for mobile devices
  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const canvas = signatureRef.current;
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(touch, canvas);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const touch = e.touches[0];
    const canvas = signatureRef.current;
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(touch, canvas);
    const ctx = canvas.getContext('2d');
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && signatureRef.current) {
      setSignatureData(signatureRef.current.toDataURL());
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (signatureMode === 'draw') {
      const canvas = signatureRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      setTypedName('');
      const canvas = typedSignatureRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setSignatureData('');
  };

  const handleSignatureModeChange = (mode) => {
    setSignatureMode(mode);
    setSignatureData('');
    setTypedName('');
    // Clear both canvases
    if (signatureRef.current) {
      const ctx = signatureRef.current.getContext('2d');
      ctx.clearRect(0, 0, signatureRef.current.width, signatureRef.current.height);
    }
    if (typedSignatureRef.current) {
      const ctx = typedSignatureRef.current.getContext('2d');
      ctx.clearRect(0, 0, typedSignatureRef.current.width, typedSignatureRef.current.height);
    }
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const calculateAge = (dob) => {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age}yo`;
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!selectedDoctor) {
      toast.error('Please select a prescriber');
      return;
    }
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    if (formData.items.length === 0 || !formData.items[0].hcpcs_code) {
      toast.error('Please add at least one supply item');
      return;
    }

    setSubmitting(true);
    try {
      // Build comprehensive order data
      const orderData = {
        patient_id: selectedPatient.id,
        prescriber_id: selectedDoctor.id,
        supplier_id: selectedSupplier.id,
        equipment_type: formData.items[0]?.description || 'DME Equipment',
        items: formData.items.map(item => ({
          hcpcs_code: item.hcpcs_code,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          sig: item.sig,
          supplier_id: item.supplier_id || '',
          supplier_name: item.supplier_name || ''
        })),
        diagnoses: formData.diagnoses,
        refills_allowed: formData.refills_allowed,
        daw: formData.daw,
        note_to_supplier: formData.note_to_supplier,
        notes: formData.notes,
        // Workflow status - send to doctor for prescription verification
        status: 'awaiting_prescription',
        prescription_status: formData.send_for_verification ? 'pending' : 'not_sent',
        signature_data: signatureData || null
      };

      const response = await axios.post(`${API_URL}/api/orders`, orderData, { headers: getHeaders() });
      
      // If send for verification is enabled, trigger the prescription request
      if (formData.send_for_verification && selectedDoctor?.email) {
        try {
          await axios.post(`${API_URL}/api/orders/${response.data.id}/send-prescription-request`, {
            doctor_id: selectedDoctor.id
          }, { headers: getHeaders() });
          toast.success('Order created and prescription request sent to doctor!');
        } catch (err) {
          toast.success('Order created! Prescription request will be sent manually.');
          console.error('Failed to send prescription request:', err);
        }
      } else {
        toast.success('DME Order created successfully');
      }
      
      onSuccess?.(response.data);
      if (onCancel) {
        onCancel();
      } else if (onClose) {
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle close/cancel
  const handleClose = () => {
    if (onCancel) {
      onCancel();
    } else if (onClose) {
      onClose();
    }
  };

  // Render form content (can be in dialog or embedded)
  const renderFormContent = () => (
    <>
      {/* Form Header - Mimics the paper form */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Durable Medical Equipment Order</h2>
            <p className="text-slate-300 text-sm mt-1">Complete all required fields before submission</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-300">Order Date</p>
            <p className="font-semibold">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Prescriber / Supplier Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Prescriber Section */}
          <Card className="border-2">
            <CardHeader className="py-3 px-4 bg-slate-50 dark:bg-slate-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />
                Prescriber (Doctor)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Select
                value={selectedDoctor?.id || ''}
                onValueChange={(val) => setSelectedDoctor(doctors.find(d => d.id === val))}
              >
                  <SelectTrigger data-testid="prescriber-select">
                    <SelectValue placeholder="Select prescriber..." />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map(doc => (
                      <SelectItem key={doc.id} value={doc.id}>
                        Dr. {doc.first_name} {doc.last_name} - {doc.specialty || 'General'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDoctor && (
                  <div className="mt-3 text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">{selectedDoctor.practice_name || 'Medical Practice'}</p>
                    <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedDoctor.address || 'Address not provided'}</p>
                    <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedDoctor.phone || 'Phone not provided'}</p>
                    <p>NPI: {selectedDoctor.npi || 'N/A'}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supplier Section */}
            <Card className="border-2">
              <CardHeader className="py-3 px-4 bg-slate-50 dark:bg-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Supplier
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Select
                  value={selectedSupplier?.id || ''}
                  onValueChange={(val) => setSelectedSupplier(suppliers.find(s => s.id === val))}
                >
                  <SelectTrigger data-testid="supplier-select">
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(sup => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSupplier && (
                  <div className="mt-3 text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">{selectedSupplier.name}</p>
                    <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedSupplier.address || 'Address not provided'}</p>
                    <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedSupplier.contact_phone || 'Phone not provided'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Patient Information Section */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="py-3 px-4 bg-blue-50 dark:bg-blue-900/30">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <User className="w-4 h-4" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Patient Name</Label>
                  <Select
                    value={selectedPatient?.id || ''}
                    onValueChange={(val) => setSelectedPatient(patients.find(p => p.id === val))}
                  >
                    <SelectTrigger data-testid="patient-select">
                      <SelectValue placeholder="Select patient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(pat => (
                        <SelectItem key={pat.id} value={pat.id}>
                          {pat.last_name}, {pat.first_name} (DOB: {formatDate(pat.date_of_birth)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPatient && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Sex - DOB - Age</Label>
                        <p className="font-medium">
                          {selectedPatient.sex || 'N/A'} &nbsp;|&nbsp; 
                          {formatDate(selectedPatient.date_of_birth)} &nbsp;|&nbsp; 
                          {calculateAge(selectedPatient.date_of_birth)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Address</Label>
                        <p className="font-medium flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-1 flex-shrink-0" />
                          {selectedPatient.address || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Phone</Label>
                        <p className="font-medium flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          H: {selectedPatient.phone || 'N/A'} 
                          {selectedPatient.mobile && ` | M: ${selectedPatient.mobile}`}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Primary Insurance</Label>
                        <div className="font-medium">
                          <p className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-green-600" />
                            {selectedPatient.primary_insurance || 'Not provided'}
                          </p>
                          {selectedPatient.insurance_id && (
                            <p className="text-xs text-muted-foreground ml-4">ID: {selectedPatient.insurance_id}</p>
                          )}
                          {selectedPatient.insurance_group && (
                            <p className="text-xs text-muted-foreground ml-4">Group: {selectedPatient.insurance_group}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Secondary Insurance</Label>
                        <p className="font-medium">
                          {selectedPatient.secondary_insurance || 'None recorded'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* DME Order Information Section */}
          <Card className="border-2 border-emerald-200 dark:border-emerald-800">
            <CardHeader className="py-3 px-4 bg-emerald-50 dark:bg-emerald-900/30">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <ClipboardList className="w-4 h-4" />
                DME Order Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Applicable Diagnoses */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Applicable Diagnoses (ICD-10)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.diagnoses.map(diag => (
                    <Badge key={diag.code} variant="secondary" className="py-1 px-2">
                      {diag.code}: {diag.description}
                      <button 
                        onClick={() => handleRemoveDiagnosis(diag.code)}
                        className="ml-2 text-destructive hover:text-destructive/80"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(val) => {
                  const diag = COMMON_DIAGNOSES.find(d => d.code === val);
                  if (diag) handleAddDiagnosis(diag);
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add diagnosis..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_DIAGNOSES.map(diag => (
                      <SelectItem key={diag.code} value={diag.code}>
                        {diag.code}: {diag.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Supply Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-muted-foreground">Supply Items (HCPCS)</Label>
                  <Button variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="w-3 h-3 mr-1" /> Add Item
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-800 space-y-3">
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                          <Label className="text-xs">Supply (HCPCS Code)</Label>
                          <Select
                            value={item.hcpcs_code}
                            onValueChange={(val) => handleItemChange(index, 'hcpcs_code', val)}
                          >
                            <SelectTrigger data-testid={`supply-select-${index}`}>
                              <SelectValue placeholder="Select supply..." />
                            </SelectTrigger>
                            <SelectContent>
                              {catalogProducts.length > 0 ? (
                                // Group by category
                                [...new Set(catalogProducts.map(p => p.category))].map(cat => (
                                  <div key={cat}>
                                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">{cat}</div>
                                    {catalogProducts.filter(p => p.category === cat).flatMap(p =>
                                      (p.hcpcs_codes || []).map(code => (
                                        <SelectItem key={`${p.id}-${code}`} value={code}>
                                          {code}: {p.name}
                                        </SelectItem>
                                      ))
                                    )}
                                  </div>
                                ))
                              ) : (
                                FALLBACK_SUPPLIES.map(supply => (
                                  <SelectItem key={supply.code} value={supply.code}>
                                    {supply.code}: {supply.description}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            placeholder="Description"
                          />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="pl-6"
                          />
                        </div>
                        <div className="col-span-2 flex items-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleRemoveItem(index)}
                            disabled={formData.items.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-xs">SIG (Instructions)</Label>
                          <Input
                            value={item.sig}
                            onChange={(e) => handleItemChange(index, 'sig', e.target.value)}
                            placeholder="Use as directed."
                          />
                        </div>
                        {item.supplier_name && (
                          <div className="flex-shrink-0 pt-4">
                            <Badge variant="outline" className="text-xs gap-1">
                              <Truck className="w-3 h-3" /> {item.supplier_name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refills and DAW */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">Refills Allowed</Label>
                  <Input
                    type="number"
                    min="0"
                    max="12"
                    value={formData.refills_allowed}
                    onChange={(e) => setFormData({ ...formData, refills_allowed: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">DAW? (Dispense As Written)</Label>
                  <Select
                    value={formData.daw ? 'yes' : 'no'}
                    onValueChange={(val) => setFormData({ ...formData, daw: val === 'yes' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Order Total</Label>
                  <div className="h-10 flex items-center px-3 bg-slate-100 dark:bg-slate-700 rounded-md font-bold text-lg">
                    ${calculateTotal().toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Note to Supplier */}
              <div>
                <Label className="text-xs">Note to Supplier</Label>
                <Textarea
                  rows={4}
                  value={formData.note_to_supplier}
                  onChange={(e) => setFormData({ ...formData, note_to_supplier: e.target.value })}
                  placeholder="Patient evaluation notes, medical necessity justification, special instructions..."
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Signature Section */}
          <Card className="border-2 border-amber-200 dark:border-amber-800">
            <CardHeader className="py-3 px-4 bg-amber-50 dark:bg-amber-900/30">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <PenTool className="w-4 h-4" />
                Electronic Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Signature Mode Toggle */}
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                  <Button
                    type="button"
                    variant={signatureMode === 'draw' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleSignatureModeChange('draw')}
                    className="text-xs"
                  >
                    <PenTool className="w-3 h-3 mr-1" />
                    Draw Signature
                  </Button>
                  <Button
                    type="button"
                    variant={signatureMode === 'type' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleSignatureModeChange('type')}
                    className="text-xs"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Type & Generate
                  </Button>
                </div>

                {/* Draw Mode */}
                {signatureMode === 'draw' && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Draw your signature below using mouse or touch:</p>
                    <div className="border-2 border-dashed rounded-lg p-2 bg-white dark:bg-slate-950">
                      <canvas
                        ref={signatureRef}
                        width={600}
                        height={150}
                        className="w-full cursor-crosshair touch-none"
                        style={{ height: '150px' }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={stopDrawing}
                      />
                    </div>
                  </div>
                )}

                {/* Type Mode - AI Handwriting */}
                {signatureMode === 'type' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Type your name and select a handwriting style:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Full Name</Label>
                        <Input
                          value={typedName}
                          onChange={(e) => setTypedName(e.target.value)}
                          placeholder="Enter your full name..."
                          className="text-base"
                          data-testid="typed-signature-input"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Handwriting Style</Label>
                        <Select
                          value={selectedFont.name}
                          onValueChange={(val) => setSelectedFont(HANDWRITING_FONTS.find(f => f.name === val) || HANDWRITING_FONTS[0])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HANDWRITING_FONTS.map(font => (
                              <SelectItem key={font.name} value={font.name}>
                                <span style={{ fontFamily: `"${font.font}", ${font.style}` }}>
                                  {font.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Preview Canvas */}
                    <div className="border-2 border-dashed rounded-lg p-2 bg-white dark:bg-slate-950">
                      <canvas
                        ref={typedSignatureRef}
                        width={600}
                        height={150}
                        className="w-full"
                        style={{ height: '150px' }}
                      />
                      {!typedName && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-muted-foreground text-sm">Type your name to preview signature</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Font Preview */}
                    {typedName && (
                      <div className="text-center py-2 px-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                        <p 
                          className="text-3xl text-blue-800 dark:text-blue-400"
                          style={{ fontFamily: `"${selectedFont.font}", ${selectedFont.style}` }}
                        >
                          {typedName}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={clearSignature}>
                    Clear Signature
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {signatureData ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Signature captured
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {signatureMode === 'draw' ? 'Draw above' : 'Type name'} to complete
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Electronically ordered/documented by: {selectedDoctor ? `Dr. ${selectedDoctor.first_name} ${selectedDoctor.last_name}` : '[Select Prescriber]'}
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Prescription is void if more than one (1) prescription is written per blank.
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Prescription Verification Workflow */}
          <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="send_verification"
                  checked={formData.send_for_verification}
                  onChange={(e) => setFormData({ ...formData, send_for_verification: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                />
                <div>
                  <Label htmlFor="send_verification" className="font-medium cursor-pointer">
                    Send for Doctor Prescription Verification
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    When enabled, the prescribing doctor will receive a notification to verify and sign the prescription. 
                    Once verified, the order will be ready for processing.
                  </p>
                  {selectedDoctor && (
                    <p className="text-sm text-blue-600 mt-2">
                      Prescription request will be sent to: Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}
                      {selectedDoctor.email && ` (${selectedDoctor.email})`}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="submit-order-btn">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Order...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                {formData.send_for_verification ? 'Create & Send for Verification' : 'Create DME Order'}
              </>
            )}
          </Button>
        </div>
      </>
    );

  // If embedded, render content directly without dialog wrapper
  if (embedded) {
    return renderFormContent();
  }

  // Otherwise render in a dialog
  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {renderFormContent()}
        </DialogContent>
      </Dialog>

      {/* Supplier Picker Modal */}
      <Dialog open={supplierPickerOpen} onOpenChange={setSupplierPickerOpen}>
        <DialogContent className="max-w-md" data-testid="supplier-picker-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Choose Supplier
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Multiple suppliers carry <strong>{supplierPickerData.product?.name}</strong>. Select which supplier to use for this item:
          </p>
          <div className="space-y-2">
            {supplierPickerData.suppliers.map(sup => (
              <Button
                key={sup.id}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleSupplierSelected(sup)}
                data-testid={`supplier-pick-${sup.id}`}
              >
                <Building2 className="w-5 h-5 text-primary" />
                <span className="font-medium">{sup.name}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
