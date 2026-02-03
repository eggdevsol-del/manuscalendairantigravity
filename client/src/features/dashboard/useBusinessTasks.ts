/**
 * useBusinessTasks Hook
 * 
 * Fetches business tasks from the server using the Revenue Protection Algorithm.
 * Handles task completion tracking with time-to-completion metrics.
 */

import { useState, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';

export interface BusinessTask {
  taskType: string;
  taskTier: 'tier1' | 'tier2' | 'tier3' | 'tier4';
  title: string;
  context: string;
  priorityScore: number;
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  clientId: string | null;
  clientName: string | null;
  actionType: 'in_app' | 'sms' | 'email' | 'external';
  smsNumber: string | null;
  smsBody: string | null;
  emailRecipient: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  deepLink: string | null;
  dueAt: string | null;
  expiresAt: string | null;
}

interface TaskStartInfo {
  taskType: string;
  startedAt: string;
  relatedEntityId: string | null;
}

export function useBusinessTasks() {
  // Track started tasks (for time-to-completion calculation)
  const startedTasksRef = useRef<Map<string, TaskStartInfo>>(new Map());
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  // Fetch business tasks from server
  const {
    data,
    isLoading,
    refetch
  } = trpc.dashboardTasks.getBusinessTasks.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });

  // Get settings
  const { data: settings } = trpc.dashboardTasks.getSettings.useQuery();

  // Mutations
  const completeTaskMutation = trpc.dashboardTasks.completeTask.useMutation({
    onSuccess: () => {
      refetch();
    }
  });

  // Generate unique key for task
  const getTaskKey = (task: BusinessTask): string => {
    return `${task.taskType}-${task.relatedEntityId || 'none'}`;
  };

  // Start tracking a task (called when user selects a task)
  const startTask = useCallback((task: BusinessTask) => {
    const key = getTaskKey(task);
    if (!startedTasksRef.current.has(key)) {
      startedTasksRef.current.set(key, {
        taskType: task.taskType,
        startedAt: new Date().toISOString(),
        relatedEntityId: task.relatedEntityId
      });
    }
    return startedTasksRef.current.get(key)!.startedAt;
  }, []);

  // Complete a task (records completion with time tracking)
  const completeTask = useCallback(async (
    task: BusinessTask,
    actionTaken?: 'in_app' | 'sms' | 'email' | 'manual'
  ) => {
    const key = getTaskKey(task);
    const startInfo = startedTasksRef.current.get(key);

    // Use stored start time or current time if not tracked
    const startedAt = startInfo?.startedAt || new Date().toISOString();

    setCompletingTask(key);

    try {
      await completeTaskMutation.mutateAsync({
        taskType: task.taskType,
        taskTier: task.taskTier,
        relatedEntityType: task.relatedEntityType,
        relatedEntityId: task.relatedEntityId,
        clientId: task.clientId,
        priorityScore: task.priorityScore,
        startedAt,
        actionTaken
      });

      // Clean up tracking
      startedTasksRef.current.delete(key);
    } finally {
      setCompletingTask(null);
    }
  }, [completeTaskMutation]);

  // Open native SMS app with pre-populated content
  const openSms = useCallback((task: BusinessTask) => {
    if (!task.smsNumber) return;

    // Start tracking
    startTask(task);

    // Detect platform and construct SMS URL
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const number = task.smsNumber.replace(/\D/g, ''); // Remove non-digits
    const body = task.smsBody ? encodeURIComponent(task.smsBody) : '';

    let smsUrl = `sms:${number}`;
    if (body) {
      if (isIOS) {
        smsUrl += `&body=${body}`;
      } else {
        smsUrl += `?body=${body}`;
      }
    }

    window.location.href = smsUrl;
  }, [startTask]);

  const openEmail = useCallback((task: BusinessTask, preferredClient?: string) => {
    if (!task.emailRecipient) return;

    // Start tracking
    startTask(task);

    const to = encodeURIComponent(task.emailRecipient);
    const subject = encodeURIComponent(task.emailSubject || '');
    const body = encodeURIComponent(task.emailBody || '');

    // Fallback to mailto as default safe URL
    let emailUrl = `mailto:${task.emailRecipient}?subject=${subject}&body=${body}`;

    // Detect platform
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;

    // Debug logging
    console.log('openEmail called', {
      task,
      preferredClient,
      isMobile,
      userAgent: navigator.userAgent
    });

    // On mobile, try to open the specific app with deep links
    if (isMobile) {
      if (preferredClient === 'gmail') {
        // Gmail App Scheme: googlegmail:///co?to=...
        emailUrl = `googlegmail:///co?to=${to}&subject=${subject}&body=${body}`;
      } else if (preferredClient === 'outlook') {
        // Outlook App Scheme: ms-outlook://compose?to=...
        emailUrl = `ms-outlook://compose?to=${to}&subject=${subject}&body=${body}`;
      }
      // Else keep default mailto
    } else {
      // Desktop / Web Fallbacks
      switch (preferredClient) {
        case 'gmail':
          emailUrl = `https://mail.google.com/mail/?view=cm&to=${to}&su=${subject}&body=${body}`;
          break;
        case 'outlook':
          emailUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}`;
          break;
        default:
          // Keep default mailto
          break;
      }
    }

    console.log('Opening email URL:', emailUrl);

    if (!isMobile && (preferredClient === 'gmail' || preferredClient === 'outlook')) {
      window.open(emailUrl, '_blank');
    } else {
      // Use window.open for better intent handling on Mobile
      window.open(emailUrl, '_self');
    }
  }, [startTask]);

  // Navigate to in-app location
  const navigateToTask = useCallback((task: BusinessTask, navigate: (path: string) => void) => {
    if (!task.deepLink) return;

    // Start tracking
    startTask(task);

    navigate(task.deepLink);
  }, [startTask]);

  // Map priority level to legacy priority format
  const mapPriorityLevel = (level: 'critical' | 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' => {
    if (level === 'critical') return 'high';
    return level;
  };

  // Transform tasks to match existing UI format
  const transformedTasks = (data?.tasks || []).map(task => ({
    id: `${task.taskType}-${task.relatedEntityId || Date.now()}`,
    title: task.title,
    context: task.context,
    priority: mapPriorityLevel(task.priorityLevel),
    status: 'pending' as const,
    actionType: task.actionType === 'in_app' ? 'internal' : task.actionType,
    domain: 'business' as const,
    // Original task data for actions
    _serverTask: task
  }));

  return {
    tasks: transformedTasks,
    isLoading,
    settings: {
      maxVisibleTasks: settings?.maxVisibleTasks || 10,
      preferredEmailClient: settings?.preferredEmailClient || 'default'
    },
    actions: {
      startTask,
      completeTask,
      openSms,
      openEmail,
      navigateToTask,
      refetch
    },
    completingTask
  };
}

/**
 * Hook for weekly analytics snapshot
 */
export function useWeeklySnapshot() {
  const utils = trpc.useUtils();

  const { data: shouldShow, refetch: refetchShouldShow } = trpc.dashboardTasks.shouldShowWeeklySnapshot.useQuery(undefined, {
    // Don't refetch on window focus to prevent re-showing after dismiss
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const { data: snapshot, isLoading } = trpc.dashboardTasks.getWeeklySnapshot.useQuery(undefined, {
    enabled: shouldShow?.shouldShow === true
  });

  const dismissMutation = trpc.dashboardTasks.dismissWeeklySnapshot.useMutation({
    onSuccess: () => {
      // Immediately set shouldShow to false to prevent re-showing
      utils.dashboardTasks.shouldShowWeeklySnapshot.setData(undefined, { shouldShow: false });
    }
  });

  const dismiss = useCallback(async () => {
    try {
      await dismissMutation.mutateAsync();
    } catch (error) {
      // Even if server fails, prevent re-showing in this session
      utils.dashboardTasks.shouldShowWeeklySnapshot.setData(undefined, { shouldShow: false });
      console.error('Failed to dismiss snapshot:', error);
    }
  }, [dismissMutation, utils]);

  // Function to manually trigger showing the snapshot (for the button)
  const showManually = useCallback(() => {
    // This just returns true to allow manual display
    // The actual display is controlled by the component
  }, []);

  return {
    shouldShow: shouldShow?.shouldShow || false,
    snapshot,
    isLoading,
    dismiss,
    refetch: refetchShouldShow
  };
}

/**
 * Hook for dashboard settings
 */
export function useDashboardSettings() {
  const { data: settings, refetch } = trpc.dashboardTasks.getSettings.useQuery();
  const updateMutation = trpc.dashboardTasks.updateSettings.useMutation({
    onSuccess: () => refetch()
  });

  const updateSettings = useCallback(async (updates: {
    maxVisibleTasks?: number;
    goalAdvancedBookingMonths?: number;
    preferredEmailClient?: 'default' | 'gmail' | 'outlook' | 'apple_mail';
    showWeeklySnapshot?: boolean;
  }) => {
    await updateMutation.mutateAsync(updates);
  }, [updateMutation]);

  return {
    settings: settings || {
      maxVisibleTasks: 10,
      goalAdvancedBookingMonths: 3,
      preferredEmailClient: 'default' as const,
      showWeeklySnapshot: true
    },
    updateSettings,
    isUpdating: updateMutation.isPending
  };
}


/**
 * Hook for dashboard quick stats (header display)
 * Returns key metrics for artist at-a-glance view
 */
export function useQuickStats() {
  const { data, isLoading, refetch } = trpc.dashboardTasks.getQuickStats.useQuery(undefined, {
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    stats: data || {
      bookingsThisWeek: 0,
      openDatesThisMonth: 0,
      newEnquiries: 0,
      weekLabel: '',
      monthLabel: ''
    },
    isLoading,
    refetch
  };
}
