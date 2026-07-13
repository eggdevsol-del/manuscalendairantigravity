/**
 * useBusinessTasks Hook
 *
 * Fetches business tasks from the server using the Revenue Protection Algorithm.
 * Handles task completion tracking with time-to-completion metrics.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";

export interface BusinessTask {
  taskType: string;
  taskTier: "tier1" | "tier2" | "tier3" | "tier4";
  title: string;
  context: string;
  priorityScore: number;
  priorityLevel: "critical" | "high" | "medium" | "low";
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  clientId: string | null;
  clientName: string | null;
  actionType: "in_app" | "sms" | "email" | "external";
  smsNumber: string | null;
  smsBody: string | null;
  emailRecipient: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  deepLink: string | null;
  conversationId: number | null;
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
  const { data, isLoading, refetch } =
    trpc.dashboardTasks.getBusinessTasks.useQuery(undefined, {
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    });

  // Get settings
  const { data: settings } = trpc.dashboardTasks.getSettings.useQuery();

  // Mutations
  const completeTaskMutation = trpc.dashboardTasks.completeTask.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Generate unique key for task
  const getTaskKey = (task: BusinessTask): string => {
    return `${task.taskType}-${task.relatedEntityId || "none"}`;
  };

  // Start tracking a task (called when user selects a task)
  const startTask = useCallback((task: BusinessTask) => {
    const key = getTaskKey(task);
    if (!startedTasksRef.current.has(key)) {
      startedTasksRef.current.set(key, {
        taskType: task.taskType,
        startedAt: new Date().toISOString(),
        relatedEntityId: task.relatedEntityId,
      });
    }
    return startedTasksRef.current.get(key)!.startedAt;
  }, []);

  // Complete a task (records completion with time tracking)
  const completeTask = useCallback(
    async (
      task: BusinessTask,
      actionTaken?: "in_app" | "sms" | "email" | "manual"
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
          actionTaken,
        });

        // Clean up tracking
        startedTasksRef.current.delete(key);
      } finally {
        setCompletingTask(null);
      }
    },
    [completeTaskMutation]
  );

  // Open native SMS app with pre-populated content
  const openSms = useCallback(
    (task: BusinessTask) => {
      if (!task.smsNumber) return;

      // Start tracking
      startTask(task);

      // Detect platform and construct SMS URL
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const number = task.smsNumber.replace(/\D/g, ""); // Remove non-digits
      const body = task.smsBody ? encodeURIComponent(task.smsBody) : "";

      let smsUrl = `sms:${number}`;
      if (body) {
        if (isIOS) {
          smsUrl += `&body=${body}`;
        } else {
          smsUrl += `?body=${body}`;
        }
      }

      // Dynamic anchor tag for PWA/Safari compatibility
      const a = document.createElement("a");
      a.href = smsUrl;
      a.target = "_top";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [startTask]
  );

  // Professional Email Templates mapping
  // Server-generated emailBody/emailSubject are preferred when available
  // (they contain real data: dates, deposit amounts, bank details).
  // These client-side templates are fallbacks only.
  const getProfessionalEmail = useCallback(
    (task: BusinessTask, businessName: string | null) => {
      const cFirst = (task.clientName || "there").split(" ")[0];

      // If the server provided a pre-built email, use it directly
      if (task.emailBody && task.emailSubject) {
        return { subject: task.emailSubject, body: task.emailBody };
      }

      // Fallback: client-side templates (no sign-offs — artist has email signature)
      switch (task.taskType) {
        case "lead_follow_up":
          return {
            subject: `Following up on your enquiry`,
            body: `Hi ${cFirst},\n\nJust following up on your project enquiry. Have you had a chance to think about what we discussed?\n\nLet me know if you have any questions or would like to move forward.`,
          };
        case "deposit_collection":
          return {
            subject: `Deposit reminder for your upcoming appointment`,
            body: `Hi ${cFirst},\n\nJust a reminder that a deposit is required to secure your booking. Once received, I'll send through a confirmation.\n\nPlease let me know if you have any questions.`,
          };
        case "appointment_confirmation":
          return {
            subject: `Confirming your upcoming appointment`,
            body: `Hi ${cFirst},\n\nJust confirming your upcoming appointment. Looking forward to seeing you.\n\nPlease let me know if anything changes.`,
          };
        case "post_appointment_thankyou":
          return {
            subject: `Thank you for coming in`,
            body: `Hi ${cFirst},\n\nThank you for coming in today. I hope you're happy with how it turned out.\n\nLet me know if you have any questions about the healing process.`,
          };
        case "healed_photo_request":
          return {
            subject: `Would love to see your healed result`,
            body: `Hi ${cFirst},\n\nHope your tattoo has healed nicely. If you get a chance, I'd love to see a healed photo for my portfolio.\n\nNo pressure at all — only if you're happy to.`,
          };
        case "birthday_outreach":
          return {
            subject: `Happy Birthday!`,
            body: `Hi ${cFirst},\n\nJust wanted to wish you a Happy Birthday! Hope you have a great day.`,
          };
        case "new_lead":
          return {
            subject: `Thanks for your enquiry`,
            body: `Hi ${cFirst},\n\nThanks for reaching out. I've received your enquiry and will get back to you shortly to discuss your project.`,
          };
        case "new_consultation":
          return {
            subject: `Consultation request received`,
            body: `Hi ${cFirst},\n\nThanks for your consultation request. I'll review the details and get back to you with some availability shortly.`,
          };
        case "follow_up_responded":
          return {
            subject: `Re: Your project`,
            body: `Hi ${cFirst},\n\nThanks for getting back to me. I've seen your message and will follow up shortly.`,
          };
        case "stale_conversation":
          return {
            subject: `Checking in`,
            body: `Hi ${cFirst},\n\nIt's been a little while since we last spoke. I wanted to check in and see if you're still interested in moving forward with your project.\n\nNo rush — just let me know.`,
          };
        case "tattoo_anniversary":
          return {
            subject: `Happy Tattoo Anniversary!`,
            body: `Hi ${cFirst},\n\nHappy anniversary! It's been a year since we did your piece. Hope it's still looking great.`,
          };
        default:
          return {
            subject: task.emailSubject || `Following up`,
            body: task.emailBody || `Hi ${cFirst},\n\nJust reaching out regarding your project. Let me know if you have any questions.`,
          };
      }
    },
    []
  );

  // Helper to generate Email URL (exported for use in UI)
  const getTaskEmailUrl = useCallback(
    (task: BusinessTask) => {
      if (!task.emailRecipient) return "";

      const { subject, body } = getProfessionalEmail(
        task,
        settings?.businessName || null
      );

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
        emailUrl += `?${params.join("&")}`;
      }

      return emailUrl;
    },
    [getProfessionalEmail, settings]
  );

  const openEmail = useCallback(
    (task: BusinessTask) => {
      if (!task.emailRecipient) return;

      // Start tracking
      startTask(task);

      const emailUrl = getTaskEmailUrl(task);

      // Dynamic anchor tag for PWA/Safari compatibility
      const a = document.createElement("a");
      a.href = emailUrl;
      a.target = "_top";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [startTask, getTaskEmailUrl]
  );

  // Navigate to in-app location
  const navigateToTask = useCallback(
    (task: BusinessTask, navigate: (path: string) => void) => {
      if (!task.deepLink) return;

      // Start tracking
      startTask(task);

      navigate(task.deepLink);
    },
    [startTask]
  );

  // Map priority level to legacy priority format
  const mapPriorityLevel = (
    level: "critical" | "high" | "medium" | "low"
  ): "high" | "medium" | "low" => {
    if (level === "critical") return "high";
    return level;
  };

  // Transform tasks to match existing UI format
  const transformedTasks = (data?.tasks || []).map(task => ({
    id: `${task.taskType}-${task.relatedEntityId || Date.now()}`,
    title: task.title,
    context: task.context,
    priority: mapPriorityLevel(task.priorityLevel),
    status: "pending" as const,
    actionType: task.actionType === "in_app" ? "internal" : task.actionType,
    domain: "business" as const,
    // Original task data for actions
    _serverTask: task,
    _conversationId: task.conversationId ?? null,
  }));

  return {
    tasks: transformedTasks,
    isLoading,
    settings: {
      maxVisibleTasks: settings?.maxVisibleTasks || 10,
      preferredEmailClient: settings?.preferredEmailClient || "default",
      businessEmail: settings?.businessEmail || null,
      businessName: settings?.businessName || null,
    },
    actions: useMemo(
      () => ({
        startTask,
        completeTask,
        openSms,
        openEmail,
        getTaskEmailUrl,
        navigateToTask,
        refetch,
      }),
      [
        startTask,
        completeTask,
        openSms,
        openEmail,
        getTaskEmailUrl,
        navigateToTask,
        refetch,
      ]
    ),
    completingTask,
  };
}

/**
 * Hook for weekly analytics snapshot
 */
