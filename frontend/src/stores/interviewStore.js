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
      const response = await axios.get(`${API_URL}/api/sessions/list`);
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
        `${API_URL}/api/sessions/create`,
        sessionData,
      );
      const newSession = response.data;
      set((state) => {
        return {
          sessions: [
            newSession,
            ...(Array.isArray(state.sessions) ? state.sessions : []),
          ],
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
      // Remove the session from state - handle both id and _id formats
      set((state) => {
        return {
          sessions: state.sessions?.sessions?.filter(
            (s) => s.id !== sessionId && s._id !== sessionId,
          ),
          error: null,
        };
      });
      return response.data;
    } catch (error) {
      debugger;
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

  submitAnswer: async (questionId, answerText, timeTaken) => {
    try {
      const response = await axios.post(`${API_URL}/api/interviews/answer`, {
        question_id: questionId,
        answer_text: answerText.trim(),
        time_taken: timeTaken,
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
