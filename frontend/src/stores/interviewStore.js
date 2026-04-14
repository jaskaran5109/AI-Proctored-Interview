import { create } from "zustand";
import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL;
axios.defaults.withCredentials = true;

export const useInterviewStore = create((set) => ({
  sessions: [],
  currentSession: null,
  stats: null,
  isLoading: false,
  error: null,

  // Recruiter actions
  fetchSessions: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get(`${API_URL}/api/sessions`);
      set({ sessions: response.data, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const response = await axios.get(`${API_URL}/api/stats`);
      set({ stats: response.data });
    } catch (error) {
      // Stats fetch failed silently - non-critical
      set({ stats: null });
    }
  },

  createSession: async (sessionData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(
        `${API_URL}/api/sessions`,
        sessionData,
      );
      const newSession = response.data;
      set((state) => {
        // Handle both raw array and wrapped response format
        const currentSessions = state.sessions?.sessions || state.sessions || [];
        return {
          sessions: {
            sessions: [newSession, ...currentSessions],
            total: (state.sessions?.total || currentSessions.length) + 1,
          },
          isLoading: false,
        };
      });
      return newSession;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      set({ error: errorMsg, isLoading: false });
      throw new Error(errorMsg);
    }
  },

  getSession: async (sessionId) => {
    set({ isLoading: true });
    try {
      const response = await axios.get(`${API_URL}/api/sessions/${sessionId}`);
      set({ currentSession: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteSession: async (sessionId) => {
    try {
      const response = await axios.delete(
        `${API_URL}/api/sessions/${sessionId}`,
      );
      // Remove the session from state - handle both raw array and wrapped response format
      set((state) => {
        const currentSessions = state.sessions?.sessions || state.sessions || [];
        const filteredSessions = Array.isArray(currentSessions)
          ? currentSessions.filter((s) => s.id !== sessionId && s._id !== sessionId)
          : [];
        return {
          sessions: {
            sessions: filteredSessions,
            total: state.sessions?.total || filteredSessions.length,
          },
          error: null,
        };
      });
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail ||
        error.message ||
        "Failed to delete session";
      set({ error: errorMsg });
      throw new Error(errorMsg);
    }
  },

  // Candidate actions
  validateAccess: async (accessToken) => {
    try {
      const response = await axios.post(`${API_URL}/api/interviews/validate`, {
        access_token: accessToken,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || "Invalid access token");
    }
  },

  startInterview: async (accessToken) => {
    try {
      const response = await axios.post(`${API_URL}/api/interviews/start`, {
        access_token: accessToken,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.detail || "Failed to start interview",
      );
    }
  },

  submitAnswer: async (questionId, answerText, timeTaken, sessionToken) => {
    try {
      const response = await axios.post(`${API_URL}/api/interviews/answer`, {
        session_token: sessionToken,
        question_id: questionId,
        answer_text: answerText.trim(),
        time_taken_seconds: timeTaken,
        typing_metrics: { typingSpeed: 0, pauseCount: 0, editCount: 0 },
      });

      const data = response.data;

      return {
        status: data.status,
        message: data.message,
        evaluation: data.evaluation,
        isCorrect: data.is_correct,
        authenticityHint: data.authenticity_hint,
        progress: data.progress,
        nextQuestion: data.next_question,
        finalScore: data.final_score,
        warnings: data.warnings,
        skill_progress: data.skill_progress,
      };
    } catch (error) {
      throw new Error(
        error.response?.data?.detail || "Failed to submit answer",
      );
    }
  },

  getResult: async (accessToken) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/interviews/result/${accessToken}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || "Failed to get results");
    }
  },

  // Proctoring
  reportViolation: async (sessionId, violationType, details = null) => {
    try {
      await axios.post(`${API_URL}/api/proctoring/violation`, {
        session_id: sessionId,
        violation_type: violationType,
        details: details,
      });
    } catch (error) {
      // Violation reporting failed silently - non-critical for UX
      // Error is logged server-side
    }
  },

  // Terminate interview (for recruiter)
  terminateInterview: async (sessionId) => {
    try {
      const response = await axios.post(`${API_URL}/api/interviews/end`, {
        access_token: sessionId,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.detail || "Failed to terminate interview",
      );
    }
  },

  clearError: () => set({ error: null }),
}));
