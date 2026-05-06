import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { User } from "@/entities/User";
import { Star, User as UserIcon, ThumbsUp, MessageSquare, TrendingUp, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import ReviewForm from "./ReviewForm";

// Rating distribution bar
function RatingBar({ star, count, total }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-3 text-gray-600 font-medium">{star}</span>
      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: (5 - star) * 0.1 }}
          className="h-full rounded-full"
          style={{
            background: star >= 4 ? 'linear-gradient(90deg, #10b981, #059669)' :
                         star === 3 ? 'linear-gradient(90deg, #f59e0b, #d97706)' :
                                      'linear-gradient(90deg, #ef4444, #dc2626)'
          }}
        />
      </div>
      <span className="w-8 text-right text-xs text-gray-500">{count}</span>
    </div>
  );
}

// Individual review card
function ReviewCard({ review, index }) {
  const ratingLabels = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Great", 5: "Excellent" };
  const ratingColors = {
    1: "bg-red-100 text-red-700",
    2: "bg-orange-100 text-orange-700",
    3: "bg-yellow-100 text-yellow-700",
    4: "bg-emerald-100 text-emerald-700",
    5: "bg-emerald-100 text-emerald-700"
  };

  const timeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Generate avatar initials and color
  const initials = (review.user_name || "A")
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avatarColors = [
    "from-violet-500 to-purple-600",
    "from-emerald-500 to-teal-600",
    "from-blue-500 to-indigo-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-cyan-500 to-sky-600",
  ];
  const avatarColor = avatarColors[(review.user_name || "").length % avatarColors.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group"
    >
      <div className="relative p-5 rounded-2xl bg-white border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all duration-300">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <span className="text-white text-sm font-bold">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{review.user_name}</p>
                  <Badge className={`${ratingColors[review.rating]} text-[10px] px-1.5 py-0 h-5 font-semibold border-0`}>
                    {ratingLabels[review.rating]}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {timeAgo(review.created_date)}
                </p>
              </div>

              {/* Star rating */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 transition-colors ${
                      star <= review.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Review text */}
            {review.comment && (
              <p className="text-gray-700 leading-relaxed text-sm mt-2">
                {review.comment}
              </p>
            )}

            {/* Admin response */}
            {review.admin_response && (
              <div className="mt-3 p-3 bg-blue-50/80 rounded-xl border border-blue-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-700">CollegeCart Team</span>
                </div>
                <p className="text-sm text-blue-800">{review.admin_response}</p>
              </div>
            )}

            {/* Verified purchase badge */}
            {review.order_id && (
              <div className="flex items-center gap-1 mt-3">
                <Shield className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">
                  Verified Purchase
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ReviewSection({ productId, product }) {
  const [reviews, setReviews] = useState([]);
  const [user, setUser] = useState(null);
  const [userHasPurchased, setUserHasPurchased] = useState(false);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReviews();
    checkUserPurchase();
  }, [productId]);

  const checkUserPurchase = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      // Check if user has purchased this product
      const userOrders = await base44.entities.Order.filter({
        user_id: currentUser.id,
        status: "delivered"
      });

      const hasPurchased = userOrders.some(order =>
        order.items?.some(item => item.product_id === productId)
      );
      setUserHasPurchased(hasPurchased);

      // Check if user already reviewed
      const userReviews = await base44.entities.Review.filter({
        user_id: currentUser.id,
        product_id: productId
      }).catch(() => []);
      setUserHasReviewed(userReviews.length > 0);
    } catch (error) {
      // User not logged in — that's fine
    }
  };

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const productReviews = await base44.entities.Review.filter(
        { product_id: productId, is_approved: true },
        '-created_date'
      ).catch(() => []);
      setReviews(productReviews);
    } catch (error) {
      console.error("Error loading reviews:", error);
      setReviews([]);
    }
    setIsLoading(false);
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  // Calculate rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length
  }));

  const ratingColor = averageRating >= 4 ? "text-emerald-600" :
                      averageRating >= 3 ? "text-yellow-600" :
                      averageRating >= 2 ? "text-orange-600" : "text-red-600";

  return (
    <div className="space-y-6">
      {/* Review Form - Only for users who purchased and haven't reviewed */}
      {user && userHasPurchased && !userHasReviewed && (
        <ReviewForm
          product={product}
          user={user}
          onReviewSubmitted={() => {
            setUserHasReviewed(true);
            loadReviews();
          }}
        />
      )}

      {user && userHasPurchased && userHasReviewed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Thank you for your review!
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Your feedback is awaiting approval and will be visible soon
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {user && !userHasPurchased && !userHasReviewed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Purchase to review
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  You can review products after your order has been delivered
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Reviews Summary + List */}
      <Card className="overflow-hidden border-0 shadow-sm">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold">Customer Reviews</h3>
            </div>
            {reviews.length > 0 && (
              <Badge className="bg-white/10 text-white border-white/20 backdrop-blur-sm">
                {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {reviews.length > 0 ? (
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Big rating number */}
              <div className="flex flex-col items-center justify-center">
                <span className={`text-5xl font-bold ${ratingColor.replace('text-', 'text-white/')}`} style={{ color: 'white' }}>
                  {averageRating.toFixed(1)}
                </span>
                <div className="flex items-center gap-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-white/20"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-white/60 text-xs mt-1">
                  {reviews.length} rating{reviews.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Rating distribution bars */}
              <div className="flex-1 space-y-1.5">
                {ratingDistribution.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2 text-sm">
                    <span className="w-3 text-white/70 font-medium text-xs">{star}</span>
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${reviews.length > 0 ? (count / reviews.length) * 100 : 0}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: (5 - star) * 0.1 }}
                        className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-400"
                      />
                    </div>
                    <span className="w-6 text-right text-xs text-white/50">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-white/60 text-sm">No reviews yet</p>
            </div>
          )}
        </div>

        {/* Reviews List */}
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex gap-4 p-4">
                  <div className="w-11 h-11 bg-gray-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {reviews.map((review, index) => (
                  <ReviewCard key={review.id} review={review} index={index} />
                ))}
              </AnimatePresence>

              {reviews.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center">
                    <MessageSquare className="w-10 h-10 text-gray-300" />
                  </div>
                  <h4 className="font-semibold text-gray-700 mb-1">No reviews yet</h4>
                  <p className="text-sm text-gray-400 max-w-xs mx-auto">
                    Be the first to share your experience with this product!
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}