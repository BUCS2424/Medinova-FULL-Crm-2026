import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, FileText, Download, Trash2, FileCheck, FileX } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DOCUMENT_TYPES = [
  { value: 'rx', label: 'Prescription (Rx)' },
  { value: 'face_to_face', label: 'Face-to-Face' }
];

const SIGNATURE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'signed', label: 'Signed' },
  { value: 'rejected', label: 'Rejected' }
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    patient_id: '',
    document_type: 'rx',
    file_name: '',
    file_path: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [docsRes, patientsRes] = await Promise.all([
        axios.get(`${API_URL}/api/documents`),
        axios.get(`${API_URL}/api/patients`)
      ]);
      setDocuments(docsRes.data);
      setPatients(patientsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/documents`, formData);
      toast.success('Document created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create document');
    }
  };

  const handleSignatureUpdate = async (docId, status) => {
    try {
      await axios.put(`${API_URL}/api/documents/${docId}`, {
        signature_status: status,
        signed_at: status === 'signed' ? new Date().toISOString() : null
      });
      toast.success('Signature status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update signature status');
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/documents/${docId}`);
      toast.success('Document deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete document');
    }
  };

  const resetForm = () => {
    setFormData({
      patient_id: '',
      document_type: 'rx',
      file_name: '',
      file_path: ''
    });
  };

  const getPatientName = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown';
  };

  const getSignatureBadgeClass = (status) => {
    const classes = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      signed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return classes[status] || '';
  };

  return (
    <div data-testid="documents-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">Manage prescriptions and face-to-face documents</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="create-document-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Document
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Document</DialogTitle>
              <DialogDescription>Upload a document for a patient</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select
                  value={formData.patient_id}
                  onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
                >
                  <SelectTrigger data-testid="document-patient-select">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select
                  value={formData.document_type}
                  onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                >
                  <SelectTrigger data-testid="document-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>File Name</Label>
                <Input
                  placeholder="prescription_001.pdf"
                  value={formData.file_name}
                  onChange={(e) => setFormData({ ...formData, file_name: e.target.value })}
                  required
                  data-testid="document-filename-input"
                />
              </div>
              <div className="space-y-2">
                <Label>File Path / URL</Label>
                <Input
                  placeholder="/documents/rx/..."
                  value={formData.file_path}
                  onChange={(e) => setFormData({ ...formData, file_path: e.target.value })}
                  required
                  data-testid="document-filepath-input"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="document-submit-btn">Create Document</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : documents && documents.length > 0 ? (
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Signature Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id} data-testid={`document-row-${doc.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{doc.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {doc.document_type === 'rx' ? 'Rx' : 'Face-to-Face'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getPatientName(doc.patient_id)}</TableCell>
                    <TableCell>
                      <Select
                        value={doc.signature_status}
                        onValueChange={(value) => handleSignatureUpdate(doc.id, value)}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <Badge className={`${getSignatureBadgeClass(doc.signature_status)} text-xs`}>
                            {doc.signature_status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {SIGNATURE_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="table-actions justify-end">
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state">
              <FileText className="empty-state-icon" />
              <h3 className="font-semibold mb-1">No documents found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by adding your first document
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Document
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
