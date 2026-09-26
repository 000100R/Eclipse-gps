import React, { useState, useEffect } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { Sparkles } from 'lucide-react';

export const EclipseAIButton: React.FC = () => {
  const { isAiSheetOpen, setIsAiSheetOpen, activeTab, isNavigating, selectedItem } = useAppState();

  const [isExplorerExpanded, setIsExplorerExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eclipse_pandal_explorer_expanded');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 768;
    }
    return false;
  });

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ expanded: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.expanded === 'boolean') {
        setIsExplorerExpanded(customEvent.detail.expanded);
      }
    };
    window.addEventListener('eclipse-pandal-explorer-toggle', handleToggle);
    return () => window.removeEventListener('eclipse-pandal-explorer-toggle', handleToggle);
  }, []);

  // Hide button when viewing secondary panels, inspecting a pandal card, or when Pandal Explorer is expanded on mobile
  if (activeTab !== 'home' || selectedItem || (isExplorerExpanded && typeof window !== 'undefined' && window.innerWidth < 768)) {
    return null;
  }

  return (
    <button
      id="btn-trigger-eclipse-ai"
      onClick={() => setIsAiSheetOpen(!isAiSheetOpen)}
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8.5rem)',
        left: 'calc(env(safe-area-inset-left, 0px) + 0.875rem)',
      }}
      className="fixed z-30 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 ring-2 ring-indigo-500/25 touch-manipulation cursor-pointer flex items-center justify-center md:left-[416px] md:bottom-24"
      title="Ask Eclipse AI Co-pilot"
      aria-label="Ask Eclipse AI Co-pilot"
    >
      <Sparkles size={18} className="animate-pulse" />
    </button>
  );
};
export default EclipseAIButton;
