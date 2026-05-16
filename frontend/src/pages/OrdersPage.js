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
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, ClipboardList, Trash2, Eye, Send, CheckCircle, FileText } from 'lucide-react';
import DMEOrderForm from '../components/DMEOrderForm';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'awaiting_prescription', label: 'Awaiting Rx' },
  { value: 'prescription_sent', label: 'Rx Sent' },
  { value: 'prescription_verified', label: 'Rx Verified' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' }
];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDMEFormOpen, setIsDMEFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSendRxOpen, setIsSendRxOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [magicLinkInfo, setMagicLinkInfo] = useState(null);
  const [formData, setFormData] = useState({
    patient_id: '',
    prescriber_id: '',
    supplier_id: '',
    items: [{ hcpcs_code: '', description: '', quantity: 1, unit_price: 0 }],
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, patientsRes, doctorsRes, suppliersRes] = await Promise.all([
        axios.get(`${API_URL}/api/orders`),
        axios.get(`${API_URL}/api/patients`),
        axios.get(`${API_URL}/api/users/role/doctor`),
        axios.get(`${API_URL}/api/suppliers`)
      ]);
      setOrders(ordersRes.data);
      setPatients(patientsRes.data);
      setDoctors(doctorsRes.data);
      setSuppliers(suppliersRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        items: formData.items.map(item => ({
          ...item,
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price)
        }))
      };
      await axios.post(`${API_URL}/api/orders`, payload);
      toast.success('Order created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await axios.put(`${API_URL}/api/orders/${orderId}`, { status: newStatus });
      toast.success('Order status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/orders/${orderId}`);
      toast.success('Order deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete order');
    }
  };

  const handleSendToDoctor = async (order) => {
    try {
      const response = await axios.post(`${API_URL}/api/doctor-portal/send-magic-link`, {
        doctor_id: order.prescriber_id,
        order_id: order.id,
        patient_id: order.patient_id
      });
      
      setMagicLinkInfo(response.data);
      setSelectedOrder(order);
      setIsSendRxOpen(true);
      toast.success('Magic link sent to doctor!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send magic link');
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { hcpcs_code: '', description: '', quantity: 1, unit_price: 0 }]
    });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const resetForm = () => {
    setFormData({
      patient_id: '',
      prescriber_id: '',
      supplier_id: '',
      items: [{ hcpcs_code: '', description: '', quantity: 1, unit_price: 0 }],
      notes: ''
    });
  };

  const getPatientName = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown';
  };

  const getDoctorName = (doctorId) => {
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : 'Unknown';
  };

  const getSupplierName = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : 'Unknown';
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      pending: 'pending',
      awaiting_prescription: 'verifying',
      prescription_sent: 'new',
      prescription_verified: 'qualified',
      confirmed: 'confirmed',
      shipped: 'shipped',
      delivered: 'delivered',
      cancelled: 'lost'
    };
    return classes[status] || 'pending';
  };

  const canSendToDoctor = (status) => {
    return ['pending', 'awaiting_prescription'].includes(status);
  };

  return (
    <div data-testid="orders-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Manage DME orders with HCPCS codes</p>
        </div>
        <Button onClick={() => setIsDMEFormOpen(true)} data-testid="create-order-btn">
          <Plus className="w-4 h-4 mr-2" />
          New DME Order
        </Button>
      </div>

      {/* DME Order Form Dialog */}
      <DMEOrderForm
        isOpen={isDMEFormOpen}
        onClose={() => setIsDMEFormOpen(false)}
        onSuccess={fetchData}
      />

      {/* Legacy Create Dialog - keeping for reference but hidden */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl dialog-content">
          <DialogHeader>
            <DialogTitle>Create New Order</DialogTitle>
            <DialogDescription>Enter order details with HCPCS codes</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select
                  value={formData.patient_id}
                    onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
                  >
                    <SelectTrigger data-testid="order-patient-select">
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
                  <Label>Prescriber (Doctor)</Label>
                  <Select
                    value={formData.prescriber_id}
                    onValueChange={(value) => setFormData({ ...formData, prescriber_id: value })}
                  >
                    <SelectTrigger data-testid="order-doctor-select">
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          Dr. {doctor.first_name} {doctor.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select
                    value={formData.supplier_id}
                    onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                  >
                    <SelectTrigger data-testid="order-supplier-select">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Order Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    Add Item
                  </Button>
                </div>
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-5 gap-2 p-3 border rounded-lg">
                    <Input
                      placeholder="HCPCS Code"
                      value={item.hcpcs_code}
                      onChange={(e) => updateItem(index, 'hcpcs_code', e.target.value)}
                      className="font-mono"
                      data-testid={`order-hcpcs-${index}`}
                    />
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      className="col-span-2"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Price"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                      />
                      {formData.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Order notes..."
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="order-submit-btn">Create Order</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders && orders.length > 0 ? (
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Prescriber</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                    <TableCell className="font-mono text-sm">
                      {order.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{getPatientName(order.patient_id)}</TableCell>
                    <TableCell>{getDoctorName(order.prescriber_id)}</TableCell>
                    <TableCell>{getSupplierName(order.supplier_id)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {order.items?.map((item, i) => (
                          <span key={i} className="font-mono mr-2">{item.hcpcs_code}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${order.total_amount?.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <Badge className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                            {order.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="table-actions justify-end">
                        {canSendToDoctor(order.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSendToDoctor(order)}
                            title="Send to Doctor for Signature"
                            data-testid={`send-rx-${order.id}`}
                          >
                            <Send className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                        {order.status === 'prescription_verified' && (
                          <CheckCircle className="w-4 h-4 text-green-600" title="Prescription Verified" />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsViewOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(order.id)}
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
              <ClipboardList className="empty-state-icon" />
              <h3 className="font-semibold mb-1">No orders found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by creating your first order
              </p>
              <Button onClick={() => setIsDMEFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New DME Order
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Order Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="font-mono text-sm">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={`status-badge ${getStatusBadgeClass(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Patient</p>
                  <p className="font-medium">{getPatientName(selectedOrder.patient_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prescriber</p>
                  <p className="font-medium">{getDoctorName(selectedOrder.prescriber_id)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supplier</p>
                <p className="font-medium">{getSupplierName(selectedOrder.supplier_id)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Items</p>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, i) => (
                    <div key={i} className="flex justify-between p-2 bg-slate-50 dark:bg-navy-800 rounded">
                      <div>
                        <span className="font-mono text-sm">{item.hcpcs_code}</span>
                        <span className="text-muted-foreground ml-2">{item.description}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">x{item.quantity}</span>
                        <span className="font-medium ml-2">${(item.quantity * item.unit_price).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between pt-4 border-t">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold">${selectedOrder.total_amount?.toFixed(2)}</span>
              </div>
              {selectedOrder.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedOrder.notes}</p>
                </div>
              )}
              
              {/* Send to Doctor Button in View Dialog */}
              {canSendToDoctor(selectedOrder.status) && (
                <div className="pt-4 border-t">
                  <Button 
                    className="w-full" 
                    onClick={() => {
                      setIsViewOpen(false);
                      handleSendToDoctor(selectedOrder);
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send to Doctor for Signature
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Rx Confirmation Dialog */}
      <Dialog open={isSendRxOpen} onOpenChange={setIsSendRxOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Magic Link Sent!
            </DialogTitle>
            <DialogDescription>
              The doctor has been sent a secure link to sign the prescription
            </DialogDescription>
          </DialogHeader>
          {magicLinkInfo && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                  <strong>SMS sent to doctor's phone</strong>
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  The doctor will receive a verification code via SMS
                </p>
              </div>
              
              {/* Demo/Testing info - remove in production */}
              <div className="p-4 bg-slate-100 dark:bg-navy-800 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2 font-semibold">
                  For Testing/Demo (remove in production):
                </p>
                <div className="space-y-1 text-xs font-mono">
                  <p>Verification Code: <strong>{magicLinkInfo.verification_code}</strong></p>
                  <p className="break-all">Link: {magicLinkInfo.magic_link}</p>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>The order status has been updated to "Prescription Sent"</p>
                <p>You will be notified when the doctor signs the document.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsSendRxOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
