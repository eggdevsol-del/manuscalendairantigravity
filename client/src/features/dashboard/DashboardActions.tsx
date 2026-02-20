import { useMemo } from "react";
import { useRegisterFABActions } from "@/contexts/BottomNavContext";
import { BarChart3, Settings, Plus, Send, Mail, MessageSquare, Check, ExternalLink, Play, Clock, Trash2, Smartphone } from "lucide-react";
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
    onGoToChat?: (task: ExtendedTask) => void;
}

export function DashboardFABActions({
    activeCategory,
    onShowSnapshot,
    onShowSettings,
    onShowChallenge,
    selectedTask,
    onExecuteAction,
    onMarkDone,
    onSnooze,
    onGoToChat
}: DashboardFABActionsProps) {
    const fabContent = useMemo<FABMenuItem[]>(() => {
        const items: FABMenuItem[] = [];

        // If a task is selected, show Task Actions instead of Global Dashboard actions
        if (selectedTask) {
            if (selectedTask._serverTask) {
                // FOUR FIXED ACTIONS FOR BUSINESS TASKS

                // 1. Send Email
                items.push({
                    id: 'task-action-email',
                    label: 'Send Email',
                    icon: Mail,
                    onClick: () => {
                        // Mutate action payload temporarily to map to email just in case
                        const tempTask = { ...selectedTask, actionType: 'email' as const };
                        onExecuteAction?.(tempTask);
                    }
                });

                // 2. Send SMS
                if (selectedTask._serverTask.smsNumber) {
                    items.push({
                        id: 'task-action-sms',
                        label: 'Send SMS',
                        icon: Smartphone,
                        onClick: () => {
                            const tempTask = { ...selectedTask, actionType: 'sms' as const };
                            onExecuteAction?.(tempTask);
                        }
                    });
                }

                // 3. Mark Completed (Green)
                items.push({
                    id: 'task-mark-done',
                    label: 'Mark Completed',
                    icon: Check,
                    onClick: () => onMarkDone?.(selectedTask),
                    className: "text-green-400"
                });

                // 4. Go to Messages
                if (selectedTask._serverTask.clientId) {
                    items.push({
                        id: 'task-goto-chat',
                        label: 'Go to Messages',
                        icon: MessageSquare,
                        onClick: () => onGoToChat?.(selectedTask)
                    });
                }
            } else {
                // LEGACY TASKS (Personal / Social)
                // 1. Primary Action
                if (selectedTask.actionType !== 'none') {
                    if (selectedTask.actionType === 'email') {
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

                        items.push({
                            id: 'task-action-primary',
                            label: 'Execute Action',
                            icon: IconItem,
                            onClick: () => onExecuteAction?.(selectedTask),
                            highlight: true
                        });
                    }
                }

                // 2. Mark Completed Action
                items.push({
                    id: 'task-mark-done',
                    label: 'Mark Completed',
                    icon: Check,
                    onClick: () => onMarkDone?.(selectedTask)
                });

                // 3. Snooze 
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
