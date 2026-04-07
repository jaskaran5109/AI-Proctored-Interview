import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useInterviewStore } from "@/stores/interviewStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Plus,
  Users,
  Clock,
  CheckCircle,
  TrendingUp,
  LogOut,
  MoreVertical,
  Trash2,
  Eye,
  Copy,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import AuthenticityIndicator from "@/components/interview/AuthenticityIndicator";

// Status configuration
const STATUS_CONFIG = {
  pending: { style: "status-pending", label: "Pending" },
  in_progress: { style: "status-in-progress", label: "In Progress" },
  completed: { style: "status-completed", label: "Completed" },
};

// Understanding level icons
const UNDERSTANDING_ICONS = {
  INDEPENDENT: CheckCircle,
  GUIDED: HelpCircle,
  AI_DEPENDENT: AlertTriangle,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    sessions,
    stats,
    fetchSessions,
    fetchStats,
    deleteSession,
    isLoading,
  } = useInterviewStore();
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchSessions();
    fetchStats();
  }, [fetchSessions, fetchStats, deleteSession]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleDelete = useCallback(
    async (sessionId, e) => {
      e.stopPropagation();
      if (window.confirm("Are you sure you want to delete this session?")) {
        setDeletingId(sessionId);
        try {
          await deleteSession(sessionId);
          toast.success("Session deleted");
        } catch (error) {
          toast.error("Failed to delete session");
        } finally {
          setDeletingId(null);
        }
      }
    },
    [deleteSession],
  );

  const copyInviteLink = useCallback((accessToken, e) => {
    e.stopPropagation();
    const link = `${window.location.origin}/interview/${accessToken}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard");
  }, []);

  const getStatusBadge = useCallback((status) => {
    const config = STATUS_CONFIG[status] || { style: "", label: status };
    return (
      <Badge variant="outline" className={`badge-swiss ${config.style}`}>
        {config.label}
      </Badge>
    );
  }, []);

  const getScoreColor = useCallback((score) => {
    if (score >= 7) return "score-high";
    if (score >= 5) return "score-medium";
    return "score-low";
  }, []);

  const getAuthenticityColor = useCallback((score) => {
    if (score >= 7) return "text-green-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  }, []);

  const userFirstName = useMemo(() => {
    return user?.name?.split(" ")[0] || "Recruiter";
  }, [user?.name]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="header-swiss">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6" strokeWidth={1.5} />
            <span
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              AI Proctor
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-950"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="overline mb-1">Dashboard</p>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Welcome back, {userFirstName}
            </h1>
          </div>
          <Button
            onClick={() => navigate("/create-session")}
            className="btn-primary"
            data-testid="create-session-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Interview
          </Button>
        </div>

        {/* Stats Grid - Updated with Authenticity */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
          data-testid="stats-grid"
        >
          <div className="stats-card">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="overline">Total</span>
            </div>
            <p className="text-3xl font-bold" data-testid="stat-total">
              {stats?.total_sessions || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Interviews</p>
          </div>

          <div className="stats-card">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="overline">Completed</span>
            </div>
            <p className="text-3xl font-bold" data-testid="stat-completed">
              {stats?.completed || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Done</p>
          </div>

          <div className="stats-card">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <span className="overline">Avg Score</span>
            </div>
            <p className="text-3xl font-bold" data-testid="stat-avg-score">
              {stats?.average_score || 0}
              <span className="text-lg text-gray-400">/10</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">Performance</p>
          </div>

          <div className="stats-card">
            <div className="flex items-center justify-between mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <span className="overline">Authenticity</span>
            </div>
            <p className="text-3xl font-bold" data-testid="stat-authenticity">
              {stats?.average_authenticity || 0}
              <span className="text-lg text-gray-400">/10</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">Knowledge Score</p>
          </div>

          <div className="stats-card">
            <div className="flex items-center justify-between mb-4">
              <HelpCircle className="w-5 h-5 text-yellow-500" />
              <span className="overline">AI Usage</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600">Independent</span>
                <span className="font-bold">
                  {stats?.understanding_breakdown?.independent || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-yellow-600">Guided</span>
                <span className="font-bold">
                  {stats?.understanding_breakdown?.guided || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-600">AI Dependent</span>
                <span className="font-bold">
                  {stats?.understanding_breakdown?.ai_dependent || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="card-swiss" data-testid="sessions-table">
          <div className="p-6 border-b border-gray-200">
            <h2
              className="text-xl font-semibold"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Interview Sessions
            </h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="spinner mx-auto mb-4" />
              <p className="text-gray-500">Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="empty-state" data-testid="empty-state">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No interviews yet</h3>
              <p className="text-gray-500 mb-6">
                Create your first interview session to get started
              </p>
              <Button
                onClick={() => navigate("/create-session")}
                className="btn-primary"
                data-testid="create-first-session-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Interview
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-swiss">
                <thead>
                  <tr className="bg-gray-50">
                    <th>Session</th>
                    <th>Candidate</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Authenticity</th>
                    <th>AI Usage</th>
                    <th>Created</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions?.sessions?.map((session) => {
                    const UnderstandingIcon =
                      UNDERSTANDING_ICONS[session.understanding_level] ||
                      HelpCircle;
                    return (
                      <tr
                        key={session.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => navigate(`/session/${session.id}`)}
                        data-testid={`session-row-${session.id}`}
                      >
                        <td>
                          <div>
                            <p className="font-semibold">{session.title}</p>
                            <p className="text-sm text-gray-500">
                              {session.job_role}
                            </p>
                          </div>
                        </td>
                        <td>
                          <div>
                            <p className="font-medium">
                              {session.candidate_name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {session.candidate_email}
                            </p>
                          </div>
                        </td>
                        <td>{getStatusBadge(session.status)}</td>
                        <td>
                          {session.final_score !== null &&
                          session.final_score !== undefined ? (
                            <span
                              className={`font-bold ${getScoreColor(session.final_score)}`}
                            >
                              {session.final_score}/10
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td>
                          {session.authenticity_score !== null &&
                          session.authenticity_score !== undefined ? (
                            <span
                              className={`font-bold ${getAuthenticityColor(session.authenticity_score)}`}
                            >
                              <Sparkles className="w-3 h-3 inline mr-1" />
                              {session.authenticity_score}/10
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td>
                          {session.understanding_level ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                session.understanding_level === "INDEPENDENT"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : session.understanding_level === "GUIDED"
                                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              <UnderstandingIcon className="w-3 h-3 mr-1" />
                              {session.understanding_level === "AI_DEPENDENT"
                                ? "Dependent"
                                : session.understanding_level}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="text-sm text-gray-500">
                          {new Date(session.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`session-menu-${session.id}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-none"
                            >
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/session/${session.id}`);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) =>
                                  copyInviteLink(session.access_token, e)
                                }
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Copy Invite Link
                              </DropdownMenuItem>
                              {session.status === "pending" && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(
                                      `/interview/${session.access_token}`,
                                      "_blank",
                                    );
                                  }}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Open Interview
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={(e) => handleDelete(session.id, e)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
