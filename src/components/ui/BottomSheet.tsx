import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  id?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children, id }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (hidden on desktop to let user use the map) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs"
          />

          {/* Sheet Container */}
          <motion.div
            id={id}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950 border-t border-neutral-800 rounded-t-2xl shadow-2xl overflow-hidden max-h-[85vh] md:max-h-[92vh] flex flex-col md:right-auto md:left-4 md:bottom-20 md:top-24 md:w-96 md:rounded-2xl md:border md:border-neutral-800"
          >
            {/* Grab Handle / Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900 bg-neutral-900/40">
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-6 rounded-full bg-indigo-500" />
                <h3 className="font-semibold text-neutral-100 text-sm tracking-wide">{title || 'Details'}</h3>
              </div>
              <button
                id="btn-close-sheet"
                onClick={onClose}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
