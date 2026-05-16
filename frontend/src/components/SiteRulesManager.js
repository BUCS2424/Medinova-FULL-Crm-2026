import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Loader2,
  Stethoscope,
  Users,
  Building2,
  ShoppingCart,
  FileText,
  Shield,
  CreditCard,
  Truck,
  ClipboardList,
  GripVertical,
  AlertCircle,
  Search
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Site rule categories with their icons and descriptions
const ruleCategories = [
  { 
    id: 'doctor', 
    label: 'Doctor Portal', 
    icon: Stethoscope, 
    color: 'blue',
    description: 'Rules for doctor portal access, prescriptions, and CMN signing'
  },
  { 
    id: 'patient', 
    label: 'Patient Section', 
    icon: Users, 
    color: 'green',
    description: 'Rules for patient registration, eligibility, and data handling'
  },
  { 
    id: 'supplier', 
    label: 'Supplier Section', 
    icon: Building2, 
    color: 'purple',
    description: 'Rules for supplier management, inventory, and ordering'
  },
  { 
    id: 'orders', 
    label: 'Orders & Fulfillment', 
    icon: ShoppingCart, 
    color: 'amber',
    description: 'Rules for order processing, shipping, and delivery'
  },
  { 
    id: 'billing', 
    label: 'Billing & Insurance', 
    icon: CreditCard, 
    color: 'red',
    description: 'Rules for insurance verification, billing codes, and claims'
  },
  { 
    id: 'compliance', 
    label: 'HIPAA & Compliance', 
    icon: Shield, 
    color: 'slate',
    description: 'Rules for data privacy, audit logging, and regulatory compliance'
  },
  { 
    id: 'leads', 
    label: 'Lead Management', 
    icon: ClipboardList, 
    color: 'cyan',
    description: 'Rules for lead capture, qualification, and follow-up'
  },
  { 
    id: 'shipping', 
    label: 'Shipping & Delivery', 
    icon: Truck, 
    color: 'orange',
    description: 'Rules for shipping zones, delivery times, and tracking'
  },
  { 
    id: 'seo', 
    label: 'SEO & Marketing', 
    icon: Search, 
    color: 'emerald',
    description: 'Rules for SEO pages, meta tags, content generation, and marketing'
  },
];

const getColorClasses = (color) => {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400',
    green: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400',
    purple: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400',
    amber: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400',
    red: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-400',
    slate: 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950 dark:border-cyan-800 dark:text-cyan-400',
    orange: 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-400',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400',
  };
  return colors[color] || colors.blue;
};

