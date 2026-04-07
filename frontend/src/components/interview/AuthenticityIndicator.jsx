import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

const LEVEL_CONFIG = {
  INDEPENDENT: {
    icon: CheckCircle,
    label: 'Independent',
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'Working independently'
  },
  GUIDED: {
    icon: HelpCircle,
    label: 'Guided',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    description: 'Using AI guidance'
  },
  AI_DEPENDENT: {
    icon: AlertTriangle,
    label: 'AI Dependent',
    color: 'bg-red-100 text-red-700 border-red-200',
    description: 'High AI reliance'
  }
};

export default function AuthenticityIndicator({ level, score, compact = false }) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.INDEPENDENT;
  const Icon = config.icon;

  if (compact) {
    return (
      <Badge variant="outline" className={`${config.color} text-xs`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 border ${config.color}`}>
      <Icon className="w-4 h-4" />
      <div className="flex-1">
        <p className="text-xs font-medium">{config.label}</p>
        <p className="text-xs opacity-75">{config.description}</p>
      </div>
      {score !== undefined && score !== null && (
        <div className="text-right">
          <Sparkles className="w-3 h-3 inline mr-1" />
          <span className="text-sm font-bold">{score}/10</span>
        </div>
      )}
    </div>
  );
}
