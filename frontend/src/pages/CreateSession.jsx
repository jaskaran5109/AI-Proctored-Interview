import { useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useInterviewStore } from '@/stores/interviewStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Target, ArrowLeft, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

// Constants extracted for maintainability
const TOPICS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Java', 'C++',
  'System Design', 'Data Structures', 'Algorithms', 'SQL', 'MongoDB',
  'AWS', 'Docker', 'Kubernetes', 'REST APIs', 'GraphQL', 'Machine Learning',' IT General Controls',
  'IT Application Controls', 'IT Physical and Environmental Controls', 'IT Logical Access Controls',
  'IT Change Management Controls', 'IT Operations Controls', 'IT Incident Management Controls',
  'IT Vendor Management Controls', 'IT Risk Assessment and Management Controls', 'IT Compliance and Audit Controls'
];

const QUESTION_COUNT_OPTIONS = [3, 5, 7, 10];
const TIME_LIMIT_OPTIONS = [15, 30, 45, 60, 90];
const DEFAULT_QUESTION_COUNT = 5;
const DEFAULT_TIME_LIMIT = 30;

export default function CreateSession() {
  const navigate = useNavigate();
  const { createSession, isLoading, error } = useInterviewStore();
  const [createdSession, setCreatedSession] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    job_role: '',
    topics: [],
    difficulty: 'medium',
    question_count: DEFAULT_QUESTION_COUNT,
    time_limit: DEFAULT_TIME_LIMIT,
    candidate_email: '',
    candidate_name: ''
  });

  const handleTopicToggle = useCallback((topic) => {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter(t => t !== topic)
        : [...prev.topics, topic]
    }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (formData.topics.length === 0) {
      toast.error('Please select at least one topic');
      return;
    }

    try {
      const session = await createSession(formData);
      setCreatedSession(session);
      toast.success('Interview session created!');
    } catch (err) {
      toast.error(err.message || 'Failed to create session');
    }
  }, [formData, createSession]);

  const copyInviteLink = useCallback(() => {
    if (!createdSession?.access_token) return;
    const link = `${window.location.origin}/interview/${createdSession.access_token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  }, [createdSession?.access_token]);

  const handleCreateAnother = useCallback(() => {
    setCreatedSession(null);
    setFormData({
      title: '',
      job_role: '',
      topics: [],
      difficulty: 'medium',
      question_count: DEFAULT_QUESTION_COUNT,
      time_limit: DEFAULT_TIME_LIMIT,
      candidate_email: '',
      candidate_name: ''
    });
  }, []);

  // Memoize the invite link
  const inviteLink = useMemo(() => {
    if (!createdSession?.access_token) return '';
    return `${window.location.origin}/interview/${createdSession.access_token}`;
  }, [createdSession?.access_token]);

  if (createdSession) {
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

        <main className="max-w-2xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-none flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Interview Created!
            </h1>
            <p className="text-gray-600">
              Share the invite link with {createdSession.candidate_name}
            </p>
          </div>

          <div className="card-swiss p-8">
            <div className="space-y-6">
              <div>
                <p className="overline mb-2">Session Details</p>
                <h3 className="text-xl font-semibold">{createdSession.title}</h3>
                <p className="text-gray-600">{createdSession.job_role}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Candidate:</span>
                  <p className="font-medium">{createdSession.candidate_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>
                  <p className="font-medium">{createdSession.candidate_email}</p>
                </div>
                <div>
                  <span className="text-gray-500">Questions:</span>
                  <p className="font-medium">{createdSession.question_count}</p>
                </div>
                <div>
                  <span className="text-gray-500">Time Limit:</span>
                  <p className="font-medium">{createdSession.time_limit} min</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Invite Link</p>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="input-swiss font-mono text-sm"
                    data-testid="invite-link-input"
                  />
                  <Button onClick={copyInviteLink} className="btn-secondary" data-testid="copy-link-btn">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <Button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary flex-1"
              data-testid="back-to-dashboard-btn"
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={handleCreateAnother}
              className="btn-primary flex-1"
              data-testid="create-another-btn"
            >
              Create Another
            </Button>
          </div>
        </main>
      </div>
    );
  }

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

      <main className="max-w-2xl mx-auto px-6 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard')}
          className="mb-6 -ml-4"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <p className="overline mb-1">New Interview</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            Create Interview Session
          </h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Session Info */}
          <div className="card-swiss p-6 space-y-6">
            <h2 className="text-lg font-semibold border-b border-gray-200 pb-4">
              Session Information
            </h2>
            
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-semibold">Session Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., Senior Frontend Developer Interview"
                className="input-swiss"
                required
                data-testid="session-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_role" className="text-sm font-semibold">Job Role</Label>
              <Input
                id="job_role"
                value={formData.job_role}
                onChange={(e) => setFormData({...formData, job_role: e.target.value})}
                placeholder="e.g., Frontend Developer"
                className="input-swiss"
                required
                data-testid="job-role"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Difficulty</Label>
                <Select 
                  value={formData.difficulty} 
                  onValueChange={(value) => setFormData({...formData, difficulty: value})}
                >
                  <SelectTrigger className="input-swiss" data-testid="difficulty-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Number of Questions</Label>
                <Select 
                  value={String(formData.question_count)} 
                  onValueChange={(value) => setFormData({...formData, question_count: parseInt(value, 10)})}
                >
                  <SelectTrigger className="input-swiss" data-testid="question-count-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {QUESTION_COUNT_OPTIONS.map(n => (
                      <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Time Limit (minutes)</Label>
              <Select 
                value={String(formData.time_limit)} 
                onValueChange={(value) => setFormData({...formData, time_limit: parseInt(value, 10)})}
              >
                <SelectTrigger className="input-swiss" data-testid="time-limit-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {TIME_LIMIT_OPTIONS.map(n => (
                    <SelectItem key={n} value={String(n)}>{n} minutes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Topics */}
          <div className="card-swiss p-6 space-y-6">
            <h2 className="text-lg font-semibold border-b border-gray-200 pb-4">
              Interview Topics
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TOPICS.map(topic => (
                <label
                  key={topic}
                  className={`flex items-center gap-2 p-3 border cursor-pointer transition-colors ${
                    formData.topics.includes(topic) 
                      ? 'border-gray-950 bg-gray-950 text-white' 
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  data-testid={`topic-${topic.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Checkbox
                    checked={formData.topics.includes(topic)}
                    onCheckedChange={() => handleTopicToggle(topic)}
                    className="border-current"
                  />
                  <span className="text-sm font-medium">{topic}</span>
                </label>
              ))}
            </div>
            {formData.topics.length > 0 && (
              <p className="text-sm text-gray-500">
                Selected: {formData.topics.join(', ')}
              </p>
            )}
          </div>

          {/* Candidate Info */}
          <div className="card-swiss p-6 space-y-6">
            <h2 className="text-lg font-semibold border-b border-gray-200 pb-4">
              Candidate Information
            </h2>
            
            <div className="space-y-2">
              <Label htmlFor="candidate_name" className="text-sm font-semibold">Candidate Name</Label>
              <Input
                id="candidate_name"
                value={formData.candidate_name}
                onChange={(e) => setFormData({...formData, candidate_name: e.target.value})}
                placeholder="e.g., Jane Smith"
                className="input-swiss"
                required
                data-testid="candidate-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="candidate_email" className="text-sm font-semibold">Candidate Email</Label>
              <Input
                id="candidate_email"
                type="email"
                value={formData.candidate_email}
                onChange={(e) => setFormData({...formData, candidate_email: e.target.value})}
                placeholder="candidate@email.com"
                className="input-swiss"
                required
                data-testid="candidate-email"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-secondary flex-1"
              data-testid="cancel-btn"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex-1"
              data-testid="create-session-submit"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Interview'
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