export default function SiteRulesManager() {
  const [rules, setRules] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [newRule, setNewRule] = useState({ category: null, title: '', content: '', priority: 'medium', enabled: true });
  const [expandedCategories, setExpandedCategories] = useState([]);

  const getHeaders = () => {
    const token = localStorage.getItem('dme_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/dev/site-rules`, { headers: getHeaders() });
      // Group rules by category
      const groupedRules = {};
      ruleCategories.forEach(cat => {
        groupedRules[cat.id] = [];
      });
      (response.data || []).forEach(rule => {
        if (groupedRules[rule.category]) {
          groupedRules[rule.category].push(rule);
        }
      });
      // Sort by order within each category
      Object.keys(groupedRules).forEach(cat => {
        groupedRules[cat].sort((a, b) => (a.order || 0) - (b.order || 0));
      });
      setRules(groupedRules);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
      // Initialize empty rules if fetch fails
      const emptyRules = {};
      ruleCategories.forEach(cat => {
        emptyRules[cat.id] = [];
      });
      setRules(emptyRules);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleAddRule = async (categoryId) => {
    if (!newRule.title.trim()) {
      toast.error('Rule title is required');
      return;
    }

    setSaving(true);
    try {
      const ruleData = {
        category: categoryId,
        title: newRule.title.trim(),
        content: newRule.content.trim(),
        priority: newRule.priority,
        enabled: newRule.enabled,
        order: (rules[categoryId]?.length || 0) + 1
      };

      const response = await axios.post(`${API_URL}/api/dev/site-rules`, ruleData, { headers: getHeaders() });
      
      setRules(prev => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] || []), response.data]
      }));
      
      setNewRule({ category: null, title: '', content: '', priority: 'medium', enabled: true });
      toast.success('Rule added successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add rule');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRule = async (ruleId, updates) => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/dev/site-rules/${ruleId}`, updates, { headers: getHeaders() });
      
      // Update local state
      setRules(prev => {
        const newRules = { ...prev };
        Object.keys(newRules).forEach(cat => {
          newRules[cat] = newRules[cat].map(rule => 
            rule.id === ruleId ? { ...rule, ...updates } : rule
          );
        });
        return newRules;
      });
      
      setEditingRule(null);
      toast.success('Rule updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId, categoryId) => {
    if (!window.confirm('Delete this rule?')) return;

    try {
      await axios.delete(`${API_URL}/api/dev/site-rules/${ruleId}`, { headers: getHeaders() });
      
      setRules(prev => ({
        ...prev,
        [categoryId]: prev[categoryId].filter(rule => rule.id !== ruleId)
      }));
      
      toast.success('Rule deleted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete rule');
    }
  };

  const handleToggleRule = async (ruleId, categoryId, enabled) => {
    try {
      await axios.put(`${API_URL}/api/dev/site-rules/${ruleId}`, { enabled }, { headers: getHeaders() });
      
      setRules(prev => ({
        ...prev,
        [categoryId]: prev[categoryId].map(rule => 
          rule.id === ruleId ? { ...rule, enabled } : rule
        )
      }));
    } catch (error) {
      toast.error('Failed to update rule status');
    }
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      low: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    };
    return <Badge className={styles[priority] || styles.medium}>{priority}</Badge>;
  };

  const getRuleCount = (categoryId) => {
    const categoryRules = rules[categoryId] || [];
    const enabled = categoryRules.filter(r => r.enabled).length;
    return { total: categoryRules.length, enabled };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="site-rules-manager">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Site Rules Management
          </CardTitle>
          <CardDescription>
            Manage operational rules and guidelines for different areas of your site. 
            Rules help define workflows, requirements, and compliance standards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion 
            type="multiple" 
            value={expandedCategories}
            onValueChange={setExpandedCategories}
            className="space-y-4"
          >
            {ruleCategories.map((category) => {
              const Icon = category.icon;
              const { total, enabled } = getRuleCount(category.id);
              const categoryRules = rules[category.id] || [];
              
              return (
                <AccordionItem 
                  key={category.id} 
                  value={category.id}
                  className={`border rounded-lg ${getColorClasses(category.color)}`}
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid={`category-${category.id}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <Icon className="w-5 h-5" />
                      <div className="text-left flex-1">
                        <div className="font-semibold">{category.label}</div>
                        <div className="text-xs opacity-70 font-normal">{category.description}</div>
                      </div>
                      <div className="flex items-center gap-2 mr-4">
                        <Badge variant="outline" className="text-xs">
                          {enabled}/{total} active
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3 pt-2">
                      {/* Existing Rules */}
                      {categoryRules.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                          No rules defined for this category yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {categoryRules.map((rule, idx) => (
                            <div 
                              key={rule.id}
                              className={`p-3 bg-white dark:bg-slate-900 rounded-lg border ${!rule.enabled ? 'opacity-50' : ''}`}
                            >
                              {editingRule === rule.id ? (
                                // Edit Mode
                                <div className="space-y-3">
                                  <Input
                                    defaultValue={rule.title}
                                    placeholder="Rule title"
                                    id={`edit-title-${rule.id}`}
                                    data-testid={`edit-title-${rule.id}`}
                                  />
                                  <Textarea
                                    defaultValue={rule.content}
                                    placeholder="Rule description and details..."
                                    rows={3}
                                    id={`edit-content-${rule.id}`}
                                  />
                                  <div className="flex items-center gap-4">
                                    <select 
                                      defaultValue={rule.priority}
                                      className="px-3 py-1.5 border rounded-md text-sm"
                                      id={`edit-priority-${rule.id}`}
                                    >
                                      <option value="high">High Priority</option>
                                      <option value="medium">Medium Priority</option>
                                      <option value="low">Low Priority</option>
                                    </select>
                                    <div className="flex-1" />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingRule(null)}
                                    >
                                      <X className="w-4 h-4 mr-1" /> Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        const title = document.getElementById(`edit-title-${rule.id}`).value;
                                        const content = document.getElementById(`edit-content-${rule.id}`).value;
                                        const priority = document.getElementById(`edit-priority-${rule.id}`).value;
                                        handleUpdateRule(rule.id, { title, content, priority });
                                      }}
                                      disabled={saving}
                                    >
                                      {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                // View Mode
                                <div className="flex items-start gap-3">
                                  <div className="text-muted-foreground cursor-grab">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{rule.title}</span>
                                      {getPriorityBadge(rule.priority)}
                                    </div>
                                    {rule.content && (
                                      <p className="text-sm text-muted-foreground">{rule.content}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={rule.enabled}
                                      onCheckedChange={(checked) => handleToggleRule(rule.id, category.id, checked)}
                                      data-testid={`toggle-${rule.id}`}
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => setEditingRule(rule.id)}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteRule(rule.id, category.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add New Rule Form */}
                      {newRule.category === category.id ? (
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border-2 border-dashed border-primary/50 space-y-3">
                          <Label className="text-sm font-medium">Add New Rule</Label>
                          <Input
                            placeholder="Rule title (e.g., 'Prescription Verification Required')"
                            value={newRule.title}
                            onChange={(e) => setNewRule(prev => ({ ...prev, title: e.target.value }))}
                            data-testid="new-rule-title"
                          />
                          <Textarea
                            placeholder="Rule description and details..."
                            rows={3}
                            value={newRule.content}
                            onChange={(e) => setNewRule(prev => ({ ...prev, content: e.target.value }))}
                            data-testid="new-rule-content"
                          />
                          <div className="flex items-center gap-4">
                            <select 
                              value={newRule.priority}
                              onChange={(e) => setNewRule(prev => ({ ...prev, priority: e.target.value }))}
                              className="px-3 py-1.5 border rounded-md text-sm"
                              data-testid="new-rule-priority"
                            >
                              <option value="high">High Priority</option>
                              <option value="medium">Medium Priority</option>
                              <option value="low">Low Priority</option>
                            </select>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={newRule.enabled}
                                onCheckedChange={(checked) => setNewRule(prev => ({ ...prev, enabled: checked }))}
                              />
                              <span className="text-sm text-muted-foreground">Enabled</span>
                            </div>
                            <div className="flex-1" />
                            <Button
                              variant="ghost"
                              onClick={() => setNewRule({ category: null, title: '', content: '', priority: 'medium', enabled: true })}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleAddRule(category.id)}
                              disabled={saving || !newRule.title.trim()}
                            >
                              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                              Add Rule
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full border-dashed"
                          onClick={() => setNewRule({ category: category.id, title: '', content: '', priority: 'medium', enabled: true })}
                          data-testid={`add-rule-${category.id}`}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Rule to {category.label}
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Quick Reference */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="font-medium mb-1">About Site Rules</h4>
              <p className="text-sm text-muted-foreground">
                Site rules define operational guidelines and requirements for different areas of your DME business. 
                Use high priority for critical compliance requirements, medium for standard procedures, and low for best practices.
                Disabled rules are saved but not enforced.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
