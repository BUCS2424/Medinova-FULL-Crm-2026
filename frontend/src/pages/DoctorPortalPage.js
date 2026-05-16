import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Shield, 
  FileText, 
  Upload, 
  CheckCircle, 
  Clock, 
  User, 
  Pill, 
  Building2,
  PenTool,
  AlertCircle,
  Loader2,
  FileCheck,
  ArrowLeft,
  Video
} from 'lucide-react';
import SignatureCapture from '../components/SignatureCapture';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DoctorPortalPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // States
  const [step, setStep] = useState('verify'); // verify, portal, signing, complete
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [portalToken, setPortalToken] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [cmnDocument, setCmnDocument] = useState(null);
  const [signaturePayload, setSignaturePayload] = useState(null);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [savedSignatures, setSavedSignatures] = useState([]);
  
  const magicToken = searchParams.get('token');
  const fhirLaunch = searchParams.get('fhir_launch');

  // Handle FHIR launch
  useEffect(() => {
    if (fhirLaunch) {
      toast.info('Launched from EHR system');
      // In production, would fetch FHIR context and auto-authenticate
    }
  }, [fhirLaunch]);

  // Verify magic link
  const handleVerify = async (e) => {
    e.preventDefault();
    if (!magicToken) {
      toast.error('Invalid access link');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/doctor-portal/verify`, {
        token: magicToken,
        verification_code: verificationCode
      });
      
      setPortalToken(response.data.portal_token);
      setDoctor(response.data.doctor);
      toast.success('Verification successful!');
      setStep('portal');
      
      // Fetch order data
      await fetchOrderData(response.data.portal_token);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Fetch order data
  const fetchOrderData = useCallback(async (token) => {
    try {
      const response = await axios.get(`${API_URL}/api/doctor-portal/pending-orders?token=${token}`);
      setOrderData(response.data);
    } catch (error) {
      toast.error('Failed to fetch order data');
    }
  }, []);

  // Fetch saved signatures
  const fetchSavedSignatures = useCallback(async (token) => {
    try {
      const response = await axios.get(`${API_URL}/api/doctor-portal/saved-signatures?token=${token}`);
      setSavedSignatures(response.data || []);
    } catch (error) {
      console.error('Failed to fetch saved signatures:', error);
    }
  }, []);

  // Generate CMN
  const handleGenerateCMN = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/doctor-portal/generate-cmn?order_id=${orderData.order.id}&token=${portalToken}`
      );
      setCmnDocument(response.data.cmn_document);
      
      // Fetch saved signatures when moving to signing step
      await fetchSavedSignatures(portalToken);
      
      toast.success('Certificate of Medical Necessity generated');
      setStep('signing');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate CMN');
    } finally {
      setLoading(false);
    }
  };

  // Sign document with captured signature
  const handleSign = async () => {
    if (!signaturePayload) {
      toast.error('Please provide your signature');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/doctor-portal/sign?token=${portalToken}`,
        {
          order_id: orderData.order.id,
          document_id: cmnDocument.id,
          signature_data: signaturePayload.signature_data,
          signature_type: signaturePayload.signature_type,
          signer_name: signaturePayload.signer_name
        }
      );
      
      toast.success('Document signed successfully!');
      setIsSignDialogOpen(false);
      setStep('complete');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signing failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle signature capture completion
  const handleSignatureComplete = async (payload) => {
    setSignaturePayload(payload);
    
    // If save_for_future is enabled, store the signature template
    if (payload.save_for_future && portalToken) {
      try {
        await axios.post(`${API_URL}/api/doctor-portal/save-signature?token=${portalToken}`, {
          signature_data: payload.signature_data,
          signature_type: payload.signature_type,
          signer_name: payload.signer_name,
          signature_name: payload.signature_name
        });
        toast.success('Signature saved for future use');
      } catch (error) {
        console.error('Failed to save signature template:', error);
      }
    }
    
    // Open confirmation dialog
    setIsSignDialogOpen(true);
  };

  // Upload Face-to-Face document
  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }
    
    setLoading(true);
    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });
      
      await axios.post(
        `${API_URL}/api/doctor-portal/upload-document?token=${portalToken}`,
        {
          order_id: orderData.order.id,
          patient_id: orderData.patient.id,
          file_name: uploadFile.name,
          file_data: base64,
          document_type: 'face_to_face'
        }
      );
      
      toast.success('Face-to-Face document uploaded');
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      
      // Refresh order data
      await fetchOrderData(portalToken);
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Verification Step
  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-navy-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="doctor-portal-verify">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Doctor Portal</CardTitle>
            <CardDescription>
              Enter the 6-digit verification code sent to your phone
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!magicToken ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <p className="text-muted-foreground">Invalid or missing access link</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please use the link sent to your phone/email
                </p>
              </div>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-2xl tracking-widest font-mono"
                    data-testid="verification-code-input"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || verificationCode.length !== 6}
                  data-testid="verify-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  HIPAA-compliant secure access with 2FA verification
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Portal Step - View Order & Generate CMN
  if (step === 'portal') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-navy-900 p-4 md:p-8" data-testid="doctor-portal-main">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">DME Prescription Portal</h1>
              <p className="text-muted-foreground">
                Welcome, Dr. {doctor?.last_name}
              </p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Shield className="w-3 h-3 mr-1" />
              Verified Session
            </Badge>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3">
            <Button
              onClick={() => setShowVideoMeeting(true)}
              className="bg-green-600 hover:bg-green-700"
              data-testid="doctor-video-call-btn"
            >
              <Video className="w-4 h-4 mr-2" />
              Start Video Consultation
            </Button>
          </div>

          {orderData && (
            <>
              {/* Patient Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Patient Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">
                        {orderData.patient?.first_name} {orderData.patient?.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">{orderData.patient?.date_of_birth}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">SSN (Last 4)</p>
                      <p className="font-medium font-mono">***-**-{orderData.patient?.ssn_last_four}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Primary Insurance</p>
                      <p className="font-medium">{orderData.patient?.primary_insurance}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pill className="w-5 h-5" />
                    DME Order Details
                  </CardTitle>
                  <CardDescription>
                    Order ID: {orderData.order?.id?.slice(0, 8)}...
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* HCPCS Items */}
                    <div>
                      <p className="text-sm font-medium mb-2">Equipment Ordered (HCPCS)</p>
                      <div className="space-y-2">
                        {orderData.order?.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-slate-100 dark:bg-navy-800 rounded-lg">
                            <div>
                              <span className="font-mono text-sm font-medium">{item.hcpcs_code}</span>
                              <span className="text-muted-foreground ml-2">{item.description}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground">Qty: {item.quantity}</span>
                              <span className="font-medium ml-4">${item.unit_price?.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Supplier Info */}
                    <div className="flex items-center gap-4">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Supplier</p>
                        <p className="font-medium">{orderData.supplier?.name || 'Not assigned'}</p>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center pt-4 border-t">
                      <span className="font-medium">Total Amount</span>
                      <span className="text-xl font-bold">${orderData.order?.total_amount?.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Existing Documents */}
              {orderData.documents?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Attached Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {orderData.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileCheck className="w-4 h-4 text-green-600" />
                            <span>{doc.file_name}</span>
                          </div>
                          <Badge variant={doc.signature_status === 'signed' ? 'default' : 'secondary'}>
                            {doc.signature_status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  className="flex-1" 
                  onClick={handleGenerateCMN}
                  disabled={loading}
                  data-testid="generate-cmn-btn"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  Generate & Sign CMN
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsUploadDialogOpen(true)}
                  data-testid="upload-f2f-btn"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Face-to-Face Notes
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Upload Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Face-to-Face Encounter Notes</DialogTitle>
              <DialogDescription>
                Upload documentation of your face-to-face encounter with the patient
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => document.getElementById('file-input').click()}
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileCheck className="w-6 h-6 text-green-600" />
                    <span>{uploadFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG up to 10MB</p>
                  </>
                )}
              </div>
              <input
                id="file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files[0])}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!uploadFile || loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Upload Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Video Meeting Modal */}
        {showVideoMeeting && (
          <ScheduleMeetingModal
            isOpen={showVideoMeeting}
            onClose={() => setShowVideoMeeting(false)}
            onSuccess={(meeting) => window.open(`/video-room/${meeting.id}`, '_blank')}
            prefill={{
              title: `Dr. ${doctor?.last_name} - Patient Consultation`,
              doctor_id: doctor?.id,
              patient_id: orderData?.patient?.id,
              emails: orderData?.patient?.email ? [orderData.patient.email] : [],
              phones: orderData?.patient?.phone ? [orderData.patient.phone] : [],
            }}
          />
        )}
      </div>
    );
  }

  // Signing Step
  if (step === 'signing') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-navy-900 p-4 md:p-8" data-testid="doctor-portal-signing">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back Button */}
          <Button variant="ghost" onClick={() => setStep('portal')} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Order Details
          </Button>

          {/* CMN Document Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Certificate of Medical Necessity
              </CardTitle>
              <CardDescription>
                Review the document below, then provide your signature
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* CMN Preview */}
              <div className="border rounded-lg p-6 bg-white dark:bg-slate-950">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">CERTIFICATE OF MEDICAL NECESSITY</h2>
                  <p className="text-sm text-muted-foreground">Durable Medical Equipment (DME)</p>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-semibold mb-2">Patient Information</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {cmnDocument?.cmn_data?.patient?.name}</p>
                      <p><span className="text-muted-foreground">DOB:</span> {cmnDocument?.cmn_data?.patient?.dob}</p>
                      <p><span className="text-muted-foreground">Insurance:</span> {cmnDocument?.cmn_data?.patient?.primary_insurance}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Prescriber Information</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {cmnDocument?.cmn_data?.prescriber?.name}</p>
                      <p><span className="text-muted-foreground">NPI:</span> {cmnDocument?.cmn_data?.prescriber?.npi}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Equipment Ordered</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">HCPCS</th>
                        <th className="text-left py-2">Description</th>
                        <th className="text-right py-2">Qty</th>
                        <th className="text-right py-2">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cmnDocument?.cmn_data?.equipment?.map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2 font-mono">{item.hcpcs_code}</td>
                          <td className="py-2">{item.description}</td>
                          <td className="py-2 text-right">{item.quantity}</td>
                          <td className="py-2 text-right">${item.unit_price?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    I certify that the medical equipment described above is medically necessary 
                    for this patient&apos;s condition. I am the treating physician and have examined 
                    the patient within the required timeframe.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signature Capture Section */}
          <div className="flex justify-center">
            <SignatureCapture
              onSignatureComplete={handleSignatureComplete}
              onCancel={() => setStep('portal')}
              signerName={doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : ''}
              signerRole="prescriber"
              documentName="Certificate of Medical Necessity"
              allowSave={true}
              savedSignatures={savedSignatures}
            />
          </div>
        </div>

        {/* Signature Confirmation Dialog */}
        <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Electronic Signature</DialogTitle>
              <DialogDescription>
                Please confirm that you want to sign this Certificate of Medical Necessity
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {/* Signature Preview */}
              <div className="p-4 bg-slate-100 dark:bg-navy-800 rounded-lg mb-4">
                <p className="text-sm text-muted-foreground mb-2">Your signature:</p>
                {signaturePayload?.signature_data && (
                  <div className="flex justify-center">
                    <img 
                      src={signaturePayload.signature_data} 
                      alt="Your signature" 
                      className="max-h-24 object-contain border rounded bg-white"
                    />
                  </div>
                )}
                <p className="text-xs text-center text-muted-foreground mt-2">
                  {signaturePayload?.signer_name}
                </p>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Identity verified via 2FA
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Timestamp will be recorded
                </p>
                <p className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  HIPAA-compliant audit trail
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSign} disabled={loading} data-testid="confirm-sign-btn">
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Confirm & Sign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Complete Step
  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-navy-900 flex items-center justify-center p-4" data-testid="doctor-portal-complete">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Prescription Signed!</h2>
            <p className="text-muted-foreground mb-6">
              The Certificate of Medical Necessity has been signed and the sales team has been notified.
            </p>
            <div className="space-y-2 text-sm text-left bg-slate-100 dark:bg-navy-800 rounded-lg p-4 mb-6">
              <p className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Document signed with legal e-signature
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Audit trail recorded for compliance
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Order status updated to &quot;Prescription Verified&quot;
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Sales team notification sent
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              You may now close this window. Thank you for using DME CRM.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
