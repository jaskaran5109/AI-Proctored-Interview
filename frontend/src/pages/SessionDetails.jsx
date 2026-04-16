import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useInterviewStore } from '@/stores/interviewStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Target, ArrowLeft, Copy, Clock, AlertTriangle,
  CheckCircle, XCircle, Sparkles, MessageCircle,
  HelpCircle, Lightbulb, Code
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Status badge styles
const STATUS_STYLES = {
  pending: 'status-pending',
  in_progress: 'status-in-progress',
  completed: 'status-completed'
};

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed'
};

// Understanding level colors
const UNDERSTANDING_COLORS = {
  INDEPENDENT: '#22c55e',
  GUIDED: '#eab308',
  AI_DEPENDENT: '#ef4444'
};

export default function SessionDetails() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { getSession, isLoading } = useInterviewStore();
  const [session, setSession] = useState(null);

  const loadSession = useCallback(async () => {
    try {
      const data = await getSession(sessionId);
      setSession(data);
    } catch (error) {
      toast.error('Session not found');
      navigate('/dashboard');
    }
  }, [sessionId, getSession, navigate]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const copyInviteLink = useCallback(() => {
    if (!session?.access_token) return;
    const link = `${window.location.origin}/interview/${session.access_token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  }, [session?.access_token]);

  const getStatusBadge = useCallback((status) => {
    return (
      <Badge variant="outline" className={`badge-swiss ${STATUS_STYLES[status] || ''}`}>
        {STATUS_LABELS[status] || status}
      </Badge>
    );
  }, []);

  const getScoreColor = useCallback((score) => {
    if (score >= 7) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  }, []);

  const getRecommendationColor = useCallback((rec) => {
    if (rec === 'PROCEED') return 'bg-green-100 text-green-700';
    if (rec === 'REVIEW') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  }, []);

  const getUnderstandingColor = useCallback((level) => {
    if (level === 'INDEPENDENT') return 'bg-green-100 text-green-700 border-green-200';
    if (level === 'GUIDED') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  }, []);

  // Memoize chart data
  const chartData = useMemo(() => {
    return session?.answers?.map((answer, idx) => ({
      name: `Q${idx + 1}`,
      score: answer.evaluation?.score || 0,
      authenticity: answer.authenticity_score || 10
    })) || [];
  }, [session?.answers]);

  // Pie chart data for understanding levels
  const understandingPieData = useMemo(() => {
    if (!session?.ai_evaluation?.authenticity_assessment?.question_breakdown) return [];
    
    const breakdown = session.ai_evaluation.authenticity_assessment.question_breakdown;
    const counts = {
      INDEPENDENT: breakdown.filter(q => q.understanding_level === 'INDEPENDENT').length,
      GUIDED: breakdown.filter(q => q.understanding_level === 'GUIDED').length,
      AI_DEPENDENT: breakdown.filter(q => q.understanding_level === 'AI_DEPENDENT').length
    };
    
    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [session?.ai_evaluation?.authenticity_assessment?.question_breakdown]);

  if (isLoading || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-500">Loading session...</p>
        </div>
      </div>
    );
  }  

  const authenticity = session?.ai_evaluation?.authenticity_assessment;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="header-swiss">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <Link to="/dashboard" className="flex items-center gap-3">
            <Target className="w-6 h-6" strokeWidth={1.5} />
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              AI Proctor
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard')}
          className="mb-6 -ml-4"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                {session?.title}
              </h1>
              {getStatusBadge(session?.status)}
            </div>
            <p className="text-gray-600">{session?.job_role}</p>
          </div>
          
          {session?.status === 'pending' && (
            <Button onClick={copyInviteLink} className="btn-secondary" data-testid="copy-invite-btn">
              <Copy className="w-4 h-4 mr-2" />
              Copy Invite Link
            </Button>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details & Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Session Info */}
            <div className="card-swiss p-6">
              <h2 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-4">
                Session Details
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Candidate</p>
                  <p className="font-medium">{session?.candidate_name}</p>
                  <p className="text-sm text-gray-600">{session?.candidate_email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Configuration</p>
                  <p className="font-medium">{session?.question_count} questions</p>
                  <p className="text-sm text-gray-600">{session?.time_limit} min limit • {session?.difficulty}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Topics</p>
                  <div className="flex flex-wrap gap-2">
                    {session?.topics?.map(topic => (
                      <Badge key={topic} variant="outline" className="badge-swiss">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">AI Assistance Used</p>
                  <p className="font-medium flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    {session?.ai_assistance_count || 0} messages
                  </p>
                </div>
              </div>
            </div>

            {/* Results (if completed) */}
            {session?.status === 'completed' && session?.ai_evaluation && (
              <>
                {/* Performance Chart */}
                {chartData.length > 0 && (
                  <div className="card-swiss p-6">
                    <h2 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-4">
                      Question Performance & Authenticity
                    </h2>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" stroke="#6b7280" />
                          <YAxis domain={[0, 10]} stroke="#6b7280" />
                          <Tooltip 
                            contentStyle={{ 
                              border: '1px solid #e5e7eb',
                              borderRadius: 0,
                              boxShadow: 'none'
                            }}
                          />
                          <Bar dataKey="score" name="Score" fill="#0055FF" />
                          <Bar dataKey="authenticity" name="Authenticity" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Knowledge Authenticity Analysis Section */}
                {authenticity && (
                  <div className="card-swiss p-6 border-2 border-purple-200">
                    <h2 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      Knowledge Authenticity Analysis
                    </h2>
                    
                    {/* Overview */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-purple-50 text-center">
                        <p className="text-3xl font-bold text-purple-700">
                          {authenticity.overall_authenticity_score}/10
                        </p>
                        <p className="text-sm text-purple-600">Authenticity Score</p>
                      </div>
                      <div className="p-4 bg-gray-50 text-center">
                        <p className="text-3xl font-bold">{authenticity.total_ai_interactions || 0}</p>
                        <p className="text-sm text-gray-600">AI Interactions</p>
                      </div>
                      <div className="p-4 text-center">
                        <Badge className={`${getUnderstandingColor(authenticity.understanding_level)} px-4 py-2 text-base`}>
                          {authenticity.understanding_level === 'AI_DEPENDENT' ? 'AI Dependent' : authenticity.understanding_level}
                        </Badge>
                        <p className="text-sm text-gray-600 mt-2">Understanding Level</p>
                      </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {authenticity.analysis}
                      </p>
                    </div>

                    {/* Key Indicators */}
                    {authenticity.key_indicators && authenticity.key_indicators.length > 0 && (
                      <div className="mb-6">
                        <p className="text-sm font-semibold text-gray-500 mb-2">Key Indicators</p>
                        <ul className="space-y-2">
                          {authenticity.key_indicators.map((indicator, idx) => (
                            <li key={`indicator-${idx}`} className="flex items-start gap-2 text-sm">
                              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <span>{indicator}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Question Breakdown */}
                    {authenticity.question_breakdown && authenticity.question_breakdown.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-500 mb-3">Per-Question Breakdown</p>
                        <div className="space-y-2">
                          {authenticity.question_breakdown.map((q, idx) => (
                            <div 
                              key={`breakdown-${idx}`}
                              className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-100"
                            >
                              <span className="font-mono text-sm font-bold w-12">Q{q.question_number || idx + 1}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={(q.authenticity || 10) * 10} 
                                    className="h-2 flex-1"
                                  />
                                  <span className={`text-sm font-bold ${getScoreColor(q.authenticity || 10)}`}>
                                    {q.authenticity || 10}/10
                                  </span>
                                </div>
                                {q.reason && (
                                  <p className="text-xs text-gray-500 mt-1">{q.reason}</p>
                                )}
                              </div>
                              <Badge 
                                variant="outline"
                                className={`text-xs ${getUnderstandingColor(q.understanding_level || 'INDEPENDENT')}`}
                              >
                                {q.understanding_level === 'AI_DEPENDENT' ? 'Dependent' : q.understanding_level || 'Independent'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Evaluation */}
                <div className="card-swiss p-6">
                  <h2 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-4">
                    Overall Evaluation
                  </h2>
                  
                  <div className="space-y-4">
                    <p className="text-gray-700">{session.ai_evaluation.summary}</p>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-gray-50">
                        <p className="text-gray-500">Technical</p>
                        <p className="font-semibold">{session.ai_evaluation.technical_competency || 'Medium'}</p>
                      </div>
                      <div className="p-3 bg-gray-50">
                        <p className="text-gray-500">Communication</p>
                        <p className="font-semibold">{session.ai_evaluation.communication_quality || 'Medium'}</p>
                      </div>
                      <div className="p-3 bg-gray-50">
                        <p className="text-gray-500">Integrity</p>
                        <p className="font-semibold">{session.ai_evaluation.integrity_score || 'Clean'}</p>
                      </div>
                    </div>
                    
                    {session.ai_evaluation.top_strengths && (
                      <div>
                        <p className="text-sm font-semibold text-gray-500 mb-2">Strengths</p>
                        <ul className="space-y-1">
                          {session.ai_evaluation.top_strengths.map((strength, idx) => (
                            <li key={`strength-${idx}-${strength.slice(0, 20)}`} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {session.ai_evaluation.areas_for_improvement && (
                      <div>
                        <p className="text-sm font-semibold text-gray-500 mb-2">Areas for Improvement</p>
                        <ul className="space-y-1">
                          {session.ai_evaluation.areas_for_improvement.map((area, idx) => (
                            <li key={`improvement-${idx}-${area.slice(0, 20)}`} className="flex items-center gap-2 text-sm">
                              <XCircle className="w-4 h-4 text-red-500" />
                              {area}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Pending State */}
            {session.status === 'pending' && (
              <div className="card-swiss p-8 text-center">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Waiting for Candidate</h3>
                <p className="text-gray-500 mb-6">
                  Share the invite link with {session.candidate_name} to start the interview
                </p>
                <Button onClick={copyInviteLink} className="btn-primary">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Invite Link
                </Button>
              </div>
            )}
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            {/* Score Card (if completed) */}
            {session.status === 'completed' && (
              <>
                <div className="card-swiss p-6">
                  <h3 className="text-sm font-semibold text-gray-500 mb-4">Final Score</h3>
                  <div className="text-center">
                    <p className={`text-5xl font-bold ${getScoreColor(session.final_score)}`}>
                      {session.final_score}
                    </p>
                    <p className="text-gray-500">out of 10</p>
                    
                    <div className="mt-4">
                      <Progress value={session.final_score * 10} className="h-2" />
                    </div>

                    {session.ai_evaluation?.recommendation && (
                      <div className={`mt-4 inline-block px-4 py-2 font-semibold text-sm ${
                        getRecommendationColor(session.ai_evaluation.recommendation)
                      }`}>
                        {session.ai_evaluation.recommendation}
                      </div>
                    )}
                  </div>
                </div>

                {/* Authenticity Score Card */}
                {session.authenticity_score !== null && (
                  <div className="card-swiss p-6 border-purple-200">
                    <h3 className="text-sm font-semibold text-gray-500 mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      Authenticity Score
                    </h3>
                    <div className="text-center">
                      <p className={`text-4xl font-bold ${getScoreColor(session.authenticity_score)}`}>
                        {session.authenticity_score}
                      </p>
                      <p className="text-gray-500">out of 10</p>
                      
                      <div className="mt-4">
                        <Progress value={session.authenticity_score * 10} className="h-2 bg-purple-100" />
                      </div>

                      {session.understanding_level && (
                        <Badge 
                          className={`mt-4 ${getUnderstandingColor(session.understanding_level)}`}
                        >
                          {session.understanding_level === 'AI_DEPENDENT' ? 'AI Dependent' : session.understanding_level}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Understanding Distribution */}
                {understandingPieData.length > 0 && (
                  <div className="card-swiss p-6">
                    <h3 className="text-sm font-semibold text-gray-500 mb-4">
                      Understanding Distribution
                    </h3>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={understandingPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            dataKey="value"
                          >
                            {understandingPieData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={UNDERSTANDING_COLORS[entry.name]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-green-500" />
                        Independent
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-yellow-500" />
                        Guided
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-red-500" />
                        Dependent
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Violations */}
            {session.violations?.length > 0 && (
              <div className="card-swiss p-6 border-red-200">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h3 className="text-sm font-semibold text-gray-500">
                    Proctoring Violations ({session.violations.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {session.violations.map((v, idx) => (
                    <div key={`violation-${idx}-${v.timestamp}`} className="p-3 bg-red-50 text-sm">
                      <p className="font-medium text-red-700">{v.type}</p>
                      <p className="text-red-600 text-xs">
                        {new Date(v.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            {session.status === 'completed' && session.ai_evaluation && (
              <div className="card-swiss p-6">
                <h3 className="text-sm font-semibold text-gray-500 mb-4">Statistics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Questions</span>
                    <span className="font-semibold">{session.ai_evaluation.total_questions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Avg Answer Score</span>
                    <span className="font-semibold">{session.ai_evaluation.average_answer_score}/10</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">AI Messages</span>
                    <span className="font-semibold">{authenticity?.total_ai_interactions || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Violations</span>
                    <span className="font-semibold text-red-600">{session.ai_evaluation.violation_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Penalty Applied</span>
                    <span className="font-semibold">-{session.ai_evaluation.violation_penalty}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
