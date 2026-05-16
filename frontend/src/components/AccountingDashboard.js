import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Textarea } from './ui/textarea';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './ui/tabs';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  PieChart,
  BarChart3,
  Plus,
  Trash2,
  Edit,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Building2,
  Package,
  Loader2
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EXPENSE_CATEGORIES = [
  { value: 'supplies', label: 'Supplies', color: '#3b82f6' },
  { value: 'shipping', label: 'Shipping', color: '#10b981' },
  { value: 'equipment', label: 'Equipment', color: '#f59e0b' },
  { value: 'payroll', label: 'Payroll', color: '#ef4444' },
  { value: 'utilities', label: 'Utilities', color: '#8b5cf6' },
  { value: 'marketing', label: 'Marketing', color: '#ec4899' },
  { value: 'software', label: 'Software', color: '#06b6d4' },
  { value: 'insurance', label: 'Insurance', color: '#84cc16' },
  { value: 'rent', label: 'Rent', color: '#f97316' },
  { value: 'other', label: 'Other', color: '#6b7280' }
];

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function AccountingDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [revenueBreakdown, setRevenueBreakdown] = useState(null);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    category: 'supplies',
    description: '',
    amount: '',
    vendor: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    recurring: false
  });

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, expensesRes, revenueRes] = await Promise.all([
        axios.get(`${API_URL}/api/accounting/summary?period=${period}`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/accounting/expenses?limit=20`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/accounting/revenue-breakdown?period=${period}`, { headers: getHeaders() })
      ]);
      
      setSummary(summaryRes.data);
      setExpenses(expensesRes.data.expenses || []);
      setRevenueBreakdown(revenueRes.data);
    } catch (error) {
      toast.error('Failed to load accounting data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const handleCreateExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      if (editingExpense) {
        await axios.put(
          `${API_URL}/api/accounting/expenses/${editingExpense.id}`,
          { ...expenseForm, amount: parseFloat(expenseForm.amount) },
          { headers: getHeaders() }
        );
        toast.success('Expense updated');
      } else {
        await axios.post(
          `${API_URL}/api/accounting/expenses`,
          { ...expenseForm, amount: parseFloat(expenseForm.amount) },
          { headers: getHeaders() }
        );
        toast.success('Expense added');
      }
      
      setIsExpenseDialogOpen(false);
      setEditingExpense(null);
      resetExpenseForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save expense');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/accounting/expenses/${expenseId}`, { headers: getHeaders() });
      toast.success('Expense deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const openEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      vendor: expense.vendor || '',
      date: expense.date,
      notes: expense.notes || '',
      recurring: expense.recurring || false
    });
    setIsExpenseDialogOpen(true);
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      category: 'supplies',
      description: '',
      amount: '',
      vendor: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      recurring: false
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCategoryColor = (category) => {
    return EXPENSE_CATEGORIES.find(c => c.value === category)?.color || '#6b7280';
  };

  const getCategoryLabel = (category) => {
    return EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
  };

  // Prepare pie chart data for expenses
  const expensePieData = summary?.top_expense_categories?.map((cat, idx) => ({
    name: getCategoryLabel(cat.category),
    value: cat.amount,
    color: getCategoryColor(cat.category)
  })) || [];

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Accounting Dashboard</h2>
          <p className="text-muted-foreground">Track income, expenses, and financial performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]" data-testid="period-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditingExpense(null); resetExpenseForm(); setIsExpenseDialogOpen(true); }} data-testid="add-expense-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(summary?.summary?.total_revenue)}</p>
                {summary?.summary?.revenue_change_percent !== 0 && (
                  <div className="flex items-center mt-2 text-sm">
                    {summary?.summary?.revenue_change_percent > 0 ? (
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 mr-1" />
                    )}
                    <span>{Math.abs(summary?.summary?.revenue_change_percent || 0).toFixed(1)}% vs last period</span>
                  </div>
                )}
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <DollarSign className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">Total Expenses</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(summary?.summary?.total_expenses)}</p>
                {summary?.summary?.expense_change_percent !== 0 && (
                  <div className="flex items-center mt-2 text-sm">
                    {summary?.summary?.expense_change_percent > 0 ? (
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 mr-1" />
                    )}
                    <span>{Math.abs(summary?.summary?.expense_change_percent || 0).toFixed(1)}% vs last period</span>
                  </div>
                )}
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <CreditCard className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${(summary?.summary?.net_profit || 0) >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} text-white`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Net Profit</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(summary?.summary?.net_profit)}</p>
                <p className="text-sm mt-2 opacity-90">
                  {(summary?.summary?.profit_margin || 0).toFixed(1)}% margin
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                {(summary?.summary?.net_profit || 0) >= 0 ? (
                  <TrendingUp className="w-8 h-8" />
                ) : (
                  <TrendingDown className="w-8 h-8" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Orders</p>
                <p className="text-3xl font-bold mt-1">{summary?.summary?.total_orders || 0}</p>
                <p className="text-sm mt-2 text-muted-foreground">
                  Avg: {formatCurrency((summary?.summary?.total_revenue || 0) / (summary?.summary?.total_orders || 1))}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl">
                <Package className="w-8 h-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Pipeline Value - from leads */}
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Pipeline Value</p>
                <p className="text-3xl font-bold mt-1" data-testid="pipeline-value-accounting">{formatCurrency(summary?.summary?.pipeline_value)}</p>
                <p className="text-sm mt-2 opacity-90">
                  Potential revenue from active leads
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <TrendingUp className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue vs Expenses Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Revenue vs Expenses Over Time
            </CardTitle>
            <CardDescription>Daily breakdown of income and spending</CardDescription>
          </CardHeader>
          <CardContent>
            {summary?.timeline_data?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={summary.timeline_data}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip 
                    formatter={(val) => formatCurrency(val)}
                    labelFormatter={(label) => formatDate(label)}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)"
                    name="Revenue"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expenses" 
                    stroke="#ef4444" 
                    fillOpacity={1} 
                    fill="url(#colorExpenses)"
                    name="Expenses"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No data for selected period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Expense Breakdown
            </CardTitle>
            <CardDescription>By category</CardDescription>
          </CardHeader>
          <CardContent>
            {expensePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {expensePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No expenses recorded</p>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {expensePieData.slice(0, 5).map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(cat.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expenses">Recent Expenses</TabsTrigger>
          <TabsTrigger value="revenue">Revenue by Supplier</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Recent Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            style={{ 
                              borderColor: getCategoryColor(expense.category),
                              color: getCategoryColor(expense.category)
                            }}
                          >
                            {getCategoryLabel(expense.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell>{expense.vendor || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditExpense(expense)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleDeleteExpense(expense.id)}
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
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No expenses recorded yet</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => { setEditingExpense(null); resetExpenseForm(); setIsExpenseDialogOpen(true); }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Expense
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Revenue by Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueBreakdown?.by_supplier?.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={revenueBreakdown.by_supplier}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="supplier_name" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(val) => `$${val}`} />
                      <Tooltip formatter={(val) => formatCurrency(val)} />
                      <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueBreakdown.by_supplier.map((supplier, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{supplier.supplier_name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(supplier.revenue)}</TableCell>
                          <TableCell className="text-right">
                            {((supplier.revenue / (summary?.summary?.total_revenue || 1)) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No revenue data for selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Top Products by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueBreakdown?.by_product?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>HCPCS Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Quantity Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueBreakdown.by_product.map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="outline">{product.hcpcs_code}</Badge>
                        </TableCell>
                        <TableCell>{product.description}</TableCell>
                        <TableCell className="text-right">{product.quantity}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No product data for selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
            <DialogDescription>
              {editingExpense ? 'Update expense details' : 'Record a new business expense'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(val) => setExpenseForm({ ...expenseForm, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="e.g., Office supplies from Staples"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-9"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input
                  value={expenseForm.vendor}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                  placeholder="e.g., Amazon, Staples"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                placeholder="Additional details..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateExpense} data-testid="save-expense-btn">
              {editingExpense ? 'Update Expense' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
