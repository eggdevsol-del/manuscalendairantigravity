import { useMemo } from "react";
import { useRegisterFABActions } from "@/contexts/BottomNavContext";
import { BarChart3, Settings, Plus, Send, Mail, MessageSquare, Check, ExternalLink, Play, Clock, Trash2 } from "lucide-react";
import { type FABMenuItem } from "@/ui/FABMenu";
import type { ExtendedTask } from "@/pages/Dashboard";

interface DashboardFABActionsProps {
    activeCategory: 'business' | 'social' | 'personal';
    onShowSnapshot: () => void;
    onShowSettings: () => void;
    onShowChallenge: () => void;
    selectedTask?: ExtendedTask | null;
    onExecuteAction?: (task: ExtendedTask) => void;
    onMarkDone?: (task: ExtendedTask) => void;
    onSnooze?: (task: ExtendedTask) => void;
}

export function DashboardFABActions({
    activeCategory,
    onShowSnapshot,
    onShowSettings,
    onShowChallenge,
    selectedTask,
    onExecuteAction,
    onMarkDone,
    onSnooze
}: DashboardFABActionsProps) {
    const fabContent = useMemo<FABMenuItem[]>(() => {
        const items: FABMenuItem[] = [];

        // If a task is selected, show Task Actions instead of Global Dashboard actions
        if (selectedTask) {
            // 1. Primary Action
            if (selectedTask.actionType !== 'none') {
                if (selectedTask.actionType === 'email' && selectedTask._serverTask) {
                    items.push({
                        id: 'task-action-primary',
                        label: 'Send Email',
                        icon: Mail,
                        onClick: () => onExecuteAction?.(selectedTask),
                        highlight: true
                    });
                } else {
                    let IconItem = Play;
                    if (selectedTask.actionType === 'sms') IconItem = MessageSquare;
                    if (selectedTask.actionType === 'social') IconItem = ExternalLink;

                    let label = 'Execute Action';
                    if (selectedTask._serverTask?.actionType === 'sms') label = 'Send SMS';
                    else if (selectedTask._serverTask?.actionType === 'in_app') label = 'Open in App';

                    items.push({
                        id: 'task-action-primary',
                        label,
                        icon: IconItem,
                        onClick: () => onExecuteAction?.(selectedTask),
                        highlight: true
                    });
                }
            }

            // 2. Secondary SMS Action (if available and not primary)
            if (selectedTask._serverTask?.smsNumber && selectedTask._serverTask.actionType !== 'sms') {
                items.push({
                    id: 'task-action-sms',
                    label: 'Send SMS',
                    icon: MessageSquare,
                    onClick: () => {
                        // We can encode a custom payload or just rely on onExecute handling it. 
                        // For simplicity we will rely on onExecute knowing if it's forced, 
                        // but since we don't have businessActions here we'll just skip the deep secondary actions natively and keep the FAB lean.
                    }
                });
            }

            // 3. Mark Completed Action
            items.push({
                id: 'task-mark-done',
                label: 'Mark Completed',
                icon: Check,
                onClick: () => onMarkDone?.(selectedTask)
            });

            // 4. Snooze (legacy only)
            if (!selectedTask._serverTask) {
                items.push({
                    id: 'task-snooze',
                    label: 'Snooze 24h',
                    icon: Clock,
                    onClick: () => onSnooze?.(selectedTask)
                });
            }

            return items;
        }

        // Snapshot only for business
        if (activeCategory === 'business') {
            items.push({
                id: 'snapshot',
                label: 'Weekly Snapshot',
                icon: BarChart3,
                onClick: onShowSnapshot,
                highlight: true
            });
        }

        // New challenge for personal
        if (activeCategory === 'personal') {
            items.push({
                id: 'new-challenge',
                label: 'New Challenge',
                icon: Plus,
                onClick: onShowChallenge,
                highlight: true
            });
        }

        // Settings always available for dashboard
        items.push({
            id: 'dashboard-settings',
            label: 'Dashboard Settings',
            icon: Settings,
            onClick: onShowSettings
        });

        return items;
    }, [activeCategory, onShowSnapshot, onShowSettings, onShowChallenge, selectedTask, onExecuteAction, onMarkDone, onSnooze]);

    useRegisterFABActions("dashboard", fabContent);

    return null;
}
