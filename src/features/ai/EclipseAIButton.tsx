import React from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { Sparkles } from 'lucide-react';

export const EclipseAIButton: React.FC = () => {
  const { isAiSheetOpen, setIsAiSheetOpen } = useAppState();

  return (
    <button
      id="btn-trigger-eclipse-ai"
      onClick={() => setIsAiSheetOpen(!isAiSheetOpen)}
      className="fixed bottom-24 right-4 md:right-auto md:left-4 z-40 p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 ring-2 ring-indigo-500/25 animate-bounce"
    >
      <Sparkles size={20} className="animate-pulse" />
    </button>
  );
};
export default EclipseAIButton;
