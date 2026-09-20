import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Send, Sparkles, AlertCircle, Compass, HelpCircle } from 'lucide-react';
import { PandalCardList } from '../pandals/PandalCardList';
import { BonediBariCardList } from '../bonediBari/BonediBariCardList';
import { MetroGateCopilotCard } from '../map/MetroGateCopilotCard';

export const EclipseAIChat: React.FC = () => {
  const {
    messages,
    isAiLoading,
    askEclipseAI,
    isAiSheetOpen,
    setIsAiSheetOpen,
  } = useAppState();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAiLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isAiLoading) return;
    const txt = input;
    setInput('');
    await askEclipseAI(txt);
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (isAiLoading) return;
    await askEclipseAI(prompt);
  };

  const quickPrompts = [
    'Which metro exit should I take for this pandal?',
    'Plan my Puja route',
    'Take me to the nearest pandal',
    'Show nearby pandals',
    'Show unvisited pandals',
    'Show Bonedi Bari near me',
    'Plan a Bonedi Bari tour',
    'Suggest a low-crowd route',
    'Navigate to Sreebhumi',
    'List active traffic alerts',
  ];

  // Helper to format response text safely without heavy markdown engines
  const formatMsgContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      let content: React.ReactNode = line;

      // Handle bold **text**
      if (line.includes('**')) {
        const parts = line.split('**');
        content = parts.map((part, index) => 
          index % 2 === 1 ? <strong key={index} className="text-neutral-100 font-bold">{part}</strong> : part
        );
      }

      // Handle bullet list items
      if (line.trim().startsWith('* ')) {
        return (
          <li key={i} className="ml-4 list-disc text-neutral-300 text-xs mt-1 leading-relaxed">
            {line.trim().substring(2)}
          </li>
        );
      }

      // Handle standard line spacing
      return (
        <p key={i} className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
          {content}
        </p>
      );
    });
  };

  return (
    <BottomSheet
      isOpen={isAiSheetOpen}
      onClose={() => setIsAiSheetOpen(false)}
      title="Eclipse AI Co-pilot"
      id="eclipse-ai-chat-drawer"
    >
      <div className="flex flex-col h-[60vh] md:h-[65vh]">
        {/* Messages Log Panel */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-4">
          {messages.map((msg) => {
            const isAI = msg.role === 'assistant';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}
              >
                {/* Bubble card */}
                <div
                  className={`max-w-[85%] px-3 py-2.5 rounded-2xl ${
                    isAI
                      ? 'bg-neutral-900 border border-neutral-800 rounded-tl-sm'
                      : 'bg-indigo-600 text-white rounded-tr-sm'
                  }`}
                >
                  {/* Sender Eyebrow label */}
                  <div className="flex items-center space-x-1.5 mb-1 text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                    <Sparkles size={10} className={isAI ? 'text-indigo-400' : 'text-neutral-300'} />
                    <span>{isAI ? 'Eclipse AI' : 'Navigator'}</span>
                  </div>

                  {/* Body text */}
                  <div className="space-y-1">
                    {formatMsgContent(msg.content)}
                  </div>

                  {/* Discovered Durga Puja Pandals */}
                  {msg.discoveredPandals && msg.discoveredPandals.length > 0 && (
                    <PandalCardList
                      pandals={msg.discoveredPandals}
                      onActionComplete={() => setIsAiSheetOpen(false)}
                    />
                  )}

                  {/* Discovered Bonedi Bari Heritage Houses */}
                  {msg.discoveredBonediBaris && msg.discoveredBonediBaris.length > 0 && (
                    <BonediBariCardList
                      bonediBaris={msg.discoveredBonediBaris}
                      onActionComplete={() => setIsAiSheetOpen(false)}
                    />
                  )}

                  {/* Metro Gate Recommendation Card */}
                  {msg.metroGateResult && (
                    <MetroGateCopilotCard
                      result={msg.metroGateResult}
                      onNavigateStart={() => setIsAiSheetOpen(false)}
                    />
                  )}

                  {/* Operational Action Chip */}
                  {isAI && msg.action && msg.action.type !== 'NO_ACTION' && (
                    <div className="mt-3 inline-flex items-center space-x-1.5 bg-indigo-505/10 border border-indigo-500/20 px-2 py-0.5 rounded-md text-[9px] font-bold text-indigo-400 uppercase tracking-wider">
                      <Compass size={10} />
                      <span>Action: {msg.action.type}</span>
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <span className="text-[9px] text-neutral-600 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}

          {/* Assistant Generation indicator */}
          {isAiLoading && (
            <div className="flex items-start space-x-2 p-3 bg-neutral-900/40 rounded-xl border border-neutral-900 animate-pulse">
              <div className="flex space-x-1 mt-1">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="text-[11px] text-neutral-500 italic">Eclipse AI is computing map parameters...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Quick Chips */}
        {messages.length <= 1 && !isAiLoading && (
          <div className="py-2 border-t border-neutral-900">
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Quick Commands</p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickPrompt(p)}
                  className="text-[10px] font-semibold text-neutral-400 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-2.5 py-1.5 rounded-lg transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Action input deck */}
        <form onSubmit={handleSend} className="flex items-center space-x-2 border-t border-neutral-900 pt-3 bg-neutral-950">
          <input
            id="ai-prompt-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI co-pilot..."
            disabled={isAiLoading}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
          />
          <button
            id="btn-send-ai-prompt"
            type="submit"
            disabled={!input.trim() || isAiLoading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </BottomSheet>
  );
};
export default EclipseAIChat;