export function useWeeklySnapshot() {
  const utils = trpc.useUtils();

  const { data: shouldShow, refetch: refetchShouldShow } =
    trpc.dashboardTasks.shouldShowWeeklySnapshot.useQuery(undefined, {
      // Don't refetch on window focus to prevent re-showing after dismiss
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 60, // 1 hour
    });

  const { data: snapshot, isLoading } =
    trpc.dashboardTasks.getWeeklySnapshot.useQuery(undefined, {
      enabled: shouldShow?.shouldShow === true,
    });

  const dismissMutation = trpc.dashboardTasks.dismissWeeklySnapshot.useMutation(
    {
      onSuccess: () => {
        // Immediately set shouldShow to false to prevent re-showing
        utils.dashboardTasks.shouldShowWeeklySnapshot.setData(undefined, {
          shouldShow: false,
        });
      },
    }
  );

  const dismiss = useCallback(async () => {
    try {
      await dismissMutation.mutateAsync();
    } catch (error) {
      // Even if server fails, prevent re-showing in this session
      utils.dashboardTasks.shouldShowWeeklySnapshot.setData(undefined, {
        shouldShow: false,
      });
      console.error("Failed to dismiss snapshot:", error);
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
    refetch: refetchShouldShow,
  };
}

/**
 * Hook for dashboard settings
 */
export function useDashboardSettings() {
  const { data: settings, refetch } =
    trpc.dashboardTasks.getSettings.useQuery();
  const updateMutation = trpc.dashboardTasks.updateSettings.useMutation({
    onSuccess: () => refetch(),
  });

  const updateSettings = useCallback(
    async (updates: {
      maxVisibleTasks?: number;
      goalAdvancedBookingMonths?: number;
      preferredEmailClient?: "default" | "gmail" | "outlook" | "apple_mail";
      showWeeklySnapshot?: boolean;
    }) => {
      await updateMutation.mutateAsync(updates);
    },
    [updateMutation]
  );

  const defaultSettings = useMemo(
    () => ({
      maxVisibleTasks: 10,
      goalAdvancedBookingMonths: 3,
      preferredEmailClient: "default" as const,
      showWeeklySnapshot: true,
    }),
    []
  );

  return {
    settings: settings || defaultSettings,
    updateSettings,
    isUpdating: updateMutation.isPending,
  };
}

/**
 * Hook for dashboard quick stats (header display)
 * Returns key metrics for artist at-a-glance view
 */
export function useQuickStats() {
  const { data, isLoading, refetch } =
    trpc.dashboardTasks.getQuickStats.useQuery(undefined, {
      refetchOnWindowFocus: true,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

  return {
    stats: data || {
      bookingsThisWeek: 0,
      openDatesThisMonth: 0,
      newEnquiries: 0,
      weekLabel: "",
      monthLabel: "",
    },
    isLoading,
    refetch,
  };
}
