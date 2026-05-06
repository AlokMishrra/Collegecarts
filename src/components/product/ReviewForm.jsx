import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Send, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDialog } from "@/components/ui/alert-dialog-custom";

const ratingLabels = ["", "😞 Poor", "😐 Fair", "🙂 Good", "😊 Very Good", "🤩 Excellent"];
const ratingEmojis = ["", "😞", "😐", "🙂", "😊", "🤩"];

export default function ReviewForm({ product, user, order, onReviewSubmitted }) {
  const { warning, error } = useDialog();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const activeRating = hoveredRating || rating;

  const handleSubmit = async () => {
    if (rating === 0) {
      await warning("Please select a rating before submitting your review", "Rating Required");
      return;
    }

    setIsSubmitting(true);
    try {
      await base44.entities.Review.create({
        product_id: product.id,
        user_id: user.id,
        user_name: user.full_name || "Anonymous",
        rating: rating,
        comment: comment.trim(),
        order_id: order?.id,
        is_approved: false // Requires admin approval
      });

      await base44.entities.Notification.create({
        user_id: user.id,
        title: "Review Submitted",
        message: `Your review for ${product.name} has been submitted and is awaiting moderation.`,
        type: "success"
      });

      // Notify admin
      try {
        const admins = await base44.entities.User.filter({ role: "admin" });
        for (const admin of admins) {
          await base44.entities.Notification.create({
            user_id: admin.id,
            title: "New Review Pending",
            message: `${user.full_name} submitted a review for ${product.name}`,
            type: "info"
          });
        }
      } catch (err) {
        console.log("Could not notify admins");
      }

      setSubmitted(true);
      setRating(0);
      setComment("");
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err) {
      console.error("Error submitting review:", err);
      await error("Failed to submit review. Please try again.", "Submission Failed");
    }
    setIsSubmitting(false);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10, delay: 0.2 }}
          className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center"
        >
          <Sparkles className="w-8 h-8 text-emerald-600" />
        </motion.div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Review Submitted!</h3>
        <p className="text-sm text-gray-500">
          Thank you for your feedback. It will be visible after admin approval.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/80 p-6 sm:p-8"
    >
      {/* Decorative accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Star className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Write a Review</h3>
          <p className="text-xs text-gray-500">Share your experience with {product?.name}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Star Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            How would you rate this product?
          </label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <motion.button
                key={star}
                type="button"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className="relative p-1 rounded-lg transition-colors hover:bg-yellow-50"
              >
                <Star
                  className={`w-9 h-9 transition-all duration-200 ${
                    star <= activeRating
                      ? "fill-yellow-400 text-yellow-400 drop-shadow-sm"
                      : "text-gray-200 hover:text-gray-300"
                  }`}
                />
              </motion.button>
            ))}
          </div>

          {/* Rating label animation */}
          <AnimatePresence mode="wait">
            {activeRating > 0 && (
              <motion.div
                key={activeRating}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="mt-2 flex items-center gap-1.5"
              >
                <span className="text-2xl">{ratingEmojis[activeRating]}</span>
                <span className="text-sm font-medium text-gray-700">
                  {ratingLabels[activeRating].replace(/^.+\s/, '')}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Review <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you like or dislike? Would you recommend it?"
            rows={4}
            maxLength={500}
            className="resize-none border-gray-200 focus:border-emerald-400 focus:ring-emerald-400/20 rounded-xl bg-white"
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-gray-400">
              {comment.length}/500 characters
            </p>
            {comment.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-emerald-500 font-medium"
              >
                Great, keep going! ✍️
              </motion.p>
            )}
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200/50 transition-all duration-300 disabled:opacity-50 disabled:shadow-none"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Submit Review
            </div>
          )}
        </Button>

        <p className="text-xs text-gray-400 text-center">
          Your review will be visible after admin approval
        </p>
      </div>
    </motion.div>
  );
}