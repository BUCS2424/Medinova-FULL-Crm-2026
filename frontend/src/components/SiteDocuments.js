import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import DocumentEditor from './DocumentEditor';
import { 
  FileText,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Globe,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  X,
  ExternalLink,
  Copy,
  Link,
  Shield,
  FileCheck,
  Scale,
  Accessibility,
  RotateCcw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Document type display info
const DOC_TYPES = {
  terms: { label: 'Terms & Conditions', color: 'bg-blue-500', icon: Scale },
  privacy: { label: 'Privacy Policy', color: 'bg-purple-500', icon: Shield },
  hipaa: { label: 'HIPAA Notice', color: 'bg-red-500', icon: FileCheck },
  accessibility: { label: 'Accessibility', color: 'bg-green-500', icon: Accessibility },
  cookie: { label: 'Cookie Policy', color: 'bg-amber-500', icon: FileText },
  disclaimer: { label: 'Disclaimer', color: 'bg-gray-500', icon: FileText },
  refund: { label: 'Refund Policy', color: 'bg-cyan-500', icon: RotateCcw },
  shipping: { label: 'Shipping', color: 'bg-orange-500', icon: FileText },
  other: { label: 'Other', color: 'bg-slate-500', icon: FileText }
};

export default function SiteDocuments() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('documents');
  
  // Documents
  const [documents, setDocuments] = useState([]);
  const [editingDoc, setEditingDoc] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [newDoc, setNewDoc] = useState({
    title: '',
    slug: '',
    doc_type: 'other',
    description: '',
    content: '',
    is_published: false,
    show_in_footer: true,
    meta_title: '',
    meta_description: ''
  });

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('dme_token')}`
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/site-documents/list`, { headers: getHeaders() });
      setDocuments(res.data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  // Generate slug from title
  const generateSlug = (title) => {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Create document
  const handleCreateDoc = async () => {
    if (!newDoc.title || !newDoc.content) {
      toast.error('Please enter title and content');
      return;
    }
    
    setSaving(true);
    try {
      const docData = {
        ...newDoc,
        slug: newDoc.slug || generateSlug(newDoc.title)
      };
      await axios.post(`${API_URL}/api/site-documents`, docData, { headers: getHeaders() });
      toast.success('Document created');
      setShowEditor(false);
      setNewDoc({
        title: '',
        slug: '',
        doc_type: 'other',
        description: '',
        content: '',
        is_published: false,
        show_in_footer: true,
        meta_title: '',
        meta_description: ''
      });
      fetchDocuments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create document');
    } finally {
      setSaving(false);
    }
  };

  // Update document
  const handleUpdateDoc = async () => {
    if (!editingDoc) return;
    
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/site-documents/${editingDoc.id}`, editingDoc, { headers: getHeaders() });
      toast.success('Document updated');
      setEditingDoc(null);
      fetchDocuments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update document');
    } finally {
      setSaving(false);
    }
  };

  // Delete document
  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/site-documents/${docId}`, { headers: getHeaders() });
      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  // Toggle publish status
  const handleTogglePublish = async (docId) => {
    try {
      const res = await axios.post(`${API_URL}/api/site-documents/${docId}/publish`, {}, { headers: getHeaders() });
      toast.success(res.data.message);
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to toggle publish status');
    }
  };

  // Reorder documents
  const handleMoveDoc = async (index, direction) => {
    const newDocs = [...documents];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= documents.length) return;
    
    [newDocs[index], newDocs[newIndex]] = [newDocs[newIndex], newDocs[index]];
    setDocuments(newDocs);
    
    try {
      await axios.post(`${API_URL}/api/site-documents/reorder`, 
        newDocs.map(d => d.id),
        { headers: getHeaders() }
      );
    } catch (error) {
      toast.error('Failed to reorder');
      fetchDocuments();
    }
  };

  // Seed defaults
  const handleSeedDefaults = async () => {
    try {
      setSaving(true);
      const res = await axios.post(`${API_URL}/api/site-documents/seed-defaults`, {}, { headers: getHeaders() });
      toast.success(res.data.message);
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to seed defaults');
    } finally {
      setSaving(false);
    }
  };

  // Preview document
  const handlePreview = async (docId) => {
    try {
      const res = await axios.get(`${API_URL}/api/site-documents/${docId}`, { headers: getHeaders() });
      setPreviewDoc(res.data);
    } catch (error) {
      toast.error('Failed to load preview');
    }
  };

  // Copy public URL
  const handleCopyUrl = (slug) => {
    const url = `${window.location.origin}/legal/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6" />
            Site Documents
          </h2>
          <p className="text-muted-foreground">Public legal documents for your website</p>
        </div>
        <Badge variant="outline">{documents.length} Documents</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents" className="gap-1">
            <FileText className="w-4 h-4" /> Documents
          </TabsTrigger>
          <TabsTrigger value="footer" className="gap-1">
            <Link className="w-4 h-4" /> Footer Links
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Site Legal Documents</CardTitle>
                  <CardDescription>Create and manage Terms, Privacy Policy, and other legal pages</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSeedDefaults} disabled={saving}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Load Defaults
                  </Button>
                  <Button onClick={() => setShowEditor(true)}>
                    <Plus className="w-4 h-4 mr-2" /> New Document
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No documents created yet</p>
                  <Button variant="link" onClick={handleSeedDefaults}>Load default documents</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc, idx) => {
                    const TypeIcon = DOC_TYPES[doc.doc_type]?.icon || FileText;
                    return (
                      <div 
                        key={doc.id} 
                        className={`flex items-center gap-3 p-4 border rounded-lg ${!doc.is_published ? 'opacity-60' : ''}`}
                      >
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleMoveDoc(idx, 'up')} disabled={idx === 0}>
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleMoveDoc(idx, 'down')} disabled={idx === documents.length - 1}>
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className={`p-2 rounded ${DOC_TYPES[doc.doc_type]?.color || 'bg-gray-500'} text-white`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">{doc.title}</h4>
                            <Badge className={`${DOC_TYPES[doc.doc_type]?.color || 'bg-gray-500'} text-white text-xs`}>
                              {DOC_TYPES[doc.doc_type]?.label || doc.doc_type}
                            </Badge>
                            {doc.is_published ? (
                              <Badge className="bg-green-500 text-white text-xs">Published</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Draft</Badge>
                            )}
                            {doc.show_in_footer && <Badge variant="outline" className="text-xs">Footer</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{doc.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-mono">/legal/{doc.slug}</span>
                            {doc.last_updated && (
                              <span className="ml-2">• Updated {new Date(doc.last_updated).toLocaleDateString()}</span>
                            )}
                          </p>
                        </div>
                        
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleTogglePublish(doc.id)}
                            title={doc.is_published ? 'Unpublish' : 'Publish'}
                          >
                            {doc.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc.id)} title="Preview">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleCopyUrl(doc.slug)} title="Copy URL">
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingDoc(doc)} title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteDoc(doc.id)} title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Editor Modal */}
          {(showEditor || editingDoc) && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="text-lg font-bold">
                    {editingDoc ? 'Edit Document' : 'Create Document'}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => { setShowEditor(false); setEditingDoc(null); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input
                        value={editingDoc?.title || newDoc.title}
                        onChange={(e) => {
                          const title = e.target.value;
                          if (editingDoc) {
                            setEditingDoc(prev => ({ ...prev, title }));
                          } else {
                            setNewDoc(prev => ({ ...prev, title, slug: generateSlug(title) }));
                          }
                        }}
                        placeholder="Terms and Conditions"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Document Type</Label>
                      <select
                        className="w-full h-10 px-3 border rounded-md"
                        value={editingDoc?.doc_type || newDoc.doc_type}
                        onChange={(e) => editingDoc 
                          ? setEditingDoc(prev => ({ ...prev, doc_type: e.target.value }))
                          : setNewDoc(prev => ({ ...prev, doc_type: e.target.value }))
                        }
                      >
                        {Object.entries(DOC_TYPES).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>URL Slug</Label>
                      <Input
                        value={editingDoc?.slug || newDoc.slug}
                        onChange={(e) => editingDoc 
                          ? setEditingDoc(prev => ({ ...prev, slug: e.target.value }))
                          : setNewDoc(prev => ({ ...prev, slug: e.target.value }))
                        }
                        placeholder="terms-and-conditions"
                      />
                      <p className="text-xs text-muted-foreground">/legal/{editingDoc?.slug || newDoc.slug || 'your-slug'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={editingDoc?.description || newDoc.description}
                        onChange={(e) => editingDoc 
                          ? setEditingDoc(prev => ({ ...prev, description: e.target.value }))
                          : setNewDoc(prev => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="Terms of service for using our website"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Content *</Label>
                    <DocumentEditor
                      content={editingDoc?.content || newDoc.content}
                      onChange={(html) => editingDoc 
                        ? setEditingDoc(prev => ({ ...prev, content: html }))
                        : setNewDoc(prev => ({ ...prev, content: html }))
                      }
                      placeholder="Start typing your document content..."
                      showVariables={true}
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Meta Title (SEO)</Label>
                      <Input
                        value={editingDoc?.meta_title || newDoc.meta_title}
                        onChange={(e) => editingDoc 
                          ? setEditingDoc(prev => ({ ...prev, meta_title: e.target.value }))
                          : setNewDoc(prev => ({ ...prev, meta_title: e.target.value }))
                        }
                        placeholder="Terms and Conditions | Company Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Meta Description (SEO)</Label>
                      <Input
                        value={editingDoc?.meta_description || newDoc.meta_description}
                        onChange={(e) => editingDoc 
                          ? setEditingDoc(prev => ({ ...prev, meta_description: e.target.value }))
                          : setNewDoc(prev => ({ ...prev, meta_description: e.target.value }))
                        }
                        placeholder="Read our terms and conditions for using our services."
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingDoc?.is_published ?? newDoc.is_published}
                        onCheckedChange={(checked) => editingDoc 
                          ? setEditingDoc(prev => ({ ...prev, is_published: checked }))
                          : setNewDoc(prev => ({ ...prev, is_published: checked }))
                        }
                      />
                      <Label>Published</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingDoc?.show_in_footer ?? newDoc.show_in_footer}
                        onCheckedChange={(checked) => editingDoc 
                          ? setEditingDoc(prev => ({ ...prev, show_in_footer: checked }))
                          : setNewDoc(prev => ({ ...prev, show_in_footer: checked }))
                        }
                      />
                      <Label>Show in Footer</Label>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-t flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setShowEditor(false); setEditingDoc(null); }}>
                    Cancel
                  </Button>
                  <Button onClick={editingDoc ? handleUpdateDoc : handleCreateDoc} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {editingDoc ? 'Update' : 'Create'} Document
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Preview Modal */}
          {previewDoc && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{previewDoc.title}</h3>
                    <p className="text-sm text-muted-foreground">/legal/{previewDoc.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    {previewDoc.is_published && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`/legal/${previewDoc.slug}`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" /> View Live
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <div 
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewDoc.preview_content || previewDoc.content }}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Footer Links Tab */}
        <TabsContent value="footer">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                Footer Link Settings
              </CardTitle>
              <CardDescription>Configure which documents appear in your website footer</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No documents to display</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Footer Preview</h4>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {documents.filter(d => d.show_in_footer && d.is_published).map(doc => (
                        <span key={doc.id} className="hover:text-primary cursor-pointer">
                          {doc.title}
                        </span>
                      ))}
                      {documents.filter(d => d.show_in_footer && d.is_published).length === 0 && (
                        <span className="italic">No published documents enabled for footer</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="border rounded-lg divide-y">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={doc.show_in_footer}
                            onCheckedChange={async (checked) => {
                              try {
                                await axios.put(`${API_URL}/api/site-documents/${doc.id}`, 
                                  { show_in_footer: checked },
                                  { headers: getHeaders() }
                                );
                                fetchDocuments();
                              } catch (error) {
                                toast.error('Failed to update');
                              }
                            }}
                          />
                          <div>
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">/legal/{doc.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.is_published ? (
                            <Badge className="bg-green-500 text-white text-xs">Published</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Draft</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Only published documents will appear in the footer. Toggle "Show in Footer" for each document to control visibility.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
