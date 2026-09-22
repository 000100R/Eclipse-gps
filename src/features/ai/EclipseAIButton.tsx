import React from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { Sparkles } from 'lucide-react';

export const EclipseAIButton: React.FC = () => {
  const { isAiSheetOpen, setIsAiSheetOpen, activeTab, isNavigating, selectedItem } = useAppState();

  // Hide button when viewing panels or inspecting a pandal card so action buttons are unobstructed
  if (activeTab !== 'home' || selectedItem) {
    return null;
  }

  // Positioning: On mobile, sit on the left (opposite of LocationButton on the right)
  // When navigating: bottom-20 left-3.5 sm:left-4 z-30
  // When on home map: bottom-36 left-3.5 sm:left-4 md:bottom-24 md:left-[416px] z-30
  const posClass = isNavigating
    ? 'bottom-20 left-3.5 sm:left-4 z-30'
    : 'bottom-36 left-3.5 sm:left-4 md:bottom-24 md:left-[416px] z-30';

  return (
    <button
      id="btn-trigger-eclipse-ai"
      onClick={() => setIsAiSheetOpen(!isAiSheetOpen)}
      className={`fixed ${posClass} p-3 sm:p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 ring-2 ring-indigo-500/25 touch-manipulation cursor-pointer flex items-center justify-center`}
      title="Ask Eclipse AI Co-pilot"
      aria-label="Ask Eclipse AI Co-pilot"
    >
      <Sparkles size={18} className="animate-pulse" />
    </button>
  );
};
export default EclipseAIButton;
