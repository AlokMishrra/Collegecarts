import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineBanner(true);
      
      // Hide the "back online" banner after 3 seconds
      setTimeout(() => {
        setShowOnlineBanner(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          className="fixed top-0 left-0 right-0 bg-red-600 text-white py-3 px-4 text-center font-semibold shadow-lg"
          style={{ zIndex: 9999 }}
        >
          <div className="flex items-center justify-center gap-2">
            <span>⚠️</span>
            <span>You're offline. Please check your internet connection.</span>
          </div>
        </motion.div>
      )}
      
      {showOnlineBanner && isOnline && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          className="fixed top-0 left-0 right-0 bg-green-600 text-white py-3 px-4 text-center font-semibold shadow-lg"
          style={{ zIndex: 9999 }}
        >
          <div className="flex items-center justify-center gap-2">
            <span>✅</span>
            <span>Back online!</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
