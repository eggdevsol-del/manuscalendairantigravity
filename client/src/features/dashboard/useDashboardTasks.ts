import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardTask, ChallengeTemplate, TaskDomain, DashboardConfig } from './types';
import { DashboardEventLogger } from './DashboardEventLogger';
import { DashboardTaskRegister, CHALLENGE_TEMPLATES } from './DashboardTaskRegister';
import { DashboardConfigRegister } from './DashboardConfigRegister';
import { CommsHandler } from './CommsHandler';

const STORAGE_KEY = 'dashboard_v1_store';

interface DashboardState {
    tasks: DashboardTask[];
    socialStreak: number;
    lastVisitDate: string; // ISO Date "YYYY-MM-DD"
    activeChallengeId: string | null;
    challengeStartDate: string | null;
}

const DEFAULT_STATE: DashboardState = {
    tasks: [],
    socialStreak: 0,
    lastVisitDate: '',
    activeChallengeId: null,
    challengeStartDate: null
};

export function useDashboardTasks() {
    const [state, setState] = useState<DashboardState>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
        } catch {
            return DEFAULT_STATE;
        }
    });

    const [config, setConfig] = useState<DashboardConfig>(DashboardConfigRegister.getConfig());

    // Persistence
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);

    // Daily Rotation & Capacity Scaling
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];

        if (state.lastVisitDate !== today) {
            // New Day!

            // 1. Check Previous Day's Clearance for Capacity Scaling (if applicable)
            // Simplified V1 Logic: If we are here, it's a new day. 
            // We should check if yesterday (or rather the last active state) was fully cleared?
            // Realistically we need to check 'yesterday' specifically to count streaks.
            // For V1 Demo: We just rotate tasks. Scaling logic runs weekly typically.
            // Let's implement the Capacity Check:

            // Generate New Tasks
            const newBusiness = DashboardTaskRegister.generateDailyTasks('business');
            const newSocial = DashboardTaskRegister.generateDailyTasks('social');

            // Restore/Regenerate Challenge Tasks
            let newPersonal: DashboardTask[] = [];
            if (state.activeChallengeId) {
                // Find template (Need to import templates or store template data in state. For V1 we assume standard list)
                // In robustness, we'd store the template structure. 
                // We'll regenerate "daily tasks" from the known template ID for now.
                const template = CHALLENGE_TEMPLATES.find((t: ChallengeTemplate) => t.id === state.activeChallengeId);
                if (template) {
                    newPersonal = DashboardTaskRegister.generateChallengeTasks(template);
                }
            }

            // Snoozed Tasks (carry over)
            const snoozedTasks = state.tasks
                .filter(t => t.status === 'snoozed')
                .map(t => ({ ...t, status: 'pending' as const, dueDate: new Date().toISOString() }));

            setConfig(DashboardConfigRegister.getConfig()); // Refresh config

            setState(prev => ({
                ...prev,
                lastVisitDate: today,
                tasks: [...snoozedTasks, ...newBusiness, ...newSocial, ...newPersonal]
            }));
        }
    }, [state.lastVisitDate, state.activeChallengeId]); // Depend on lastVisitDate to trigger only once per day change roughly (in react strict mode might fire twice but state helps)

    // Initial Load
    useEffect(() => {
        if (state.tasks.length === 0 && state.lastVisitDate === '') {
            const newBusiness = DashboardTaskRegister.generateDailyTasks('business');
            const newSocial = DashboardTaskRegister.generateDailyTasks('social');
            const today = new Date().toISOString().split('T')[0];
            setState(prev => ({
                ...prev,
                lastVisitDate: today,
                tasks: [...newBusiness, ...newSocial]
            }));
        }
    }, [state.tasks.length]);


    // --- Actions ---

    const markDone = useCallback((taskId: string) => {
        setState(prev => {
            const task = prev.tasks.find(t => t.id === taskId);
            if (!task) return prev;

            DashboardEventLogger.log(task.domain === 'personal' ? 'challenge_task_completed' : 'task_completed', { taskId, title: task.title });

            const newStreak = task.domain === 'social' ? prev.socialStreak + 1 : prev.socialStreak;

            return {
                ...prev,
                socialStreak: newStreak,
                tasks: prev.tasks.filter(t => t.id !== taskId) // Remove immediately
            };
        });
    }, []);

    const snooze = useCallback((taskId: string) => {
        setState(prev => {
            DashboardEventLogger.log('task_snoozed', { taskId });
            return {
                ...prev,
                tasks: prev.tasks.map(t =>
                    t.id === taskId
                        ? { ...t, status: 'snoozed', dueDate: new Date(Date.now() + 86400000).toISOString() }
                        : t
                )
            };
        });
    }, []);

    const dismiss = useCallback((taskId: string) => {
        setState(prev => {
            DashboardEventLogger.log('task_dismissed', { taskId });
            return {
                ...prev,
                tasks: prev.tasks.filter(t => t.id !== taskId) // Remove
            };
        });
    }, []);

    const startChallenge = useCallback((template: ChallengeTemplate) => {
        const tasks = DashboardTaskRegister.generateChallengeTasks(template);
        DashboardEventLogger.log('challenge_started', { templateId: template.id });

        setState(prev => ({
            ...prev,
            activeChallengeId: template.id,
            challengeStartDate: new Date().toISOString(),
            tasks: [...prev.tasks.filter(t => t.domain !== 'personal'), ...tasks]
        }));
    }, []);

    const stopChallenge = useCallback(() => {
        if (!state.activeChallengeId) return;
        DashboardEventLogger.log('challenge_stopped', { templateId: state.activeChallengeId });

        setState(prev => ({
            ...prev,
            activeChallengeId: null,
            challengeStartDate: null,
            tasks: prev.tasks.filter(t => t.domain !== 'personal') // Clear challenge tasks
        }));
    }, [state.activeChallengeId]);


    // Comms wrappers
    const handleComms = useMemo(() => ({
        email: (payload: string) => CommsHandler.openPrefilledEmail(payload), // payload as 'to'
        sms: (payload: string) => CommsHandler.openPrefilledSms(payload, undefined, config.comms.platform)
    }), [config.comms.platform]);

    // Update comms pref
    const setCommsPlatform = useCallback((platform: 'ios' | 'android' | 'desktop') => {
        DashboardConfigRegister.updateConfig({ comms: { ...config.comms, platform } });
        setConfig(prev => ({ ...prev, comms: { ...prev.comms, platform } }));
    }, [config.comms]);


    // Filter & Limitation Logic (Capacity Scaling)
    // Business/Social obey maxVisibleTasks. Personal obeys nothing (show all).
    const businessTasks = state.tasks
        .filter(t => t.domain === 'business' && t.status !== 'snoozed')
        .sort((a, b) => (a.priority === 'high' ? -1 : 1))
        .slice(0, config.business.maxVisibleTasks);

    const socialTasks = state.tasks
        .filter(t => t.domain === 'social' && t.status !== 'snoozed')
        .sort((a, b) => (a.priority === 'high' ? -1 : 1))
        .slice(0, config.social.maxVisibleTasks);

    const personalTasks = state.tasks
        .filter(t => t.domain === 'personal' && t.status !== 'snoozed')
        .sort((a, b) => (a.priority === 'high' ? -1 : 1));

    return {
        tasks: {
            business: businessTasks,
            social: socialTasks,
            personal: personalTasks
        },
        stats: {
            socialStreak: state.socialStreak,
            activeChallengeId: state.activeChallengeId
        },
        actions: useMemo(() => ({
            markDone,
            snooze,
            dismiss,
            startChallenge,
            stopChallenge,
            handleComms,
            setCommsPlatform
        }), [markDone, snooze, dismiss, startChallenge, stopChallenge, handleComms, setCommsPlatform]),
        config
    };
}
