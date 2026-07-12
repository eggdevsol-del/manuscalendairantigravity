import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  Dialog,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { useDashboardTasks } from "@/features/dashboard/useDashboardTasks";
import {
  useBusinessTasks,
  useDashboardSettings,
  type BusinessTask as ServerBusinessTask,
} from "@/features/dashboard/useBusinessTasks";
import { CHALLENGE_TEMPLATES } from "@/features/dashboard/DashboardTaskRegister";
import { DashboardTask, ChallengeTemplate } from "@/features/dashboard/types";
import {
  PageShell,
  PageHeader,
  GlassSheet,
  FullScreenSheet,
  TaskCard,
  SegmentedHeader,
} from "@/components/ui/ssot";
import type { TaskCardAction } from "@/components/ui/ssot/TaskCard";
import { tokens } from "@/ui/tokens";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  X,
  Check,
  Clock,
  ExternalLink,
  MessageSquare,
  Mail,
  Play,
  Plus,
  Trash2,
  Smartphone,
  Monitor,
  ChevronRight,
  Settings,
} from "lucide-react";
import { SyncOverlay } from "@/features/onboarding/SyncOverlay";
import { Card } from "@/components/ui/card";
import { useTeaser } from "@/contexts/TeaserContext";
import { InstallAppModal } from "@/components/modals/InstallAppModal";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SetupChecklistWidget } from "@/features/onboarding/SetupChecklistWidget";
import { MerchantSetupStepper } from "@/features/onboarding/MerchantSetupStepper";

import { DashboardFABActions } from "@/features/dashboard/DashboardActions";
import { PayoutWidgetContainer } from "@/features/payouts/PayoutWidgetContainer";
import { OrdersTab } from "@/features/dashboard/OrdersTab";
import { ContactsTab } from "@/features/dashboard/ContactsTab";
import { MerchantDashboard } from "@/features/merchant/Dashboard";

// SSOT Components

// --- Types ---

// Extended task type that can hold either legacy or server task data
export interface ExtendedTask {
  id: string;
  title: string;
  context?: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "completed" | "dismissed" | "snoozed";
  actionType:
  | "sms"
  | "email"
  | "social"
  | "internal"
  | "in_app"
  | "link"
  | "external"
  | "none";
  actionPayload?: string;
  domain: "business" | "social" | "personal";
  _serverTask?: ServerBusinessTask;
}

// --- Components ---

