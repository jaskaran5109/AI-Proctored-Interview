import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageCircle, Send, ChevronRight, ChevronLeft, 
  Sparkles, AlertTriangle, Lightbulb, Code, HelpCircle
} from 'lucide-react';
import { useAIAssistantStore } from '@/stores/aiAssistantStore';
import { motion, AnimatePresence } from 'framer-motion';

// Query intent icons and labels
const INTENT_CONFIG = {
  concept_clarification: { icon: Lightbulb, label: 'Concept', color: 'text-green-600' },
  approach_guidance: { icon: HelpCircle, label: 'Approach', color: 'text-blue-600' },
  full_answer_request: { icon: AlertTriangle, label: 'Full Answer', color: 'text-red-600' },
  debugging: { icon: Code, label: 'Debug', color: 'text-yellow-600' },
  general: { icon: MessageCircle, label: 'General', color: 'text-gray-600' }
};

function ChatMessage({ message, isLast }) {
  const isUser = message.role === 'user';
  const intentConfig = INTENT_CONFIG[message.queryIntent] || INTENT_CONFIG.general;
  const IntentIcon = intentConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        className={`max-w-[85%] ${
          isUser
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-900 border border-gray-200'
        } p-3 text-sm`}
      >
        {!isUser && message.queryIntent && (
          <div className={`flex items-center gap-1 mb-2 text-xs ${intentConfig.color}`}>
            <IntentIcon className="w-3 h-3" />
            <span className="font-medium">{intentConfig.label}</span>
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <p className={`text-xs mt-2 ${isUser ? 'text-gray-400' : 'text-gray-500'}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </motion.div>
  );
}

export default function AIAssistantPanel({ 
  accessToken, 
  questionId, 
  questionText,
  isCollapsed,
  onToggle 
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  
  const { 
    chatHistory, 
    isLoading, 
    error, 
    messagesRemaining,
    sendMessage, 
    loadChatHistory,
    clearError 
  } = useAIAssistantStore();

  // Load chat history when question changes
  useEffect(() => {
    if (questionId && accessToken) {
      loadChatHistory(accessToken, questionId);
    }
  }, [questionId, accessToken, loadChatHistory]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || messagesRemaining <= 0) return;

    const message = input.trim();
    setInput('');
    
    try {
      await sendMessage(accessToken, questionId, message);
    } catch (err) {
      // Error handled in store
    }
  }, [input, isLoading, messagesRemaining, accessToken, questionId, sendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Quick prompts
  const quickPrompts = [
    { text: "Explain this concept", icon: Lightbulb },
    { text: "How should I approach this?", icon: HelpCircle },
    { text: "Give me an example", icon: Code }
  ];

  if (isCollapsed) {
    return (
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 48 }}
        className="h-full border-l border-gray-200 bg-gray-50 flex flex-col items-center py-4"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="mb-4"
          data-testid="expand-assistant-btn"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="writing-mode-vertical text-xs font-medium text-gray-500 rotate-180">
          AI Assistant
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-xs text-gray-400">{messagesRemaining}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: '100%' }}
      className="h-full border-l border-gray-200 bg-white flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-sm">AI Assistant</h3>
          <Badge variant="outline" className="text-xs">
            {messagesRemaining} left
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          data-testid="collapse-assistant-btn"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Info Banner */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
        <p className="flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Ask for clarifications. Your usage will be analyzed for authenticity.
        </p>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {chatHistory.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-2">
              Need help understanding a concept?
            </p>
            <p className="text-xs text-gray-400">
              Ask me for clarifications, examples, or guidance.
            </p>
            
            {/* Quick Prompts */}
            <div className="mt-4 space-y-2">
              {quickPrompts.map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="text-xs w-full justify-start"
                  onClick={() => setInput(prompt.text)}
                >
                  <prompt.icon className="w-3 h-3 mr-2" />
                  {prompt.text}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {chatHistory.map((msg, idx) => (
              <ChatMessage 
                key={`${msg.timestamp}-${idx}`} 
                message={msg}
                isLast={idx === chatHistory.length - 1}
              />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-3">
                <div className="bg-gray-100 border border-gray-200 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-red-50 border-t border-red-100"
          >
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {error}
              <Button variant="ghost" size="sm" onClick={clearError} className="ml-auto text-xs">
                Dismiss
              </Button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {messagesRemaining <= 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">
              You&apos;ve reached the message limit for this question.
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="min-h-[60px] max-h-[120px] resize-none text-sm border-gray-300"
              disabled={isLoading}
              data-testid="assistant-input"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || messagesRemaining <= 0}
              className="bg-gray-900 hover:bg-gray-800 text-white self-end"
              data-testid="assistant-send-btn"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
