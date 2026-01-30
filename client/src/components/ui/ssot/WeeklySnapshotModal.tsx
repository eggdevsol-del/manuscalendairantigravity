/**
 * Weekly Snapshot Modal
 * 
 * Displays weekly analytics to the artist with performance metrics
 * and comparison to benchmarks.
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Clock, CheckCircle2, Zap, Award, Target, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeeklySnapshotData {
  weekStart: string;
  weekEnd: string;
  metrics: {
    totalTasksCompleted: number;
    tier1TasksCompleted: number;
    tier2TasksCompleted: number;
    tier3TasksCompleted: number;
    tier4TasksCompleted: number;
    avgCompletionTimeSeconds: number;
    avgTier1CompletionTimeSeconds: number;
    avgConsultationResponseSeconds: number;
  };
  comparison: {
    responseTimeVsBenchmark: number;
    benchmarkLabel: string;
  };
  efficiencyScore: number;
  rating: 'elite' | 'excellent' | 'good' | 'average' | 'needs_improvement';
  insights: string[];
}

interface WeeklySnapshotModalProps {
  open: boolean;
  onClose: () => void;
  data: WeeklySnapshotData | null | undefined;
  isLoading?: boolean;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getRatingColor(rating: string): string {
  switch (rating) {
    case 'elite': return 'text-yellow-400';
    case 'excellent': return 'text-green-400';
    case 'good': return 'text-blue-400';
    case 'average': return 'text-orange-400';
    default: return 'text-red-400';
  }
}

function getRatingLabel(rating: string): string {
  switch (rating) {
    case 'elite': return 'Elite';
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'average': return 'Average';
    default: return 'Needs Improvement';
  }
}

function getRatingIcon(rating: string) {
  switch (rating) {
    case 'elite': return <Award className="w-6 h-6" />;
    case 'excellent': return <Zap className="w-6 h-6" />;
    case 'good': return <TrendingUp className="w-6 h-6" />;
    case 'average': return <Target className="w-6 h-6" />;
    default: return <Target className="w-6 h-6" />;
  }
}

function ComparisonIndicator({ value }: { value: number }) {
  if (value > 110) {
    return <ArrowUp className="w-4 h-4 text-green-400" />;
  } else if (value < 90) {
    return <ArrowDown className="w-4 h-4 text-red-400" />;
  }
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export function WeeklySnapshotModal({ open, onClose, data, isLoading }: WeeklySnapshotModalProps) {
  if (!open) return null;

  const weekRange = data ? `${new Date(data.weekStart).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - ${new Date(data.weekEnd).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}` : '';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-50 flex flex-col"
          >
            <div className="bg-background/95 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Weekly Snapshot</h2>
                    <p className="text-sm text-muted-foreground">{weekRange}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : data ? (
                  <>
                    {/* Efficiency Score */}
                    <div className="text-center py-4">
                      <div className={`inline-flex items-center gap-2 ${getRatingColor(data.rating)}`}>
                        {getRatingIcon(data.rating)}
                        <span className="text-lg font-bold">{getRatingLabel(data.rating)}</span>
                      </div>
                      <div className="mt-4 relative">
                        <div className="w-32 h-32 mx-auto relative">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="currentColor"
                              strokeWidth="8"
                              fill="none"
                              className="text-white/10"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="currentColor"
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={`${(data.efficiencyScore / 100) * 352} 352`}
                              strokeLinecap="round"
                              className={getRatingColor(data.rating)}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-3xl font-bold">{data.efficiencyScore}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">Efficiency Score</p>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs">Tasks Completed</span>
                        </div>
                        <p className="text-2xl font-bold">{data.metrics.totalTasksCompleted}</p>
                      </div>

                      <div className="bg-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Zap className="w-4 h-4 text-red-400" />
                          <span className="text-xs">Critical Tasks</span>
                        </div>
                        <p className="text-2xl font-bold">{data.metrics.tier1TasksCompleted}</p>
                      </div>

                      <div className="bg-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs">Avg Response</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {data.metrics.avgConsultationResponseSeconds > 0 
                            ? formatTime(data.metrics.avgConsultationResponseSeconds)
                            : '—'}
                        </p>
                      </div>

                      <div className="bg-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <ComparisonIndicator value={data.comparison.responseTimeVsBenchmark} />
                          <span className="text-xs">vs Benchmark</span>
                        </div>
                        <p className="text-lg font-bold">{data.comparison.benchmarkLabel}</p>
                      </div>
                    </div>

                    {/* Task Breakdown */}
                    <div className="bg-white/5 rounded-2xl p-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Task Breakdown</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <span className="text-sm">Tier 1 (Critical)</span>
                          </div>
                          <span className="font-medium">{data.metrics.tier1TasksCompleted}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                            <span className="text-sm">Tier 2 (High)</span>
                          </div>
                          <span className="font-medium">{data.metrics.tier2TasksCompleted}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                            <span className="text-sm">Tier 3 (Medium)</span>
                          </div>
                          <span className="font-medium">{data.metrics.tier3TasksCompleted}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-sm">Tier 4 (Low)</span>
                          </div>
                          <span className="font-medium">{data.metrics.tier4TasksCompleted}</span>
                        </div>
                      </div>
                    </div>

                    {/* Insights */}
                    {data.insights.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Insights</h3>
                        {data.insights.map((insight, index) => (
                          <div 
                            key={index}
                            className="bg-white/5 rounded-xl p-3 text-sm"
                          >
                            {insight}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No data available for this week.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 px-6 py-4 border-t border-white/5">
                <Button
                  onClick={onClose}
                  className="w-full h-12 rounded-xl font-bold"
                >
                  Got it
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
