import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Star, ChevronLeft, ChevronRight, Quote, CheckCircle2, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const StarRating = ({ rating, size = 'md' }) => {
  const sizeClass = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-gray-600 text-gray-600'
          }`}
        />
      ))}
    </div>
  );
};

export default function TestimonialsSection() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ average_rating: 5.0, total_reviews: 0, recommend_percentage: 100 });
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedReview, setSelectedReview] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    checkFeatureFlag();
  }, []);

  const checkFeatureFlag = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/features/testimonials`);
      const enabled = response.data.enabled;
      setFeatureEnabled(enabled);
      if (enabled) {
        fetchReviews();
      } else {
        setLoading(false);
      }
    } catch (error) {
      // Default to enabled if check fails
      fetchReviews();
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/public?homepage_only=true&limit=20`);
      setReviews(response.data.reviews || []);
      setStats(response.data.stats || { average_rating: 5.0, total_reviews: 0, recommend_percentage: 100 });
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  // If feature is disabled, don't render anything
  if (!featureEnabled) {
    return null;
  }

  const scrollToIndex = (index) => {
    const container = containerRef.current;
    if (!container) return;
    
    const cardWidth = 320; // Card width + gap
    const maxIndex = Math.max(0, reviews.length - 4);
    const newIndex = Math.max(0, Math.min(index, maxIndex));
    
    setCurrentIndex(newIndex);
    container.scrollTo({
      left: newIndex * cardWidth,
      behavior: 'smooth'
    });
  };

  const handlePrev = () => scrollToIndex(currentIndex - 1);
  const handleNext = () => scrollToIndex(currentIndex + 1);

  if (loading) {
    return (
      <section className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-64 bg-slate-700 rounded mb-4"></div>
            <div className="h-12 w-96 bg-slate-700 rounded"></div>
          </div>
        </div>
      </section>
    );
  }

  if (reviews.length === 0) {
    return null; // Don't show section if no reviews
  }

  return (
    <section className="py-20 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden" data-testid="testimonials-section">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 rounded-full mb-4">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-amber-400 font-medium text-sm uppercase tracking-wide">Client Testimonials</span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            What Our <span className="italic text-amber-400">Clients</span> Say
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Real stories from real families. Discover why hundreds trust us with their most important healthcare equipment needs.
          </p>
        </div>

        {/* Reviews Carousel */}
        <div className="relative">
          {/* Navigation Arrows */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-12 h-12 bg-slate-800/80 hover:bg-slate-700 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex >= reviews.length - 4}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-12 h-12 bg-slate-800/80 hover:bg-slate-700 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Cards Container */}
          <div
            ref={containerRef}
            className="flex gap-6 overflow-x-hidden scroll-smooth px-2 py-4"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {reviews.map((review, index) => (
              <div
                key={review.id || index}
                onClick={() => setSelectedReview(review)}
                className="flex-shrink-0 w-[300px] bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-amber-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/5 cursor-pointer hover:scale-[1.02]"
                style={{ scrollSnapAlign: 'start' }}
              >
                {/* Quote Icon */}
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Quote className="w-6 h-6 text-amber-400" />
                </div>

                {/* Rating & Source */}
                <div className="flex items-center justify-between mb-4">
                  <StarRating rating={review.rating} />
                  {review.source && review.source !== 'Website' && (
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded">
                      {review.source}
                    </span>
                  )}
                </div>

                {/* Review Title */}
                <h3 className="text-white font-semibold text-lg mb-2 line-clamp-1">
                  "{review.title}"
                </h3>

                {/* Review Text */}
                <p className="text-slate-400 text-sm leading-relaxed line-clamp-4 mb-4">
                  {review.text}
                </p>

                {/* Read Full Review Link */}
                <p className="text-amber-400 text-sm font-medium mb-4 flex items-center gap-1">
                  Read Full Review
                  <ChevronRight className="w-4 h-4" />
                </p>

                {/* Reviewer Info */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-700/50">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm flex items-center gap-2">
                      {review.reviewer_title || 'Verified Client'}
                    </p>
                    {review.reviewer_location && (
                      <p className="text-slate-500 text-xs">
                        @ {review.reviewer_location}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex justify-center items-center gap-8 md:gap-16 mt-16 pt-8 border-t border-slate-700/50">
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-amber-400">
              {stats.total_reviews}+
            </div>
            <p className="text-slate-400 text-sm mt-1">Happy Clients</p>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-amber-400">
              {stats.average_rating}
            </div>
            <p className="text-slate-400 text-sm mt-1">Average Rating</p>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-amber-400">
              {stats.recommend_percentage}%
            </div>
            <p className="text-slate-400 text-sm mt-1">Recommend</p>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedReview(null)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-700/50 animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button 
              onClick={() => setSelectedReview(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-slate-700/50 hover:bg-slate-600 rounded-full flex items-center justify-center text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Modal Body */}
            <div className="p-8 md:p-10">
              {/* Quote Icon & Title */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Quote className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight pt-2">
                  "{selectedReview.title}"
                </h3>
              </div>
              
              {/* Rating & Source */}
              <div className="flex items-center gap-4 mb-6">
                <StarRating rating={selectedReview.rating} size="lg" />
                {selectedReview.source && selectedReview.source !== 'Website' && (
                  <span className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-sm font-medium rounded-lg">
                    {selectedReview.source}
                  </span>
                )}
              </div>
              
              {/* Full Review Text */}
              <div className="mb-8">
                <p className="text-slate-300 text-lg leading-relaxed italic">
                  {selectedReview.text}
                </p>
              </div>
              
              {/* Reviewer Info */}
              <div className="flex items-center gap-4 pt-6 border-t border-slate-700/50">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">
                    {selectedReview.reviewer_title || 'Verified Client'}
                  </p>
                  {selectedReview.reviewer_location && (
                    <p className="text-slate-400 text-sm">
                      @ {selectedReview.reviewer_location}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