function EmptyState({
  category,
  onAction,
}: {
  category: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-64">
      <p className="text-muted-foreground/50 text-base font-medium">
        {category === "Personal" && !onAction
          ? "You're crushing it."
          : "All clear for " + category + "."}
      </p>
      {category === "Personal" && onAction && (
        <div className="mt-6">
          <Button variant="hero" onClick={onAction}>
            Start New Challenge
          </Button>
        </div>
      )}
      {category !== "Personal" && (
        <p className="text-muted-foreground/30 text-sm mt-1">
          Relax and recharge.
        </p>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
      <p className="text-muted-foreground/50 text-sm">Loading tasks...</p>
    </div>
  );
}

const TITLES = ["Business", "Orders", "Contacts"];

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedDate = new Date();


  // Redirect Studio users
  useEffect(() => {
    if (user?.role === "studio") {
      setLocation("/studio");
    }
  }, [user, setLocation]);

  // Legacy Feature Hook (for Social and Personal)
  const {
    tasks: legacyTasks,
    actions: legacyActions,
    stats,
    config,
  } = useDashboardTasks();

  // New Business Tasks Hook (Revenue Protection Algorithm)
  const {
    tasks: businessTasks,
    isLoading: businessLoading,
    settings: businessSettings,
    actions: businessActions,
    completingTask,
  } = useBusinessTasks();

  // Teaser Mode
  const { isTeaserClient } = useTeaser();
  const [showInstallModal, setShowInstallModal] = useState(false);

  // UI State
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [showChallengeSheet, setShowChallengeSheet] = useState(false);
  const [taskStartTime, setTaskStartTime] = useState<string | null>(null);

  // Derived State
  const activeCategory = TITLES[activeIndex].toLowerCase() as
    | "business"
    | "orders"
    | "contacts";

  // Transform legacy task to ExtendedTask
  const transformLegacyTask = (task: DashboardTask): ExtendedTask => ({
    id: task.id,
    title: task.title,
    context: task.context,
    priority: task.priority,
    status: task.status,
    actionType: task.actionType,
    actionPayload: task.actionPayload,
    domain: task.domain,
  });

  // Get current tasks based on category
  const getCurrentTasks = (): ExtendedTask[] => {
    if (activeCategory === "business") {
      // Use server-generated business tasks
      return (businessTasks || []).map(
        task =>
          ({
            id: task.id,
            title: task.title,
            context: task.context,
            priority: task.priority,
            status: task.status as ExtendedTask["status"],
            actionType: task.actionType as ExtendedTask["actionType"],
            domain: "business" as const,
            _serverTask: task._serverTask,
          }) as ExtendedTask
      );
    }
    if (activeCategory === "contacts" || activeCategory === "orders") {
      return [];
    }
    // Use legacy tasks for personal (if any remaining)
    const tasks = legacyTasks?.["personal"] || [];
    return (tasks || []).map(transformLegacyTask);
  };

  const currentTasks = getCurrentTasks();

  // Find the currently expanded task object
  const expandedTask = useMemo(() => {
    if (!expandedTaskId) return null;
    return currentTasks.find(t => t.id === expandedTaskId) ?? null;
  }, [expandedTaskId, currentTasks]);

  // Extract conversationId from expanded task's deepLink (e.g. /chat/123)
  const expandedTaskConversationId = useMemo(() => {
    if (!expandedTask?._serverTask?.deepLink) return null;
    const match = expandedTask._serverTask.deepLink.match(/\/chat\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }, [expandedTask]);

  // Fetch LLM conversation context for the expanded task
  const { data: conversationState, isLoading: briefLoading } = trpc.designBrief.conversationState.useQuery(
    { conversationId: expandedTaskConversationId! },
    { enabled: !!expandedTaskConversationId }
  );

  // LLM draft generation for Email/SMS
  const generateDraft = trpc.designBrief.generateDraft.useMutation();
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Handlers
  const handleTaskClick = useCallback(
    (task: ExtendedTask) => {
      // Toggle: collapse if already expanded, expand if different
      if (expandedTaskId === task.id) {
        setExpandedTaskId(null);
        return;
      }

      setExpandedTaskId(task.id);

      // Start tracking time for business tasks
      if (task._serverTask) {
        const startTime = businessActions.startTask(task._serverTask);
        setTaskStartTime(startTime);
      }
    },
    [expandedTaskId, businessActions]
  );

  const executeAction = useCallback(
    async (task: ExtendedTask) => {
      const serverTask = task._serverTask;

      if (serverTask) {
        // Use the explicit task.actionType override if present, otherwise fallback
        const actionToExecute = task.actionType || serverTask.actionType;

        // Handle server-generated business tasks
        switch (actionToExecute) {
          case "sms":
            if (serverTask.smsNumber) {
              businessActions.openSms(serverTask);
            }
            break;
          case "email":
            if (serverTask.emailRecipient) {
              businessActions.openEmail(serverTask);
            }
            break;
          case "in_app":
            if (serverTask.deepLink) {
              businessActions.navigateToTask(serverTask, setLocation);
            }
            break;
          case "external":
            // Handle external links if needed
            break;
        }
      } else {
        // Handle legacy tasks
        const { actionType, actionPayload } = task;
        if (actionType === "email" && actionPayload)
          return legacyActions.handleComms.email(actionPayload);
        if (actionType === "sms" && actionPayload)
          return legacyActions.handleComms.sms(actionPayload);
        if (actionPayload) console.log("Internal Nav:", actionPayload);
      }
    },
    [businessActions, legacyActions, setLocation]
  );

  // LLM-enriched Email handler
  const handleLLMEmail = useCallback(
    async (task: ExtendedTask) => {
      const serverTask = task._serverTask;
      if (!serverTask?.emailRecipient) return;

      // Extract conversationId from deepLink
      const convMatch = serverTask.deepLink?.match(/\/chat\/(\d+)/);
      const convId = convMatch ? parseInt(convMatch[1]) : null;

      if (convId) {
        // Has conversation — use LLM draft
        setLoadingActionId("email");
        try {
          const { draft } = await generateDraft.mutateAsync({
            conversationId: convId,
            channel: "email",
            clientName: serverTask.clientName || "there",
            taskContext: task.context,
          });

          // Construct mailto with LLM draft
          const bName = businessSettings?.businessName || "My Business";
          const subject = encodeURIComponent(`Message from ${bName}`);
          const body = encodeURIComponent(draft);
          const emailUrl = `mailto:${serverTask.emailRecipient}?subject=${subject}&body=${body}`;

          const a = document.createElement("a");
          a.href = emailUrl;
          a.target = "_top";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch {
          // Fallback to static template
          businessActions.openEmail(serverTask);
        } finally {
          setLoadingActionId(null);
        }
      } else {
        // No conversation — use static template
        businessActions.openEmail(serverTask);
      }
    },
    [generateDraft, businessActions, businessSettings]
  );

  // LLM-enriched SMS handler
  const handleLLMSms = useCallback(
    async (task: ExtendedTask) => {
      const serverTask = task._serverTask;
      if (!serverTask?.smsNumber) return;

      // Extract conversationId from deepLink
      const convMatch = serverTask.deepLink?.match(/\/chat\/(\d+)/);
      const convId = convMatch ? parseInt(convMatch[1]) : null;

      if (convId) {
        // Has conversation — use LLM draft
        setLoadingActionId("sms");
        try {
          const { draft } = await generateDraft.mutateAsync({
            conversationId: convId,
            channel: "sms",
            clientName: serverTask.clientName || "there",
            taskContext: task.context,
          });

          // Construct SMS URL with LLM draft
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const number = serverTask.smsNumber.replace(/\D/g, "");
          const body = encodeURIComponent(draft);
          const separator = isIOS ? "&" : "?";
          const smsUrl = `sms:${number}${separator}body=${body}`;

          const a = document.createElement("a");
          a.href = smsUrl;
          a.target = "_top";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch {
          // Fallback to static template
          businessActions.openSms(serverTask);
        } finally {
          setLoadingActionId(null);
        }
      } else {
        // No conversation — use static template
        businessActions.openSms(serverTask);
      }
    },
    [generateDraft, businessActions]
  );

  const handleMarkDone = useCallback(
    async (task: ExtendedTask) => {
      if (task._serverTask) {
        // Complete server task with tracking
        await businessActions.completeTask(task._serverTask, "manual");
      } else {
        // Legacy task completion
        legacyActions.markDone(task.id);
      }
      setExpandedTaskId(null);
    },
    [businessActions, legacyActions]
  );

  const handleSnooze = useCallback(
    (task: ExtendedTask) => {
      if (!task._serverTask) {
        legacyActions.snooze(task.id);
      }
      // Note: Server tasks don't have snooze - they regenerate based on data
      setExpandedTaskId(null);
    },
    [legacyActions]
  );

  const handleDismiss = useCallback(
    (task: ExtendedTask) => {
      if (!task._serverTask) {
        legacyActions.dismiss(task.id);
      }
      // Note: Server tasks don't have dismiss - they regenerate based on data
      setExpandedTaskId(null);
    },
    [legacyActions]
  );

  const handleShowChallenge = useCallback(
    () => setShowChallengeSheet(true),
    []
  );
  const handleGoToChat = useCallback(
    (task: ExtendedTask) => {
      if (task._serverTask?.deepLink) {
        setLocation(task._serverTask.deepLink);
      } else {
        setLocation("/conversations");
      }
    },
    [setLocation]
  );

  // Framer motion variants
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
    }),
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) =>
    Math.abs(offset) * velocity;
  const [[page, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection: number) => {
    const newIndex = page + newDirection;
    if (newIndex < 0 || newIndex >= TITLES.length) return;
    setPage([newIndex, newDirection]);
    setActiveIndex(newIndex);
  };

  if (user?.role === "studio") return null;
  if (user?.role === "merchant") return <MerchantDashboard />;

  return (
    <PageShell>
      
      {/* 1. Page Header - Left branding, right page name */}
      <PageHeader title="Home" />

      {/* 2. Sheet Container (Matched to Calendar.tsx) */}
      <div className={cn(tokens.contentContainer.base, "relative")}>
        {/* Teaser Mode Overlay */}
        {isTeaserClient && (
          <div
            className="absolute inset-0 z-50 bg-background/60 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-all hover:bg-background/70"
            onClick={() => setShowInstallModal(true)}
          >
            <div className="flex flex-col items-center gap-3 p-8 rounded-[2rem] bg-card border border-border shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Dashboard Locked</h3>
              <button className="text-sm font-medium text-primary hover:underline">
                Install app to unlock
              </button>
            </div>
          </div>
        )}

        {/* Scrollable wrapper — contains widgets AND tab content */}
        <div className="flex-1 overflow-y-auto mobile-scroll">
          <motion.div 
            animate={{ marginTop: activeCategory === "contacts" ? 0 : -8 }}
            className="px-6 w-full z-10 relative space-y-4"
          >
            <SetupChecklistWidget />
            {user?.role === "artist" || user?.role === "admin" ? (
              <motion.div
                animate={{
                  height: activeCategory === "contacts" ? 0 : "auto",
                  opacity: activeCategory === "contacts" ? 0 : 1,
                  scale: activeCategory === "contacts" ? 0.95 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden"
              >
                <PayoutWidgetContainer period="30d" />
              </motion.div>
            ) : null}
          </motion.div>

          <div
            className={cn(
              "flex flex-col",
              isTeaserClient && "filter blur-sm pointer-events-none select-none"
            )}
          >
            <div className="px-6 pb-2 shrink-0 relative z-50">
              <SegmentedHeader
                options={TITLES}
                activeIndex={activeIndex}
                onChange={index => {
                  const dir = index > activeIndex ? 1 : -1;
                  setPage([index, dir]);
                  setActiveIndex(index);
                }}
              />
            </div>

            <div className="relative" style={{ minHeight: "60vh" }}>
              <div className="relative w-full" style={{ minHeight: "60vh" }}>
                <AnimatePresence initial={false} custom={direction}>
                  <motion.div
                    key={page}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 },
                    }}
                    className="absolute top-0 left-0 w-full px-4 pt-4 touch-pan-y"
                  >
                    <div className="space-y-1 pb-32 max-w-lg mx-auto">
                      {/* Render Content Based on Active Category */}
                      {activeCategory === "contacts" ? (
                        <ContactsTab />
                      ) : activeCategory === "orders" ? (
                        <OrdersTab />
                      ) : activeCategory === "business" && businessLoading ? (
                        <LoadingState />
                      ) : (currentTasks || []).length > 0 ? (
                        (currentTasks || []).map(task => {
                          const isExpanded = expandedTaskId === task.id;

                          // Build inline action buttons for expanded cards
                          const actions: TaskCardAction[] = [];
                          if (isExpanded && task._serverTask) {
                            if (task._serverTask.emailRecipient) {
                              actions.push({
                                id: "email",
                                label: "Email",
                                icon: Mail,
                                onClick: () => handleLLMEmail(task),
                              });
                            }
                            if (task._serverTask.smsNumber) {
                              actions.push({
                                id: "sms",
                                label: "SMS",
                                icon: Smartphone,
                                onClick: () => handleLLMSms(task),
                              });
                            }
                            actions.push({
                              id: "done",
                              label: "Complete",
                              icon: Check,
                              onClick: () => handleMarkDone(task),
                              className: "bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]/90 active:bg-[var(--color-success)]/80",
                            });
                            if (task._serverTask.clientId) {
                              actions.push({
                                id: "chat",
                                label: "Messages",
                                icon: MessageSquare,
                                onClick: () => handleGoToChat(task),
                              });
                            }
                          }

                          return (
                            <TaskCard
                              key={task.id}
                              title={task.title}
                              context={task.context}
                              priority={task.priority}
                              status={task.status}
                              actionType={task.actionType as any}
                              onClick={() => handleTaskClick(task)}
                              isExpanded={isExpanded}
                              conversationSummary={isExpanded ? conversationState?.summary : undefined}
                              briefLoading={isExpanded && !!expandedTaskConversationId && briefLoading}
                              clientName={task._serverTask?.clientName ?? undefined}
                              actions={actions}
                              loadingActionId={isExpanded ? loadingActionId : null}
                            />
                          );
                        })
                      ) : (
                        <EmptyState
                          category={TITLES[activeIndex]}
                          onAction={
                            (activeCategory as string) === "contacts"
                              ? () => setShowChallengeSheet(true)
                              : undefined
                          }
                        />
                      )}

                      {/* Removed inline settings buttons - moved to Central FAB */}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Register FAB Actions (global only — task actions are now inline) */}
      <DashboardFABActions
        activeCategory={activeCategory as any}
        onShowChallenge={handleShowChallenge}
      />

      {/* --- CHALLENGE SHEET (FullScreenSheet) --- */}
      <FullScreenSheet
        open={showChallengeSheet}
        onClose={() => setShowChallengeSheet(false)}
        title="Challenges"
        contextTitle="Select a Challenge"
        contextSubtitle="Commit to a new personal growth goal."
      >
        <div className="space-y-3">
          {(CHALLENGE_TEMPLATES || []).map((template: ChallengeTemplate) => (
            <Card
              key={template.id}
              onClick={() => {
                legacyActions.startChallenge(template);
                setShowChallengeSheet(false);
              }}
              className="p-4 border-border bg-secondary/50 hover:bg-secondary active:scale-[0.98] transition-all cursor-pointer rounded-2xl flex items-center justify-between group"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg">{template.title}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {template.durationDays} Days
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {template.description}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors">
                <ChevronRight className="w-4 h-4" />
              </div>
            </Card>
          ))}
        </div>
      </FullScreenSheet>
    </PageShell>
  );
}
