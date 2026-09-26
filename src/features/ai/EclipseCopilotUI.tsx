import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, X, Sparkles, AlertCircle, RefreshCw, Compass } from 'lucide-react';
import { askEclipseCopilotStructured } from '../../services/gemini/copilotService';
import { useAppState } from '../../hooks/AppStateProvider';
import { PandalCardList } from '../pandals/PandalCardList';
import { DiscoveredPandal } from '../../types/discovery';
import { MetroGateCopilotCard } from '../map/MetroGateCopilotCard';
import { MetroGateIntelligenceResult } from '../../types/metro';

interface Message {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  timestamp: number;
  discoveredPandals?: DiscoveredPandal[];
  metroGateResult?: MetroGateIntelligenceResult;
}

export const EclipseCopilotUI: React.FC = () => {
  const { currentLocation, hasValidGps, gpsStatus, executeAIActionOnMap, activeTab, selectedItem, isNavigating } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const shouldShowFloatingButton =
    activeTab === 'home' &&
    !selectedItem &&
    !isOpen &&
    !(isExplorerExpanded && typeof window !== 'undefined' && window.innerWidth < 768);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'gemini',
      text: 'Hello! I am your Eclipse GPS Copilot. I can search Durga Puja pandals, calculate real-time road routes, and help you navigate Kolkata. Ask me "Show nearby pandals" or search for a specific puja!',
      timestamp: Date.now(),
    },
  ]);

  const quickPrompts = [
    'Which metro exit should I take for this pandal?',
    'Plan my Puja route',
    'Take me to the nearest pandal',
    'Show unvisited pandals',
    'Show nearby pandals',
    'Which pandals are less crowded right now?',
    'Is traffic heavy near Bagbazar?',
    'Should I go to College Square now or later?',
    'Plan a 4-pandal tour',
  ];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat panel on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const sendPrompt = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userText = textToSend.trim();
    setInput('');
    setError(null);

    // Add user message
    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await askEclipseCopilotStructured(userText, currentLocation);
      setError(null);

      let discoveredPandals: DiscoveredPandal[] | undefined = undefined;
      let metroGateResult: MetroGateIntelligenceResult | undefined = undefined;
      let finalResponseText = response.text;

      if (response.action) {
        const actionResult = await executeAIActionOnMap(response.action, response.parameters || {});
        if (actionResult?.error) {
          finalResponseText = actionResult.error;
        } else {
          if (actionResult?.message) {
            finalResponseText = actionResult.message;
          }
          if (actionResult?.pandals && actionResult.pandals.length > 0) {
            discoveredPandals = actionResult.pandals;
          }
          if (actionResult?.metroGateResult) {
            metroGateResult = actionResult.metroGateResult;
          }
          if (response.action === 'NAVIGATE_TO_NEAREST_PANDAL' || response.action === 'NAVIGATE_TO' || response.action === 'PLAN_PUJA_ROUTE') {
            setIsOpen(false);
          }
        }
      }

      const copilotMsg: Message = {
        id: `msg-gemini-${Date.now()}`,
        sender: 'gemini',
        text: finalResponseText,
        timestamp: Date.now(),
        discoveredPandals,
        metroGateResult,
      };

      setMessages((prev) => [...prev, copilotMsg]);
    } catch (err: any) {
      const errMsg = err?.message || 'Gemini server/API route failure.';
      setError(errMsg);

      const copilotMsg: Message = {
        id: `msg-gemini-err-${Date.now()}`,
        sender: 'gemini',
        text: errMsg,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, copilotMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await sendPrompt(input);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'gemini',
        text: 'Chat history cleared. I am ready for your next request!',
        timestamp: Date.now(),
      },
    ]);
    setError(null);
  };

  const formatMessageText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      let content: React.ReactNode = line;

      // Simple Markdown Bold formatting (**text**)
      if (line.includes('**')) {
        const parts = line.split('**');
        content = parts.map((part, index) =>
          index % 2 === 1 ? (
            <strong key={index} className="text-neutral-100 font-bold">
              {part}
            </strong>
          ) : (
            part
          )
        );
      }

      // Handle bullet lists
      if (line.trim().startsWith('* ')) {
        return (
          <li key={i} className="ml-4 list-disc text-neutral-300 text-xs mt-1 leading-relaxed">
            {line.trim().substring(2)}
          </li>
        );
      }

      return (
        <p key={i} className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
          {content}
        </p>
      );
    });
  };

  return (
    <>
      {/* Floating Eclipse Copilot Launch Button */}
      {shouldShowFloatingButton && (
        <button
          id="btn-trigger-eclipse-copilot"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8.5rem)',
            left: 'calc(env(safe-area-inset-left, 0px) + 4.5rem)',
          }}
          className="fixed z-30 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 ring-2 ring-emerald-500/20 animate-bounce md:left-[476px] md:bottom-24"
          title="Eclipse Copilot"
        >
          <Bot size={20} className="animate-pulse" />
        </button>
      )}

      {/* Slide-Up Chat Panel / Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Dark Transparent Backdrop on Mobile Only */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs"
            />

            {/* Chat Panel Sheet */}
            <motion.div
              id="eclipse-copilot-chat-panel"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950 border-t border-neutral-800 rounded-t-2xl shadow-2xl overflow-hidden max-h-[80vh] md:max-h-[85vh] flex flex-col md:left-auto md:right-4 md:bottom-20 md:top-24 md:w-96 md:rounded-2xl md:border md:border-neutral-800"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900 bg-neutral-900/40">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-6 rounded-full bg-emerald-500 animate-pulse" />
                  <Bot size={18} className="text-emerald-400" />
                  <h3 className="font-semibold text-neutral-100 text-sm tracking-wide">
                    Eclipse Copilot
                  </h3>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    id="btn-clear-copilot-chat"
                    onClick={handleClearChat}
                    title="Clear Chat"
                    className="p-1 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 transition-colors"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    id="btn-close-copilot"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Error Message Header Banner */}
              {error && (
                <div className="bg-red-950/80 border-b border-red-900/50 px-4 py-2.5 flex items-start space-x-2">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-red-300 leading-relaxed font-medium">
                    {error}
                  </span>
                </div>
              )}

              {/* Chat Message List Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-neutral-950/50">
                {messages.map((msg) => {
                  const isCopilot = msg.sender === 'gemini';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCopilot ? 'items-start' : 'items-end'}`}
                    >
                      {/* Message Bubble Card */}
                      <div
                        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl ${
                          isCopilot
                            ? 'bg-neutral-900 border border-neutral-800 rounded-tl-sm'
                            : 'bg-emerald-600 text-white rounded-tr-sm shadow-md shadow-emerald-900/10'
                        }`}
                      >
                        {/* Header Label inside Bubble */}
                        <div className="flex items-center space-x-1.5 mb-1 text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                          {isCopilot ? (
                            <>
                              <Sparkles size={9} className="text-emerald-400 animate-pulse" />
                              <span className="text-emerald-500">Eclipse Copilot</span>
                            </>
                          ) : (
                            <>
                              <Bot size={9} className="text-neutral-300" />
                              <span className="text-neutral-400">You</span>
                            </>
                          )}
                        </div>

                        {/* Text Content */}
                        <div className="space-y-1">{formatMessageText(msg.text)}</div>

                        {/* Discovered Durga Puja Pandal Cards */}
                        {msg.discoveredPandals && msg.discoveredPandals.length > 0 && (
                          <PandalCardList
                            pandals={msg.discoveredPandals}
                            onActionComplete={() => setIsOpen(false)}
                          />
                        )}

                        {/* Metro Gate Recommendation Card */}
                        {msg.metroGateResult && (
                          <MetroGateCopilotCard
                            result={msg.metroGateResult}
                            onNavigateStart={() => setIsOpen(false)}
                          />
                        )}
                      </div>

                      {/* Message Timestamp */}
                      <span className="text-[9px] text-neutral-600 mt-1 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}

                {/* Loading State Animation */}
                {isLoading && (
                  <div className="flex items-start space-x-2.5 p-3 bg-neutral-900/30 rounded-xl border border-neutral-900/50 animate-pulse w-[80%]">
                    <div className="flex space-x-1 mt-1.5 shrink-0">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                    <span className="text-[11px] text-neutral-500 italic">
                      Eclipse Copilot is discovering pandals & routing...
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestions */}
              {!isLoading && (
                <div className="px-3 py-2 border-t border-neutral-900/80 flex flex-wrap gap-1.5 bg-neutral-950/90">
                  {quickPrompts.map((promptText) => (
                    <button
                      key={promptText}
                      type="button"
                      onClick={() => sendPrompt(promptText)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-neutral-900/80 border border-neutral-800 text-neutral-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              )}

              {/* Text Input Form Area */}
              <form
                onSubmit={handleSend}
                className="flex items-center space-x-2 border-t border-neutral-900 p-3 bg-neutral-950"
              >
                <input
                  id="copilot-text-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Eclipse Copilot..."
                  disabled={isLoading}
                  autoComplete="off"
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 transition-colors"
                />
                <button
                  id="btn-copilot-send"
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-900/20"
                >
                  <Send size={14} />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default EclipseCopilotUI;
