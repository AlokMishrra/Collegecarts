import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, X, ChevronRight, Sparkles, Package, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductImage } from "@/components/ui/product-image";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const ratingLabels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

export default function FeedbackPopup({ user }) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewedOrders, setReviewedOrders] = useState([]);
  const [productImages, setProductImages] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Load reviewed orders from localStorage
    const stored = localStorage.getItem(`reviewed_orders_${user.id}`);
    if (stored) {
      setReviewedOrders(JSON.parse(stored));
    }

    checkForDeliveredOrders();
    const interval = setInterval(checkForDeliveredOrders, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const checkForDeliveredOrders = async () => {
    if (!user) return;

    try {
      const orders = await base44.entities.Order.filter({
        user_id: user.id,
        status: "delivered"
      });

      const stored = localStorage.getItem(`reviewed_orders_${user.id}`);
      const reviewed = stored ? JSON.parse(stored) : [];
      
      const unreviewed = orders.filter(order => !reviewed.includes(order.id));
      
      if (unreviewed.length > 0 && !showFeedback) {
        setCurrentOrder(unreviewed[0]);
        setCurrentProductIndex(0);

        // Fetch product images for all items in this order
        const imgMap = {};
        for (const item of unreviewed[0].items || []) {
          try {
            const prods = await base44.entities.Product.filter({ id: item.product_id });
            if (prods[0]?.image_url) {
              imgMap[item.product_id] = prods[0].image_url;
            }
          } catch (_) {}
        }
        setProductImages(imgMap);
        setShowFeedback(true);
      }
    } catch (error) {
      // Silently fail
    }
  };

  const handleSubmitFeedback = async () => {
    if (!currentOrder || rating === 0) return;

    setSubmitting(true);
    try {
      const currentProduct = currentOrder.items[currentProductIndex];
      
      await base44.entities.Review.create({
        product_id: currentProduct.product_id,
        user_id: user.id,
        rating: rating,
        comment: comment || null
      });

      // Move to next product or finish
      if (currentProductIndex < currentOrder.items.length - 1) {
        setCurrentProductIndex(currentProductIndex + 1);
        setRating(0);
        setComment("");
      } else {
        // Show success animation
        setShowSuccess(true);
        
        // Mark order as reviewed
        const newReviewedOrders = [...reviewedOrders, currentOrder.id];
        setReviewedOrders(newReviewedOrders);
        localStorage.setItem(`reviewed_orders_${user.id}`, JSON.stringify(newReviewedOrders));
        
        setTimeout(() => {
          setShowSuccess(false);
          setShowFeedback(false);
          setCurrentOrder(null);
          setCurrentProductIndex(0);
          setRating(0);
          setComment("");
          setTimeout(checkForDeliveredOrders, 1000);
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    }
    setSubmitting(false);
  };

  const handleSkipOrder = () => {
    if (!currentOrder) return;
    
    const newReviewedOrders = [...reviewedOrders, currentOrder.id];
    setReviewedOrders(newReviewedOrders);
    localStorage.setItem(`reviewed_orders_${user.id}`, JSON.stringify(newReviewedOrders));
    
    setShowFeedback(false);
    setCurrentOrder(null);
    setCurrentProductIndex(0);
    setRating(0);
    setComment("");
    
    setTimeout(checkForDeliveredOrders, 1000);
  };

  if (!showFeedback || !currentOrder) return null;

  const currentProduct = currentOrder.items[currentProductIndex];
  const totalProducts = currentOrder.items.length;
  const progressPercent = ((currentProductIndex + 1) / totalProducts) * 100;
  const activeRating = hoveredRating || rating;
  const productImage = productImages[currentProduct.product_id];

  return (
    <Dialog open={showFeedback} onOpenChange={(open) => !open && handleSkipOrder()}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-0 shadow-2xl rounded-3xl bg-white">
        <VisuallyHidden>
          <DialogTitle>Product Feedback</DialogTitle>
        </VisuallyHidden>
        <AnimatePresence mode="wait">
          {showSuccess ? (
            /* ─── Success State ─── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 px-6"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 10, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center mb-4 shadow-lg"
              >
                <Sparkles className="w-8 h-8 text-white" />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg font-bold text-gray-900 mb-1"
              >
                Thank You! 🎉
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-gray-500 text-center"
              >
                Your feedback helps us improve!
              </motion.p>
            </motion.div>
          ) : (
            /* ─── Rating Form ─── */
            <motion.div
              key={`product-${currentProductIndex}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              {/* ─── Header ─── */}
              <div className="relative bg-white px-5 pt-4 pb-3">
                {/* Close button */}
                <button
                  onClick={handleSkipOrder}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>

                {/* Header with checkmark */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900">
                      Product {currentProductIndex + 1} of {totalProducts}
                    </h3>
                    <p className="text-xs text-gray-500">Your order has been delivered</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-emerald-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* ─── Product Info ─── */}
              <div className="px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {/* Product image */}
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-emerald-50 flex-shrink-0 flex items-center justify-center">
                    {productImage ? (
                      <ProductImage
                        src={productImage}
                        alt={currentProduct.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-2 mb-2">
                      {currentProduct.product_name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                        Qty: {currentProduct.quantity}
                      </span>
                      {currentProduct.price && (
                        <span className="text-xs text-white font-semibold bg-emerald-600 px-2.5 py-1 rounded-full">
                          ₹{(currentProduct.price * currentProduct.quantity).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Rating Section ─── */}
              <div className="px-5 pt-4 pb-3">
                <h4 className="text-lg font-bold text-gray-900 text-center mb-1">
                  How was this product?
                </h4>
                <p className="text-xs text-gray-500 text-center mb-4 flex items-center justify-center gap-1">
                  Your feedback helps us improve 💚
                </p>
                
                {/* Stars with labels */}
                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="focus:outline-none flex flex-col items-center gap-1.5"
                    >
                      <Star
                        className={`w-10 h-10 transition-all duration-200 ${
                          star <= (hoveredRating || rating)
                            ? "fill-emerald-600 text-emerald-600"
                            : "text-emerald-600 fill-none stroke-2"
                        }`}
                      />
                      <span className={`text-[10px] font-medium transition-colors ${
                        star <= (hoveredRating || rating)
                          ? "text-gray-900"
                          : "text-gray-400"
                      }`}>
                        {ratingLabels[star]}
                      </span>
                    </motion.button>
                  ))}
                </div>

                {/* Comment */}
                <div className="relative">
                  <Textarea
                    placeholder="Tell us about your experience... (optional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="resize-none rounded-xl border-gray-200 bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-all text-sm"
                  />
                  <span className="absolute bottom-2.5 right-2.5 text-[10px] text-gray-400">
                    {comment.length}/500
                  </span>
                </div>

                {/* Privacy notice */}
                <div className="mt-3 flex items-start gap-2 bg-emerald-50 rounded-xl p-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-600/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Your feedback is private and helps us serve you better.
                  </p>
                </div>
              </div>

              {/* ─── Action Buttons ─── */}
              <div className="px-5 pb-5 pt-2 flex gap-3">
                <Button
                  variant="ghost"
                  onClick={handleSkipOrder}
                  className="flex-1 h-11 rounded-xl text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-semibold text-sm transition-all"
                >
                  Skip All
                </Button>
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={rating === 0 || submitting}
                  className={`flex-1 h-11 rounded-xl font-semibold text-sm shadow-lg transition-all duration-300 ${
                    rating > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-gray-100 text-gray-400 shadow-none cursor-not-allowed"
                  }`}
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Submit Feedback</span>
                    </div>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}