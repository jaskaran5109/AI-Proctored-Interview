import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useInterviewStore } from '@/stores/interviewStore';
import { Progress } from '@/components/ui/progress';
import { 
  Target, CheckCircle, XCircle, AlertTriangle, 
  Award, TrendingUp, Clock
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function InterviewResult() {
  const { accessToken } = useParams();
  const { user } = useAuthStore();
  const { getResult } = useInterviewStore();
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchResult = useCallback(async () => {
    try {
      const data = await getResult(accessToken);
      setResult(data);
    } catch (error) {
      // Error is logged in store, show empty state to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch result:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, getResult]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  const getScoreColor = useCallback((score) => {
    if (score >= 7) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  }, []);

  const getScoreBg = useCallback((score) => {
    if (score >= 7) return 'bg-green-100';
    if (score >= 5) return 'bg-yellow-100';
    return 'bg-red-100';
  }, []);

  const getRecommendationStyle = useCallback((rec) => {
    if (rec === 'Strong Hire' || rec === 'Hire') {
      return 'bg-green-500 text-white';
    }
    if (rec === 'Review') {
      return 'bg-yellow-500 text-white';
    }
    return 'bg-gray-500 text-white';
  }, []);

  // Memoize violations list for stable keys
  const violationsList = useMemo(() => {
    return result?.violations?.map((v, idx) => ({
      ...v,
      id: `violation-${idx}-${v.type}-${v.timestamp || idx}`
    })) || [];
  }, [result?.violations]);

  // Memoize strengths list
  const strengthsList = useMemo(() => {
    return result?.ai_evaluation?.top_strengths?.map((s, idx) => ({
      text: s,
      id: `strength-${idx}-${s.slice(0, 15)}`
    })) || [];
  }, [result?.ai_evaluation?.top_strengths]);

  // Memoize improvements list
  const improvementsList = useMemo(() => {
    return result?.ai_evaluation?.areas_for_improvement?.map((s, idx) => ({
      text: s,
      id: `improvement-${idx}-${s.slice(0, 15)}`
    })) || [];
  }, [result?.ai_evaluation?.areas_for_improvement]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-500">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Results Not Found</h1>
          <p className="text-gray-500">The interview results could not be loaded.</p>
        </div>
      </div>
    );
  }

  if (result.status !== 'completed' && result.status !== 'terminated') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Interview Not Complete</h1>
          <p className="text-gray-500">This interview is still {result.status}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="header-swiss">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6" strokeWidth={1.5} />
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              AI Proctor
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className={`w-24 h-24 ${getScoreBg(result.final_score)} flex items-center justify-center mx-auto mb-6`}>
            <Award className={`w-12 h-12 ${getScoreColor(result.final_score)}`} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            Interview Complete
          </h1>
          {user?.id && (
            <p className="text-gray-600">
              Thank you, {result.candidate_name}! Your results are below.
            </p>
          )}
        </div>

        {user?.id && (
          <div className="card-swiss p-8 text-center mb-8">
            <p className="overline mb-4">Your Score</p>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`text-7xl font-bold ${getScoreColor(result.final_score)}`}>
                {result.final_score}
              </span>
              <span className="text-3xl text-gray-400 self-end mb-3">/10</span>
            </div>
            
            <Progress 
              value={result.final_score * 10} 
              className="h-3 max-w-md mx-auto mb-6" 
            />

            {result.ai_evaluation?.recommendation && (
              <span className={`inline-block px-6 py-2 font-bold text-lg ${
                getRecommendationStyle(result.ai_evaluation.recommendation)
              }`}>
                {result.ai_evaluation.recommendation}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Summary */}
          <div className="card-swiss p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Summary
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {result.ai_evaluation?.summary || 'Your performance has been evaluated.'}
            </p>
          </div>

          {/* Violations */}
          <div className="card-swiss p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${violationsList.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
              Proctoring
            </h2>
            {violationsList.length > 0 ? (
              <div>
                <p className="text-red-600 font-medium mb-2">
                  {violationsList.length} violation(s) detected
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {violationsList.map((v) => (
                    <li key={v.id} className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      {v.type}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>No violations detected</span>
              </div>
            )}
          </div>
        </div>

        {result.ai_evaluation && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {strengthsList.length > 0 && (
              <div className="card-swiss p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Strengths
                </h2>
                <ul className="space-y-2">
                  {strengthsList.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-gray-700">
                      <span className="text-green-500 mt-1">•</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {improvementsList.length > 0 && (
              <div className="card-swiss p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-yellow-600" />
                  Areas to Improve
                </h2>
                <ul className="space-y-2">
                  {improvementsList.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-gray-700">
                      <span className="text-yellow-500 mt-1">•</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="card-swiss p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Interview Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-gray-50">
              <p className="text-2xl font-bold">{result.title}</p>
              <p className="text-sm text-gray-500">Position</p>
            </div>
            <div className="p-4 bg-gray-50">
              <p className="text-2xl font-bold">{result.job_role}</p>
              <p className="text-sm text-gray-500">Role</p>
            </div>
            <div className="p-4 bg-gray-50">
              <p className="text-2xl font-bold">
                {result.ai_evaluation?.total_questions || '-'}
              </p>
              <p className="text-sm text-gray-500">Questions</p>
            </div>
            <div className="p-4 bg-gray-50">
              <p className="text-2xl font-bold">
                {result.completed_at ? new Date(result.completed_at).toLocaleDateString() : '-'}
              </p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-500 text-sm mb-4">
            The recruiter will review your results and contact you soon.
          </p>
          <p className="text-gray-400 text-xs">
            Powered by AI Proctor • Results are AI-generated evaluations
          </p>
        </div>
      </main>
    </div>
  );
}
