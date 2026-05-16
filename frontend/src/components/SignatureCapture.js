import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import {
  Pen,
  Type,
  Upload,
  Trash2,
  Save,
  Check,
  RotateCcw,
  Download,
  X,
  Loader2
} from 'lucide-react';

// Signature fonts for type-to-sign
const SIGNATURE_FONTS = [
  { name: 'Dancing Script', style: "'Dancing Script', cursive" },
  { name: 'Great Vibes', style: "'Great Vibes', cursive" },
  { name: 'Pacifico', style: "'Pacifico', cursive" },
  { name: 'Allura', style: "'Allura', cursive" },
  { name: 'Sacramento', style: "'Sacramento', cursive" },
];

// Google Fonts link for signature fonts
const FONTS_LINK = "https://fonts.googleapis.com/css2?family=Allura&family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&family=Sacramento&display=swap";

export default function SignatureCapture({ 
  onSignatureComplete, 
  onCancel,
  signerName = '',
  signerRole = 'signer',
  documentName = '',
  allowSave = true,
  savedSignatures = [],
  onLoadSavedSignature = null
}) {
  const canvasRef = useRef(null);
  const [activeTab, setActiveTab] = useState('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [typedName, setTypedName] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [signatureName, setSignatureName] = useState('My Signature');
  const [submitting, setSubmitting] = useState(false);

  // Load fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = FONTS_LINK;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1a365d';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  // Drawing functions
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Generate signature data based on active tab
  const getSignatureData = () => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      return canvas.toDataURL('image/png');
    } else if (activeTab === 'type') {
      // Create canvas from typed text
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a365d';
      ctx.font = `48px ${selectedFont.style}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
      return canvas.toDataURL('image/png');
    } else if (activeTab === 'upload') {
      return uploadedImage;
    }
    return null;
  };

  // Check if signature is valid
  const isSignatureValid = () => {
    if (activeTab === 'draw') return hasDrawn;
    if (activeTab === 'type') return typedName.trim().length > 0;
    if (activeTab === 'upload') return uploadedImage !== null;
    return false;
  };

  // Handle signature submission
  const handleSubmit = async () => {
    if (!isSignatureValid()) {
      toast.error('Please provide a signature');
      return;
    }

    setSubmitting(true);
    try {
      const signatureData = getSignatureData();
      
      const signaturePayload = {
        signature_data: signatureData,
        signature_type: activeTab,
        signer_name: signerName || typedName,
        signer_role: signerRole,
        timestamp: new Date().toISOString(),
        save_for_future: saveForFuture,
        signature_name: saveForFuture ? signatureName : null
      };

      await onSignatureComplete(signaturePayload);
    } catch (error) {
      toast.error('Failed to save signature');
    } finally {
      setSubmitting(false);
    }
  };

  // Load a saved signature
  const handleLoadSaved = (savedSig) => {
    if (savedSig.signature_type === 'draw' || savedSig.signature_type === 'upload') {
      setUploadedImage(savedSig.signature_data);
      setActiveTab('upload');
    } else if (savedSig.signature_type === 'type') {
      setTypedName(savedSig.signer_name || '');
      setActiveTab('type');
    }
    toast.success('Signature loaded');
  };

  return (
    <Card className="w-full max-w-2xl" data-testid="signature-capture">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pen className="w-5 h-5" />
          Sign Document
        </CardTitle>
        {documentName && (
          <CardDescription>
            Signing: {documentName}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Saved Signatures */}
        {savedSignatures.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <Label className="text-sm font-medium mb-2 block">Use Saved Signature</Label>
            <div className="flex gap-2 flex-wrap">
              {savedSignatures.map((sig, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleLoadSaved(sig)}
                >
                  {sig.signature_name || `Signature ${idx + 1}`}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Signature Method Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="draw" className="flex items-center gap-2">
              <Pen className="w-4 h-4" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="type" className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              Type
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          {/* Draw Signature Tab */}
          <TabsContent value="draw" className="space-y-3">
            <div className="border-2 border-dashed rounded-lg p-1 bg-white">
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
                data-testid="signature-canvas"
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Draw your signature above using mouse or touch
              </p>
              <Button variant="outline" size="sm" onClick={clearCanvas}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
          </TabsContent>

          {/* Type Signature Tab */}
          <TabsContent value="type" className="space-y-4">
            <div className="space-y-2">
              <Label>Type your name</Label>
              <Input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Enter your full name"
                data-testid="signature-type-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Select signature style</Label>
              <div className="grid grid-cols-1 gap-2">
                {SIGNATURE_FONTS.map((font) => (
                  <div
                    key={font.name}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedFont.name === font.name 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedFont(font)}
                  >
                    <p 
                      style={{ fontFamily: font.style, fontSize: '28px' }}
                      className="text-center text-slate-800"
                    >
                      {typedName || 'Your Name Here'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Upload Signature Tab */}
          <TabsContent value="upload" className="space-y-3">
            {uploadedImage ? (
              <div className="space-y-3">
                <div className="border-2 border-dashed rounded-lg p-4 bg-white flex items-center justify-center">
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded signature" 
                    className="max-h-32 object-contain"
                  />
                </div>
                <Button variant="outline" onClick={() => setUploadedImage(null)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload an image of your signature
                </p>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="max-w-xs mx-auto"
                  data-testid="signature-upload-input"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Save for future option */}
        {allowSave && (
          <div className="p-3 bg-muted/30 rounded-lg space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-signature"
                checked={saveForFuture}
                onCheckedChange={setSaveForFuture}
              />
              <Label htmlFor="save-signature" className="text-sm cursor-pointer">
                Save this signature for future documents
              </Label>
            </div>
            {saveForFuture && (
              <div className="space-y-1">
                <Label className="text-xs">Signature Name</Label>
                <Input
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="e.g., My Primary Signature"
                  className="max-w-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* Legal Notice */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Legal Notice:</strong> By signing this document electronically, you acknowledge that your electronic signature 
            has the same legal effect as a handwritten signature. Your signature will be recorded with a timestamp and IP address 
            for verification purposes.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleSubmit} 
            disabled={!isSignatureValid() || submitting}
            data-testid="signature-submit"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Sign Document
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
