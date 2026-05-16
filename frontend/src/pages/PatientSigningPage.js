import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Pen,
  RotateCcw,
  Download,
  AlertTriangle,
  Shield,
  Clock,
  FileCheck
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PatientSigningPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [document, setDocument] = useState(null);
  const [error, setError] = useState(null);
  const [signed, setSigned] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  
  // Signature
  const [signedByName, setSignedByName] = useState('');
  const [signatureData, setSignatureData] = useState(null);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDocument();
    }
  }, [token]);

  const fetchDocument = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/patient-documents/sign-by-email/${token}`);
      setDocument(res.data);
    } catch (err) {
      const message = err.response?.data?.detail || 'Unable to load document';
      setError(message);
      if (message === 'Document already signed') {
        setSigned(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Canvas signature handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      setSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleSign = async () => {
    if (!signedByName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!signatureData) {
      toast.error('Please provide your signature');
      return;
    }

    setSigning(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/patient-documents/sign-by-email/${token}`,
        null,
        {
          params: {
            signature_data: signatureData,
            signed_by_name: signedByName
          }
        }
      );
      
      setSigned(true);
      setPdfUrl(res.data.pdf_url);
      toast.success('Document signed successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to sign document');
    } finally {
      setSigning(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading document...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && !signed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Document</h2>
            <p className="text-muted-foreground text-center mb-6">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already signed state
  if (signed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Signed!</h2>
            <p className="text-muted-foreground text-center mb-6">
              Thank you for signing. A copy has been saved to your patient records.
            </p>
            {pdfUrl && (
              <Button onClick={() => window.open(pdfUrl, '_blank')}>
                <Download className="w-4 h-4 mr-2" /> Download PDF Copy
              </Button>
            )}
            <p className="text-xs text-muted-foreground mt-6">
              You may close this window.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signing view
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm mb-4">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-600">Secure Document Signing</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Document Signature Required</h1>
          <p className="text-muted-foreground mt-2">
            Hello {document?.patient_name}, please review and sign the document below.
          </p>
        </div>

        {/* Document Card */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{document?.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4" />
                    Please review carefully before signing
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="bg-lime-50 text-lime-700 border-lime-200">
                Awaiting Signature
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Document Content */}
            <div className="prose prose-sm max-w-none bg-white border rounded-lg p-6 max-h-[400px] overflow-y-auto mb-6">
              <div dangerouslySetInnerHTML={{ __html: document?.filled_content || '' }} />
            </div>

            {/* Important Notice */}
            <div className="bg-lime-50 border border-lime-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-lime-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Important</h4>
                  <p className="text-sm text-lime-700">
                    By signing below, you acknowledge that you have read and understand this document.
                    Your electronic signature is legally binding.
                  </p>
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Pen className="w-5 h-5" />
                Your Signature
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signedByName">Full Legal Name *</Label>
                    <Input
                      id="signedByName"
                      value={signedByName}
                      onChange={(e) => setSignedByName(e.target.value)}
                      placeholder="Enter your full name"
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <p>Date: {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Draw Your Signature *</Label>
                    <Button variant="ghost" size="sm" onClick={clearSignature}>
                      <RotateCcw className="w-4 h-4 mr-1" /> Clear
                    </Button>
                  </div>
                  <div className="border-2 border-dashed rounded-lg bg-white">
                    <canvas
                      ref={canvasRef}
                      width={350}
                      height={120}
                      className="w-full cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use your mouse or finger to sign above
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end mt-6">
                <Button 
                  size="lg" 
                  onClick={handleSign} 
                  disabled={signing || !signedByName || !signatureData}
                  className="px-8"
                >
                  {signing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-5 h-5 mr-2" />
                      Sign Document
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>This document is transmitted securely and your signature is legally binding.</p>
          <p className="mt-1">If you have questions, please contact your healthcare provider.</p>
        </div>
      </div>
    </div>
  );
}
