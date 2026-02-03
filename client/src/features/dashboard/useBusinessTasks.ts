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

  // Professional Email Templates mapping
  const getProfessionalEmail = useCallback((task: BusinessTask, businessName: string | null) => {
    const bName = businessName || 'My Business';
    const cName = task.clientName || 'there';

    // Default fallback (using what's already in the task if available)
    let subject = task.emailSubject || `Message from ${bName}`;
    let body = task.emailBody || `Hi ${cName},\n\nI'm reaching out regarding our project at ${bName}.\n\nRegards,\n\n${bName}`;

    // Task-specific templates
    switch (task.taskType) {
      case 'lead_follow_up':
        subject = `Follow up: Your inquiry with ${bName}`;
        body = `Hi ${cName},\n\nJust wanted to follow up on your project inquiry with ${bName}. Did you have any more thoughts or questions?\n\nLooking forward to hearing from you!\n\nRegards,\n\n${bName}`;
        break;
      case 'deposit_collection':
        subject = `Secure your booking with ${bName}`;
        body = `Hi ${cName},\n\nTo finalize your booking with ${bName}, please send through your deposit. This secures your spot in my calendar!\n\nOnce received, I'll send through a final confirmation.\n\nRegards,\n\n${bName}`;
        break;
      case 'appointment_confirmation':
        subject = `Confirming your appointment with ${bName}`;
        body = `Hi ${cName},\n\nI'm confirming your appointment with ${bName}. I'm looking forward to working on your project!\n\nRegards,\n\n${bName}`;
        break;
      case 'post_appointment_thankyou':
        subject = `Thank you from ${bName}`;
        body = `Hi ${cName},\n\nThank you so much for coming in! It was a pleasure working with you. I hope you're happy with the results.\n\nPlease let me know if you have any questions about the healing process.\n\nRegards,\n\n${bName}`;
        break;
      case 'healed_photo_request':
        subject = `Healed photos for ${bName}`;
        body = `Hi ${cName},\n\nI hope your tattoo is healing well! If you have a moment, I'd love to see some healed photos of our project for my portfolio.\n\nRegards,\n\n${bName}`;
        break;
      case 'birthday_outreach':
        subject = `Happy Birthday from ${bName}!`;
        body = `Hi ${cName},\n\nHappy Birthday! Wishing you a fantastic day from everyone at ${bName}.\n\nRegards,\n\n${bName}`;
        break;
      case 'new_lead':
        subject = `Inquiry received: ${bName}`;
        body = `Hi ${cName},\n\nThanks for reaching out to ${bName}! I've received your inquiry and will be in touch shortly to discuss your project.\n\nRegards,\n\n${bName}`;
        break;
      case 'new_consultation':
        subject = `Consultation request: ${bName}`;
        body = `Hi ${cName},\n\nThanks for your consultation request with ${bName}. I've received all the details and will get back to you with some possible dates/times soon.\n\nRegards,\n\n${bName}`;
        break;
      case 'follow_up_responded':
        subject = `Re: Your project with ${bName}`;
        body = `Hi ${cName},\n\nThanks for getting back to me! I've seen your latest message and will review it shortly.\n\nRegards,\n\n${bName}`;
        break;
      case 'stale_conversation':
        subject = `Checking in: Your project with ${bName}`;
        body = `Hi ${cName},\n\nIt's been a little while since we last spoke about your project. I wanted to check in and see if you were still interested in moving forward?\n\nRegards,\n\n${bName}`;
        break;
      case 'tattoo_anniversary':
        subject = `Happy Tattoo Anniversary from ${bName}!`;
        body = `Hi ${cName},\n\nHappy Tattoo Anniversary! It's been a year since our project together. Hope it's still looking great!\n\nRegards,\n\n${bName}`;
        break;
    }

    return { subject, body };
  }, []);

  // Helper to generate Email URL (exported for use in UI)
  const getTaskEmailUrl = useCallback((task: BusinessTask) => {
    if (!task.emailRecipient) return '';

    const { subject, body } = getProfessionalEmail(task, settings?.businessName || null);

    let emailUrl = `mailto:${task.emailRecipient}`;
    const params: string[] = [];

    // Add professional content
    params.push(`subject=${encodeURIComponent(subject)}`);
    params.push(`body=${encodeURIComponent(body)}`);

    // Try to include sender hint (Note: not standard but some clients like apple mail/outlook mobile might use it)
    if (settings?.businessEmail) {
      params.push(`cc=${encodeURIComponent(settings.businessEmail)}`); // BCC or CC yourself is a safe way to 'hint' the sender
    }

    if (params.length > 0) {
      emailUrl += `?${params.join('&')}`;
    }

    return emailUrl;
  }, [getProfessionalEmail, settings]);

  const openEmail = useCallback((task: BusinessTask) => {
    if (!task.emailRecipient) return;

    // Start tracking
    startTask(task);

    const emailUrl = getTaskEmailUrl(task);

    console.log('Opening email URL:', emailUrl);

    // Standard mailto handling
    window.location.href = emailUrl;
  }, [startTask, getTaskEmailUrl]);

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
      preferredEmailClient: settings?.preferredEmailClient || 'default',
      businessEmail: settings?.businessEmail || null,
      businessName: settings?.businessName || null
    },
    actions: {
      startTask,
      completeTask,
      openSms,
      openEmail,
      getTaskEmailUrl,
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
