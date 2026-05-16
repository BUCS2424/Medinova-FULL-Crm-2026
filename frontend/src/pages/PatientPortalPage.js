import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Pen,
  RotateCcw,
  User,
  Shield,
  FileCheck,
  Calendar,
  ChevronRight,
  Eye,
  X,
  LogOut,
  Home
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PatientPortalPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState({ pending: [], signed: [], assignments: [] });
  const [user, setUser] = useState(null);
  
  // Signing modal
  const [signingDoc, setSigningDoc] = useState(null);
  const [signedByName, setSignedByName] = useState('');
  const [signatureData, setSignatureData] = useState(null);
  const [signing, setSigning] = useState(false);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // View modal
  const [viewingDoc, setViewingDoc] = useState(null);

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('dme_token')}`
  });

  useEffect(() => {
    const token = localStorage.getItem('dme_token');
    const userData = localStorage.getItem('dme_user');
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    if (userData) {
      setUser(JSON.parse(userData));
    }
    
    fetchDocuments();
  }, [navigate]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/patient-documents/my-documents`, { 
        headers: getHeaders() 
      });
      setDocuments(res.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Canvas signature handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    if (!canvas) return;
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
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false);
      setSignatureData(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const openSigningModal = (doc) => {
    setSigningDoc(doc);
    setSignedByName(user?.first_name ? `${user.first_name} ${user.last_name}` : '');
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
      await axios.post(
        `${API_URL}/api/patient-documents/sign`,
        {
          assignment_id: signingDoc.id,
          signature_data: signatureData,
          signed_by_name: signedByName
        },
        { headers: getHeaders() }
      );
      
      toast.success('Document signed successfully!');
      setSigningDoc(null);
      fetchDocuments();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to sign document');
    } finally {
      setSigning(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dme_token');
    localStorage.removeItem('dme_user');
    navigate('/login');
  };

  const progressPercentage = documents.assignments?.length > 0 
    ? Math.round((documents.signed_count / documents.assignments.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">
                  Welcome, {user?.first_name || 'Patient'}
                </h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <Home className="w-4 h-4 mr-2" /> Home
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Progress Card */}
        <Card className="mb-8 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Your Documents</h2>
                <p className="text-muted-foreground">
                  {documents.pending_count > 0 
                    ? `You have ${documents.pending_count} document${documents.pending_count > 1 ? 's' : ''} awaiting your signature`
                    : 'All documents are signed!'
                  }
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">
                  {documents.signed_count}/{documents.assignments?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
            <Progress value={progressPercentage} className="h-3" />
          </CardContent>
        </Card>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Pending ({documents.pending_count || 0})
            </TabsTrigger>
            <TabsTrigger value="signed" className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Signed ({documents.signed_count || 0})
            </TabsTrigger>
          </TabsList>

          {/* Pending Documents */}
          <TabsContent value="pending">
            {documents.pending?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                  <p className="text-muted-foreground">You have no documents awaiting signature.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {documents.pending?.map(doc => (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-lime-100 rounded-lg">
                          <FileText className="w-6 h-6 text-lime-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{doc.template_title}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Assigned: {new Date(doc.created_at).toLocaleDateString()}
                            </span>
                            <Badge variant="outline" className="bg-lime-50 text-lime-700 border-lime-200">
                              {doc.status === 'viewed' ? 'Viewed' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setViewingDoc(doc)}>
                            <Eye className="w-4 h-4 mr-2" /> Review
                          </Button>
                          <Button size="sm" onClick={() => openSigningModal(doc)}>
                            <Pen className="w-4 h-4 mr-2" /> Sign Now
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Signed Documents */}
          <TabsContent value="signed">
            {documents.signed?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Signed Documents Yet</h3>
                  <p className="text-muted-foreground">Documents you sign will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {documents.signed?.map(doc => (
                  <Card key={doc.id} className="bg-green-50/50 border-green-100">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                          <FileCheck className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{doc.template_title}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              Signed: {new Date(doc.signed_at).toLocaleDateString()}
                            </span>
                            <span>by {doc.signed_by_name}</span>
                            <Badge className="bg-green-600 text-white">Completed</Badge>
                          </div>
                        </div>
                        {doc.pdf_url && (
                          <Button variant="outline" size="sm" onClick={() => window.open(doc.pdf_url, '_blank')}>
                            <Download className="w-4 h-4 mr-2" /> Download PDF
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Security Notice */}
        <Card className="mt-8 bg-slate-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-green-600" />
              <p className="text-sm text-muted-foreground">
                Your documents are encrypted and stored securely in compliance with HIPAA regulations.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* View Document Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{viewingDoc.template_title}</CardTitle>
                  <CardDescription>Review this document before signing</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setViewingDoc(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: viewingDoc.filled_content }}
              />
            </CardContent>
            <CardFooter className="border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewingDoc(null)}>
                Close
              </Button>
              <Button onClick={() => { setViewingDoc(null); openSigningModal(viewingDoc); }}>
                <Pen className="w-4 h-4 mr-2" /> Sign This Document
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Signing Modal */}
      {signingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sign: {signingDoc.template_title}</CardTitle>
                  <CardDescription>Please provide your signature below</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSigningDoc(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Document Preview */}
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: signingDoc.filled_content }}
                />
              </div>

              {/* Acknowledgment */}
              <div className="bg-lime-50 border border-lime-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-lime-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    By signing, I acknowledge that I have read and understand this document. 
                    My electronic signature is legally binding.
                  </p>
                </div>
              </div>

              {/* Signature Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signName">Full Legal Name *</Label>
                  <Input
                    id="signName"
                    value={signedByName}
                    onChange={(e) => setSignedByName(e.target.value)}
                    placeholder="Enter your full legal name"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Your Signature *</Label>
                    <Button variant="ghost" size="sm" onClick={clearSignature}>
                      <RotateCcw className="w-4 h-4 mr-1" /> Clear
                    </Button>
                  </div>
                  <div className="border-2 border-dashed rounded-lg bg-white">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={150}
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
                    Draw your signature using your mouse or finger
                  </p>
                </div>

                <div className="text-sm text-muted-foreground">
                  Date: {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSigningDoc(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSign} 
                disabled={signing || !signedByName || !signatureData}
              >
                {signing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing...</>
                ) : (
                  <><FileCheck className="w-4 h-4 mr-2" /> Sign Document</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
