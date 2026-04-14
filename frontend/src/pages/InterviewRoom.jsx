import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useInterviewStore } from "@/stores/interviewStore";
import { useAIAssistantStore } from "@/stores/aiAssistantStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import AIAssistantPanel from "@/components/interview/AIAssistantPanel";
import AuthenticityIndicator from "@/components/interview/AuthenticityIndicator";
import {
  Target,
  Camera,
  Mic,
  AlertTriangle,
  Clock,
  Send,
  CheckCircle,
  ChevronRight,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// Pre-interview checks component
function PreCheck({ sessionInfo, onStart }) {
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const checkCamera = useCallback(async () => {
    setIsChecking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
      setMicReady(true);
      toast.success("Camera and microphone ready!");
    } catch (error) {
      toast.error("Could not access camera or microphone");
      if (process.env.NODE_ENV === "development") {
        console.error("Media error:", error);
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  const handleStart = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    onStart();
  }, [onStart]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Target className="w-8 h-8" strokeWidth={1.5} />
            <span
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              AI Proctor
            </span>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Pre-Interview Check
          </h1>
          <p className="text-gray-600">
            Welcome, {sessionInfo.candidate_name}! Let&apos;s make sure
            everything is ready.
          </p>
        </div>

        <div className="card-swiss p-8 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <p className="overline mb-2">Interview</p>
              <h2 className="text-xl font-semibold">{sessionInfo.title}</h2>
              <p className="text-gray-600">{sessionInfo.job_role}</p>
            </div>
            <div className="text-right md:text-left">
              <p className="overline mb-2">Duration</p>
              <p className="text-xl font-semibold">
                {sessionInfo.question_count} Questions
              </p>
              <p className="text-gray-600">
                {sessionInfo.time_limit} minutes limit
              </p>
            </div>
          </div>

          {/* AI Assistant Notice */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900 mb-1">
                  AI Assistant Available
                </p>
                <p className="text-sm text-blue-700">
                  You will have access to an AI Assistant during this interview
                  to help clarify concepts, explain terminology, and guide your
                  thinking. However, your usage will be analyzed to assess your
                  independent understanding.
                </p>
              </div>
            </div>
          </div>

          {/* Camera Preview */}
          <div className="video-container aspect-video mb-6 flex items-center justify-center">
            {cameraReady ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center text-white">
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm opacity-75">
                  Camera preview will appear here
                </p>
              </div>
            )}
          </div>

          {/* Check Items */}
          <div className="space-y-4 mb-6">
            <div
              className={`flex items-center gap-3 p-4 border ${cameraReady ? "border-green-200 bg-green-50" : "border-gray-200"}`}
            >
              {cameraReady ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Camera className="w-5 h-5 text-gray-400" />
              )}
              <span
                className={
                  cameraReady ? "text-green-700 font-medium" : "text-gray-600"
                }
              >
                Camera {cameraReady ? "ready" : "not connected"}
              </span>
            </div>

            <div
              className={`flex items-center gap-3 p-4 border ${micReady ? "border-green-200 bg-green-50" : "border-gray-200"}`}
            >
              {micReady ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Mic className="w-5 h-5 text-gray-400" />
              )}
              <span
                className={
                  micReady ? "text-green-700 font-medium" : "text-gray-600"
                }
              >
                Microphone {micReady ? "ready" : "not connected"}
              </span>
            </div>

            {/* Acknowledgment Checkbox */}
            <label className="flex items-start gap-3 p-4 border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-700">
                I understand that my AI Assistant usage will be tracked and
                analyzed as part of the interview evaluation. I will use the
                assistant for learning and clarification purposes.
              </span>
            </label>
          </div>

          {!cameraReady ? (
            <Button
              onClick={checkCamera}
              disabled={isChecking}
              className="btn-primary w-full h-12"
              data-testid="check-devices-btn"
            >
              {isChecking ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Checking devices...
                </span>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Check Camera &amp; Microphone
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={!acknowledged || isInterviewStarted}
              className="btn-primary w-full h-12"
              data-testid="start-interview-btn"
            >
              {isInterviewStarted ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting...
                </span>
              ) : (
                <>
                  Start Interview
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>

        <div className="text-center text-sm text-gray-500">
          <p className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            This interview is proctored. Stay in frame and avoid switching tabs.
          </p>
        </div>
      </div>
    </div>
  );
}

// Main Interview Room with Split View
export default function InterviewRoom() {
  const { accessToken } = useParams();
  const navigate = useNavigate();
  const {
    validateAccess,
    startInterview,
    submitAnswer,
    reportViolation,
    terminateInterview,
  } = useInterviewStore();
  const { setCurrentQuestion, clearChat } = useAIAssistantStore();

  const [sessionInfo, setSessionInfo] = useState(null);
  const [isValidating, setIsValidating] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentQuestion, setCurrentQuestionState] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [sessionToken, setSessionToken] = useState(null); // Store session_token for API calls
  const [authenticityHint, setAuthenticityHint] = useState(null);
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);
  const [currentUnderstandingLevel, setCurrentUnderstandingLevel] =
    useState("INDEPENDENT");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Validate access token
  useEffect(() => {
    const validate = async () => {
      try {
        const info = await validateAccess(accessToken);
        setSessionInfo(info);
        setTotalQuestions(info.question_count);
        setTimeLeft(info.time_limit * 60);
      } catch (error) {
        toast.error(error.message);
        navigate("/");
      } finally {
        setIsValidating(false);
      }
    };
    validate();
  }, [accessToken, validateAccess, navigate]);

  // Timer
  useEffect(() => {
    if (!hasStarted || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current);
          toast.error("Time is up!");
          navigate(`/result/${accessToken}`);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [hasStarted, accessToken, navigate, timeLeft]);

  // Tab visibility detection
  useEffect(() => {
    if (!hasStarted || !sessionId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const violation = {
          type: "Tab switched",
          time: new Date().toLocaleTimeString(),
        };
        setViolations((prevViolations) => [...prevViolations, violation]);
        reportViolation(sessionId, "tab_switch");
        toast.warning("Warning: Tab switch detected!");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [hasStarted, sessionId, reportViolation]);

  // Start camera when interview begins
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Camera error:", error);
      }
    }
  }, []);

  const handleStart = useCallback(async () => {
    setHasStarted(true);
    try {
      const result = await startInterview(accessToken);
      setSessionId(result.session_id);
      setSessionToken(result.session_token); // Store session_token for API calls
      setCurrentQuestionState(result.question);
      setCurrentQuestion(result.question.id);
      setQuestionNumber(result.current_question);
      setTotalQuestions(result.total_questions);
      await startCamera();
    } catch (error) {
      toast.error(error.message);
      setHasStarted(false);
    }
  }, [accessToken, startInterview, startCamera, setCurrentQuestion]);

  const handleSubmit = useCallback(async () => {
    if (!answer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    if (!currentQuestion?.id || !sessionInfo) return;

    setIsSubmitting(true);

    try {
      const timeTaken = Math.max(
        0,
        Math.floor(sessionInfo.time_limit * 60 - timeLeft),
      );

      const result = await submitAnswer(currentQuestion.id, answer, timeTaken, sessionToken);

      // ✅ Authenticity Hint
      if (result.authenticityHint) {
        setAuthenticityHint(result.authenticityHint);
        toast.info(result.authenticityHint, { duration: 5000 });
      }

      // ✅ Completed
      if (result.status === "completed") {
        toast.success("Interview completed!");

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        navigate(`/result/${accessToken}`);
        return;
      }

      // ✅ Next Question Handling
      if (result.nextQuestion) {
        setCurrentQuestionState(result.nextQuestion);
        setCurrentQuestion(result.nextQuestion.id);
      }

      // ✅ Progress update (FIXED)
      if (result.progress) {
        setQuestionNumber(result.progress.current_question);
      }

      // ✅ Reset UI
      setAnswer("");
      clearChat();
      setAuthenticityHint(null);

      toast.success("Answer submitted!");
    } catch (error) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    answer,
    currentQuestion?.id,
    sessionInfo,
    timeLeft,
    submitAnswer,
    accessToken,
    navigate,
    setCurrentQuestion,
    clearChat,
    sessionToken,
  ]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const getTimeClass = useCallback(() => {
    if (timeLeft <= 60) return "timer-danger";
    if (timeLeft <= 300) return "timer-warning";
    return "";
  }, [timeLeft]);

  if (isValidating) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-500">Validating access...</p>
        </div>
      </div>
    );
  }

  if (!hasStarted && sessionInfo) {
    return <PreCheck sessionInfo={sessionInfo} onStart={handleStart} />;
  }

  const handleTerminate = async () => {
    if (
      !confirm(
        "Are you sure you want to end the interview early? This cannot be undone.",
      )
    )
      return;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      await terminateInterview(accessToken);
      toast.success("Interview ended");
    } catch (error) {
      toast.error(error.message);
    }

    clearChat();
    navigate(`/result/${accessToken}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="header-swiss flex-shrink-0">
        <div className="max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6" strokeWidth={1.5} />
            <span
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              AI Proctor
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-gray-500">Question</span>
              <span className="font-bold ml-2">
                {questionNumber}/{totalQuestions}
              </span>
            </div>
            <div
              className={`flex items-center gap-2 font-mono font-bold ${getTimeClass()}`}
            >
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
            {violations.length > 0 && (
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200"
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                {violations.length} violation(s)
              </Badge>
            )}
            <AuthenticityIndicator level={currentUnderstandingLevel} compact />
          </div>
        </div>
        <Progress
          value={(questionNumber / totalQuestions) * 100}
          className="h-1"
        />
      </header>

      {/* Authenticity Hint Banner */}
      <AnimatePresence>
        {authenticityHint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-yellow-50 border-b border-yellow-200 px-6 py-3"
          >
            <p className="text-sm text-yellow-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              {authenticityHint}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuthenticityHint(null)}
                className="ml-auto text-yellow-700"
              >
                Dismiss
              </Button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Split View */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Side - Question & Answer */}
        <div
          className={`flex-1 flex flex-col overflow-hidden transition-all ${assistantCollapsed ? "mr-12" : "mr-0"}`}
        >
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              {/* Webcam Preview (Smaller) */}
              <div className="card-swiss overflow-hidden mb-6">
                <div className="flex">
                  <div className="w-48 h-36 bg-black relative flex-shrink-0">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-white text-xs font-medium">
                        REC
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex-1 border-l border-gray-200">
                    <p className="text-sm font-medium">
                      {sessionInfo?.candidate_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sessionInfo?.job_role} Interview
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <MessageCircle className="w-3 h-3" />
                      <span>AI Assistant available on the right panel</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Card */}
              <div className="question-card mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="overline">Question {questionNumber}</span>
                  {currentQuestion?.topic && (
                    <Badge variant="outline" className="badge-swiss">
                      {currentQuestion.topic}
                    </Badge>
                  )}
                </div>
                <h2
                  className="text-xl font-semibold leading-relaxed"
                  data-testid="question-text"
                >
                  {currentQuestion?.question_text}
                </h2>
                {currentQuestion?.expected_time && (
                  <p className="text-sm text-gray-500 mt-4">
                    Expected time: ~{currentQuestion.expected_time} minutes
                  </p>
                )}
              </div>

              {/* Answer Input */}
              <div className="card-swiss p-6">
                <label className="block text-sm font-semibold mb-2">
                  Your Answer
                </label>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here... Be thorough and provide examples where applicable."
                  className="answer-input font-body"
                  rows={10}
                  data-testid="answer-input"
                />

                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    {answer.length} characters
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setAssistantCollapsed(!assistantCollapsed)}
                      className="lg:hidden"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI Help
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !answer.trim()}
                      className="btn-primary"
                      data-testid="submit-answer-btn"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </span>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit Answer
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleTerminate}
                  className="btn-primary w-full h-10 mt-5"
                  data-testid="terminate-interview-btn"
                >
                  Terminate Interview
                  <ChevronRight className="w-4 h-4 align-middle text-center" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - AI Assistant Panel */}
        <div
          className={`${assistantCollapsed ? "w-12" : "w-96"} flex-shrink-0 hidden lg:block transition-all`}
        >
          <AIAssistantPanel
            accessToken={accessToken}
            questionId={currentQuestion?.id}
            questionText={currentQuestion?.question_text}
            isCollapsed={assistantCollapsed}
            onToggle={() => setAssistantCollapsed(!assistantCollapsed)}
          />
        </div>
      </main>
    </div>
  );
}
