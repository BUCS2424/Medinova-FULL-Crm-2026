import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { Star, CheckCircle2, Send, ExternalLink, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TRANSACTION_TYPES = [
  { value: 'Patient', label: 'Patient' },
  { value: 'Caregiver', label: 'Caregiver' },
  { value: 'Healthcare Provider', label: 'Healthcare Provider' },
  { value: 'Insurance Representative', label: 'Insurance Representative' },
  { value: 'Family Member', label: 'Family Member' },
  { value: 'Other', label: 'Other' }
];

const EXTERNAL_REVIEW_LINKS = [
  { name: 'Google', url: 'https://business.google.com', icon: '🔍' },
  { name: 'Healthgrades', url: 'https://www.healthgrades.com', icon: '🏥' },
  { name: 'Yelp', url: 'https://www.yelp.com', icon: '⭐' },
  { name: 'Facebook', url: 'https://www.facebook.com', icon: '📘' },
  { name: 'BBB', url: 'https://www.bbb.org', icon: '✓' }
];

const StarRating = ({ rating, onChange }) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          className="p-1 transition-transform hover:scale-110 focus:outline-none"
        >
          <Star
            className={`w-10 h-10 transition-colors ${
              star <= (hoverRating || rating)
                ? 'fill-amber-400 text-lime-400'
                : 'fill-gray-200 text-gray-300'
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-lg font-medium text-muted-foreground">
        {rating > 0 ? `${rating} star${rating > 1 ? 's' : ''}` : 'Select rating'}
      </span>
    </div>
  );
};

export default function WriteReviewPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    text: '',
    rating: 0,
    reviewer_name: '',
    reviewer_email: '',
    reviewer_phone: '',
    transaction_type: '',
    product_purchased: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.rating === 0) {
      toast.error('Please select a star rating');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/reviews/submit`, formData);
      setSubmitted(true);
      toast.success('Review submitted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50/50 to-white py-16">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="text-center">
            <CardHeader>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Thank You for Your Review!</CardTitle>
              <CardDescription className="text-base">
                Your review has been submitted and is pending approval. We appreciate your feedback!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Help us reach more patients by leaving a review on these platforms:
                </p>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {EXTERNAL_REVIEW_LINKS.map((link) => (
                    <a
                      key={link.name}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <span>{link.icon}</span>
                      <span className="font-medium">{link.name}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
              <Button onClick={() => window.location.href = '/'} variant="outline">
                Return to Homepage
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50/50 to-white py-16">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Share Your Experience</h1>
          <p className="text-muted-foreground">
            Your feedback helps us serve our patients better and helps others find quality DME care.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Write a Review</CardTitle>
            <CardDescription>
              Tell us about your experience with our services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Star Rating */}
              <div className="space-y-2">
                <Label className="text-base">How would you rate your experience? *</Label>
                <StarRating
                  rating={formData.rating}
                  onChange={(rating) => setFormData({ ...formData, rating })}
                />
              </div>

              {/* Review Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Review Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Summarize your experience in a few words"
                  required
                />
              </div>

              {/* Review Text */}
              <div className="space-y-2">
                <Label htmlFor="text">Your Review *</Label>
                <Textarea
                  id="text"
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  placeholder="Share details about your experience. What did you like? How did we help you?"
                  rows={5}
                  required
                />
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reviewer_name">Your Name *</Label>
                  <Input
                    id="reviewer_name"
                    value={formData.reviewer_name}
                    onChange={(e) => setFormData({ ...formData, reviewer_name: e.target.value })}
                    placeholder="John D."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reviewer_email">Email Address *</Label>
                  <Input
                    id="reviewer_email"
                    type="email"
                    value={formData.reviewer_email}
                    onChange={(e) => setFormData({ ...formData, reviewer_email: e.target.value })}
                    placeholder="john@example.com"
                    required
                  />
                  <p className="text-xs text-muted-foreground">We'll never share your email publicly</p>
                </div>
              </div>

              {/* Phone & Transaction Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reviewer_phone">Phone Number (Optional)</Label>
                  <Input
                    id="reviewer_phone"
                    type="tel"
                    value={formData.reviewer_phone}
                    onChange={(e) => setFormData({ ...formData, reviewer_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Your Relationship to Us</Label>
                  <Select
                    value={formData.transaction_type}
                    onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product */}
              <div className="space-y-2">
                <Label htmlFor="product_purchased">Product or Service Received (Optional)</Label>
                <Input
                  id="product_purchased"
                  value={formData.product_purchased}
                  onChange={(e) => setFormData({ ...formData, product_purchased: e.target.value })}
                  placeholder="e.g., Wheelchair, CPAP Machine, Hospital Bed"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Review
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-3">
                  By submitting, you agree that your review may be published on our website.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* External Links */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            You can also leave reviews on these platforms:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXTERNAL_REVIEW_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {link.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
