import { create } from 'zustand';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
axios.defaults.withCredentials = true;

// Chat message type
export const useAIAssistantStore = create((set, get) => ({
  chatHistory: [],
  isLoading: false,
  error: null,
  messagesRemaining: 10,
  currentQuestionId: null,

  setCurrentQuestion: (questionId) => {
    set({ currentQuestionId: questionId, chatHistory: [], messagesRemaining: 10 });
  },

  sendMessage: async (accessToken, questionId, message) => {
    const { chatHistory } = get();
    
    // Add user message immediately
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    set({ 
      chatHistory: [...chatHistory, userMessage],
      isLoading: true,
      error: null 
    });

    try {
      const response = await axios.post(`${API_URL}/api/assist/chat`, {
        access_token: accessToken,
        question_id: questionId,
        message: message
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        queryIntent: response.data.query_intent,
        timestamp: new Date().toISOString()
      };

      set(state => ({
        chatHistory: [...state.chatHistory, assistantMessage],
        messagesRemaining: response.data.messages_remaining,
        isLoading: false
      }));

      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to get AI response';
      set({ error: errorMsg, isLoading: false });
      throw new Error(errorMsg);
    }
  },

  loadChatHistory: async (accessToken, questionId) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/assist/history/${accessToken}/${questionId}`
      );
      
      const history = response.data.history.flatMap(log => [
        { role: 'user', content: log.user_query, timestamp: log.created_at },
        { role: 'assistant', content: log.ai_response, queryIntent: log.query_intent, timestamp: log.created_at }
      ]);

      set({ 
        chatHistory: history,
        messagesRemaining: 10 - response.data.history.length,
        currentQuestionId: questionId
      });
    } catch (error) {
      // Silent fail - start fresh
      set({ chatHistory: [], messagesRemaining: 10 });
    }
  },

  clearChat: () => set({ chatHistory: [], messagesRemaining: 10, error: null }),
  clearError: () => set({ error: null })
}));
