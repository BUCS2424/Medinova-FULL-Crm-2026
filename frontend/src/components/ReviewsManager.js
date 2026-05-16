import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Star,
  StarHalf,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Award,
  MoreVertical,
  RefreshCw,
  Download,
  AlertTriangle,
  MessageSquare,
  Users,
  TrendingUp,
  Loader2,
  Sparkles
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('dme_token')}`
});

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle }
};

const TRANSACTION_TYPES = [
  'Patient',
  'Caregiver',
  'Healthcare Provider',
  'Insurance Representative',
  'Family Member',
  'Other'
];

const StarRating = ({ rating, size = 'md', interactive = false, onChange }) => {
  const [hoverRating, setHoverRating] = useState(0);
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(star)}
          onMouseEnter={() => interactive && setHoverRating(star)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
        >
          <Star
            className={`${sizeClass} ${
              star <= (hoverRating || rating)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-gray-200 text-gray-200'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

export default function ReviewsManager() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFake, setFilterFake] = useState('all');
  const [sources, setSources] = useState([]);
  const [editingReview, setEditingReview] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedReviews, setSelectedReviews] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [deletingFake, setDeletingFake] = useState(false);

  useEffect(() => {
    checkFeatureAndFetch();
  }, []);

  useEffect(() => {
    if (featureEnabled) {
      fetchData();
    }
  }, [searchTerm, filterSource, filterStatus, filterFake, featureEnabled]);

  const checkFeatureAndFetch = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/features/testimonials`, { headers: getHeaders() });
      setFeatureEnabled(response.data.enabled);
      if (response.data.enabled) {
        fetchData();
      } else {
        setLoading(false);
      }
    } catch (error) {
      // Default to enabled if check fails
      fetchData();
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterSource !== 'all') params.append('source', filterSource);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterFake !== 'all') params.append('is_fake', filterFake === 'fake');

      const [reviewsRes, statsRes, sourcesRes] = await Promise.all([
        axios.get(`${API_URL}/api/reviews?${params.toString()}`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/reviews/stats`, { headers: getHeaders() }),
        axios.get(`${API_URL}/api/reviews/sources`, { headers: getHeaders() })
      ]);

      setReviews(reviewsRes.data.reviews || []);
      setStats(statsRes.data);
      setSources(sourcesRes.data.sources || []);
    } catch (error) {
      toast.error('Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  const updateReview = async (reviewId, data) => {
    try {
      await axios.put(`${API_URL}/api/reviews/${reviewId}`, data, { headers: getHeaders() });
      toast.success('Review updated');
      fetchData();
      setEditingReview(null);
    } catch (error) {
      toast.error('Failed to update review');
    }
  };

  const deleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      await axios.delete(`${API_URL}/api/reviews/${reviewId}`, { headers: getHeaders() });
      toast.success('Review deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete review');
    }
  };

  const generateFakeReviews = async () => {
    if (!window.confirm('Generate 200 fake reviews for testing? They will be marked as fake for easy deletion later.')) return;
    setGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/api/reviews/generate-fake?count=200`, {}, { headers: getHeaders() });
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to generate reviews');
    } finally {
      setGenerating(false);
    }
  };

  const deleteAllFake = async () => {
    if (!window.confirm('Delete ALL fake/placeholder reviews? This cannot be undone.')) return;
    setDeletingFake(true);
    try {
      const response = await axios.delete(`${API_URL}/api/reviews/fake/all`, { headers: getHeaders() });
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete fake reviews');
    } finally {
      setDeletingFake(false);
    }
  };

  const createReview = async (data) => {
    try {
      await axios.post(`${API_URL}/api/reviews`, data, { headers: getHeaders() });
      toast.success('Review created');
      fetchData();
      setCreateModalOpen(false);
    } catch (error) {
      toast.error('Failed to create review');
    }
  };

  const quickAction = async (reviewId, action) => {
    const updates = {
      approve: { status: 'approved' },
      reject: { status: 'rejected' },
      feature: { featured: true },
      unfeature: { featured: false },
      show: { show_on_homepage: true },
      hide: { show_on_homepage: false }
    };
    await updateReview(reviewId, updates[action]);
  };

  if (loading && !reviews.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Feature disabled state
  if (!featureEnabled) {
    return (
      <div className="space-y-6" data-testid="reviews-manager-disabled">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <EyeOff className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-amber-900 mb-2">Testimonials Feature Disabled</h3>
              <p className="text-amber-700 mb-6 max-w-md mx-auto">
                The Testimonials feature is currently turned off. Reviews will not be displayed on the public website.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/dev-settings'}
                  className="border-amber-300 hover:bg-amber-100"
                >
                  Go to Features Manager
                </Button>
                <p className="text-sm text-amber-600">
                  Enable "Testimonials" in Dev Settings → Features Manager
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reviews-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reviews Management</h2>
          <p className="text-muted-foreground">Manage customer testimonials and reviews</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateFakeReviews} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate 200 Fake
          </Button>
          {stats?.fake_count > 0 && (
            <Button variant="outline" onClick={deleteAllFake} disabled={deletingFake} className="text-red-600 hover:text-red-700">
              {deletingFake ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete All Fake ({stats.fake_count})
            </Button>
          )}
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Review
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Reviews</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold flex items-center justify-center gap-1">
                {stats.average_rating}
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.on_homepage}</div>
              <p className="text-xs text-muted-foreground">On Homepage</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.featured}</div>
              <p className="text-xs text-muted-foreground">Featured</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-orange-600">{stats.fake_count}</div>
              <p className="text-xs text-muted-foreground">Fake/Test</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-red-600">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search reviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterFake} onValueChange={setFilterFake}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="real">Real Only</SelectItem>
                <SelectItem value="fake">Fake Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {reviews.map((review) => {
              const StatusIcon = STATUS_CONFIG[review.status]?.icon || Clock;
              return (
                <div key={review.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Rating & Status */}
                    <div className="flex flex-col items-center gap-2 min-w-[80px]">
                      <StarRating rating={review.rating} size="sm" />
                      <Badge className={STATUS_CONFIG[review.status]?.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {STATUS_CONFIG[review.status]?.label}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{review.reviewer_name}</span>
                        {review.is_fake && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">Fake</Badge>
                        )}
                        {review.featured && (
                          <Badge className="bg-purple-100 text-purple-700">
                            <Award className="w-3 h-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                        {review.show_on_homepage && (
                          <Badge className="bg-blue-100 text-blue-700">
                            <Eye className="w-3 h-3 mr-1" />
                            Homepage
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-sm">"{review.title}"</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{review.text}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {review.reviewer_location && <span>{review.reviewer_location}</span>}
                        {review.transaction_type && <span>{review.transaction_type}</span>}
                        {review.product_purchased && <span>Re: {review.product_purchased}</span>}
                        <span>{review.source}</span>
                        <span>{new Date(review.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {review.status === 'pending' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => quickAction(review.id, 'approve')} className="text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => quickAction(review.id, 'reject')} className="text-red-600">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingReview(review)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {review.status !== 'approved' && (
                            <DropdownMenuItem onClick={() => quickAction(review.id, 'approve')}>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Approve
                            </DropdownMenuItem>
                          )}
                          {review.featured ? (
                            <DropdownMenuItem onClick={() => quickAction(review.id, 'unfeature')}>
                              <Award className="w-4 h-4 mr-2" />
                              Remove Featured
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => quickAction(review.id, 'feature')}>
                              <Award className="w-4 h-4 mr-2" />
                              Make Featured
                            </DropdownMenuItem>
                          )}
                          {review.show_on_homepage ? (
                            <DropdownMenuItem onClick={() => quickAction(review.id, 'hide')}>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide from Homepage
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => quickAction(review.id, 'show')}>
                              <Eye className="w-4 h-4 mr-2" />
                              Show on Homepage
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => deleteReview(review.id)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}

            {reviews.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No reviews found</p>
                <Button className="mt-4" onClick={generateFakeReviews}>
                  Generate Sample Reviews
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <ReviewFormModal
        open={createModalOpen || !!editingReview}
        onClose={() => { setCreateModalOpen(false); setEditingReview(null); }}
        review={editingReview}
        onSave={editingReview ? (data) => updateReview(editingReview.id, data) : createReview}
      />
    </div>
  );
}

function ReviewFormModal({ open, onClose, review, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    text: '',
    rating: 5,
    reviewer_name: '',
    reviewer_email: '',
    reviewer_phone: '',
    reviewer_title: '',
    reviewer_location: '',
    transaction_type: '',
    product_purchased: '',
    source: 'Manual',
    status: 'approved',
    featured: false,
    show_on_homepage: true,
    is_fake: false
  });

  useEffect(() => {
    if (review) {
      setFormData({
        title: review.title || '',
        text: review.text || '',
        rating: review.rating || 5,
        reviewer_name: review.reviewer_name || '',
        reviewer_email: review.reviewer_email || '',
        reviewer_phone: review.reviewer_phone || '',
        reviewer_title: review.reviewer_title || '',
        reviewer_location: review.reviewer_location || '',
        transaction_type: review.transaction_type || '',
        product_purchased: review.product_purchased || '',
        source: review.source || 'Manual',
        status: review.status || 'approved',
        featured: review.featured || false,
        show_on_homepage: review.show_on_homepage ?? true,
        is_fake: review.is_fake || false
      });
    } else {
      setFormData({
        title: '',
        text: '',
        rating: 5,
        reviewer_name: '',
        reviewer_email: '',
        reviewer_phone: '',
        reviewer_title: '',
        reviewer_location: '',
        transaction_type: '',
        product_purchased: '',
        source: 'Manual',
        status: 'approved',
        featured: false,
        show_on_homepage: true,
        is_fake: false
      });
    }
  }, [review, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{review ? 'Edit Review' : 'Add New Review'}</DialogTitle>
          <DialogDescription>
            {review ? 'Update review details' : 'Create a new customer review'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rating */}
          <div className="space-y-2">
            <Label>Rating</Label>
            <StarRating
              rating={formData.rating}
              size="lg"
              interactive
              onChange={(rating) => setFormData({ ...formData, rating })}
            />
          </div>

          {/* Title & Text */}
          <div className="space-y-2">
            <Label>Review Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Excellent service!"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Review Text *</Label>
            <Textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="Write the review content..."
              rows={4}
              required
            />
          </div>

          {/* Reviewer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reviewer Name *</Label>
              <Input
                value={formData.reviewer_name}
                onChange={(e) => setFormData({ ...formData, reviewer_name: e.target.value })}
                placeholder="John D."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Reviewer Title</Label>
              <Input
                value={formData.reviewer_title}
                onChange={(e) => setFormData({ ...formData, reviewer_title: e.target.value })}
                placeholder="Verified Patient"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.reviewer_email}
                onChange={(e) => setFormData({ ...formData, reviewer_email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.reviewer_phone}
                onChange={(e) => setFormData({ ...formData, reviewer_phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={formData.reviewer_location}
                onChange={(e) => setFormData({ ...formData, reviewer_location: e.target.value })}
                placeholder="Tampa, FL"
              />
            </div>
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={formData.transaction_type} onValueChange={(v) => setFormData({ ...formData, transaction_type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Product Purchased</Label>
            <Input
              value={formData.product_purchased}
              onChange={(e) => setFormData({ ...formData, product_purchased: e.target.value })}
              placeholder="e.g., wheelchair, CPAP machine"
            />
          </div>

          {/* Status & Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Website">Website</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="Healthgrades">Healthgrades</SelectItem>
                  <SelectItem value="Yelp">Yelp</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_on_homepage}
                onChange={(e) => setFormData({ ...formData, show_on_homepage: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">Show on Homepage</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_fake}
                onChange={(e) => setFormData({ ...formData, is_fake: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-orange-600">Mark as Fake</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {review ? 'Update Review' : 'Create Review'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
