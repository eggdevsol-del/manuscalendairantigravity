import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRegisterFABActions, useBottomNav } from "@/contexts/BottomNavContext";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Dialog, DialogTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { useDashboardTasks } from "@/features/dashboard/useDashboardTasks";
import { useBusinessTasks, useWeeklySnapshot, useDashboardSettings, type BusinessTask as ServerBusinessTask } from "@/features/dashboard/useBusinessTasks";
import { CHALLENGE_TEMPLATES } from "@/features/dashboard/DashboardTaskRegister";
import { DashboardTask, ChallengeTemplate } from "@/features/dashboard/types";
import { PageShell, PageHeader, GlassSheet, FullScreenSheet, WeeklySnapshotModal, TaskCard, SegmentedHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Check, Clock, ExternalLink, MessageSquare, Mail, Play, Plus, Trash2, Smartphone, Monitor, ChevronRight, Settings, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTeaser } from "@/contexts/TeaserContext";
import { InstallAppModal } from "@/components/modals/InstallAppModal";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

import { type FABMenuItem } from "@/ui/FABMenu";
import { DashboardFABActions } from "@/features/dashboard/DashboardActions";

// SSOT Components

// --- Types ---

// Extended task type that can hold either legacy or server task data
export interface ExtendedTask {
    id: string;
    title: string;
    context?: string;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'completed' | 'dismissed' | 'snoozed';
    actionType: 'sms' | 'email' | 'social' | 'internal' | 'in_app' | 'link' | 'external' | 'none';
    actionPayload?: string;
    domain: 'business' | 'social' | 'personal';
    _serverTask?: ServerBusinessTask;
}

// --- Components ---

function EmptyState({ category, onAction }: { category: string; onAction?: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center h-64">
            <p className="text-muted-foreground/50 text-base font-medium">
                {category === 'Personal' && !onAction ? "You're crushing it." : "All clear for " + category + "."}
            </p>
            {category === 'Personal' && onAction && (
                <div className="mt-6">
                    <Button variant="hero" onClick={onAction}>
                        Start New Challenge
                    </Button>
                </div>
            )}
            {category !== 'Personal' && (
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

const TITLES = ["Business", "Social", "Personal"];

export default function Dashboard() {
    const [, setLocation] = useLocation();
    const [activeIndex, setActiveIndex] = useState(0);
    const selectedDate = new Date();
    const { isFABOpen, setFABOpen } = useBottomNav();

    // Legacy Feature Hook (for Social and Personal)
    const { tasks: legacyTasks, actions: legacyActions, stats, config } = useDashboardTasks();

    // New Business Tasks Hook (Revenue Protection Algorithm)
    const {
        tasks: businessTasks,
        isLoading: businessLoading,
        settings: businessSettings,
        actions: businessActions,
        completingTask
    } = useBusinessTasks();

    // Weekly Snapshot Hook
    const { shouldShow: showSnapshot, snapshot, dismiss: dismissSnapshot } = useWeeklySnapshot();

    // Teaser Mode
    const { isTeaserClient } = useTeaser();
    const [showInstallModal, setShowInstallModal] = useState(false);


    // UI State
    const [selectedTask, setSelectedTask] = useState<ExtendedTask | null>(null);
    const [showTaskSheet, setShowTaskSheet] = useState(false);
    const [showChallengeSheet, setShowChallengeSheet] = useState(false);
    const [showSnapshotModal, setShowSnapshotModal] = useState(false);
    const [taskStartTime, setTaskStartTime] = useState<string | null>(null);

    // Track if snapshot was already shown in this session
    const snapshotShownThisSession = useRef(false);

    // Show weekly snapshot on mount if needed (only once per session)
    useEffect(() => {
        if (showSnapshot && !snapshotShownThisSession.current) {
            snapshotShownThisSession.current = true;
            setShowSnapshotModal(true);
        }
    }, [showSnapshot]);

    // Clear selected task when FAB closes
    useEffect(() => {
        if (!isFABOpen) {
            setSelectedTask(null);
        }
    }, [isFABOpen]);

    // Derived State
    const activeCategory = TITLES[activeIndex].toLowerCase() as 'business' | 'social' | 'personal';

    // Transform legacy task to ExtendedTask
    const transformLegacyTask = (task: DashboardTask): ExtendedTask => ({
        id: task.id,
        title: task.title,
        context: task.context,
        priority: task.priority,
        status: task.status,
        actionType: task.actionType,
        actionPayload: task.actionPayload,
        domain: task.domain
    });

    // Get current tasks based on category
    const getCurrentTasks = (): ExtendedTask[] => {
        if (activeCategory === 'business') {
            // Use server-generated business tasks
            return businessTasks.map(task => ({
                id: task.id,
                title: task.title,
                context: task.context,
                priority: task.priority,
                status: task.status as ExtendedTask['status'],
                actionType: task.actionType as ExtendedTask['actionType'],
                domain: 'business' as const,
                _serverTask: task._serverTask
            } as ExtendedTask));
        }
        // Use legacy tasks for social and personal
        const tasks = legacyTasks[activeCategory] || [];
        return tasks.map(transformLegacyTask);
    };

    const currentTasks = getCurrentTasks();

    // Handlers
    const handleTaskClick = useCallback((task: ExtendedTask) => {
        setSelectedTask(task);

        // Start tracking time for business tasks
        if (task._serverTask) {
            const startTime = businessActions.startTask(task._serverTask);
            setTaskStartTime(startTime);
        }

        setFABOpen(true);
    }, [businessActions, setFABOpen]);

    const executeAction = useCallback(async (task: ExtendedTask) => {
        const serverTask = task._serverTask;

        if (serverTask) {
            // Use the explicit task.actionType override if present, otherwise fallback
            const actionToExecute = task.actionType || serverTask.actionType;

            // Handle server-generated business tasks
            switch (actionToExecute) {
                case 'sms':
                    if (serverTask.smsNumber) {
                        businessActions.openSms(serverTask);
                    }
                    break;
                case 'email':
                    if (serverTask.emailRecipient) {
                        businessActions.openEmail(serverTask);
                    }
                    break;
                case 'in_app':
                    if (serverTask.deepLink) {
                        businessActions.navigateToTask(serverTask, setLocation);
                    }
                    break;
                case 'external':
                    // Handle external links if needed
                    break;
            }
        } else {
            // Handle legacy tasks
            const { actionType, actionPayload } = task;
            if (actionType === 'email' && actionPayload) return legacyActions.handleComms.email(actionPayload);
            if (actionType === 'sms' && actionPayload) return legacyActions.handleComms.sms(actionPayload);
            if (actionType === 'social' && actionPayload) return window.open(actionPayload, '_blank');
            if (actionPayload) console.log("Internal Nav:", actionPayload);
        }
    }, [businessActions, legacyActions, setLocation]);

    const handleMarkDone = useCallback(async (task: ExtendedTask) => {
        if (task._serverTask) {
            // Complete server task with tracking
            await businessActions.completeTask(task._serverTask, 'manual');
        } else {
            // Legacy task completion
            legacyActions.markDone(task.id);
        }
        setFABOpen(false);
    }, [businessActions, legacyActions, setFABOpen]);

    const handleSnooze = useCallback((task: ExtendedTask) => {
        if (!task._serverTask) {
            legacyActions.snooze(task.id);
        }
        // Note: Server tasks don't have snooze - they regenerate based on data
        setFABOpen(false);
    }, [legacyActions, setFABOpen]);

    const handleDismiss = useCallback((task: ExtendedTask) => {
        if (!task._serverTask) {
            legacyActions.dismiss(task.id);
        }
        // Note: Server tasks don't have dismiss - they regenerate based on data
        setFABOpen(false);
    }, [legacyActions, setFABOpen]);

    const handleShowSnapshot = useCallback(() => setShowSnapshotModal(true), []);
    const handleShowChallenge = useCallback(() => setShowChallengeSheet(true), []);
    const handleGoToChat = useCallback(() => setLocation('/conversations'), [setLocation]);

    // Framer motion variants
    const variants = {
        enter: (direction: number) => ({ x: direction > 0 ? "100%" : "-100%", opacity: 0 }),
        center: { zIndex: 1, x: 0, opacity: 1 },
        exit: (direction: number) => ({ zIndex: 0, x: direction < 0 ? "100%" : "-100%", opacity: 0 })
    };

    const swipeConfidenceThreshold = 10000;
    const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;
    const [[page, direction], setPage] = useState([0, 0]);

    const paginate = (newDirection: number) => {
        const newIndex = page + newDirection;
        if (newIndex < 0 || newIndex >= TITLES.length) return;
        setPage([newIndex, newDirection]);
        setActiveIndex(newIndex);
    };

    return (
        <PageShell>
            {/* 1. Page Header - Left aligned, no icons */}
            <PageHeader title="Dashboard" />

            {/* 2. Top Context Area (Date) */}
            <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
                <p className="text-4xl font-light text-foreground/90 tracking-tight">
                    {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
                </p>
                <p className="text-muted-foreground text-lg font-medium mt-1">
                    {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                </p>
            </div>

            {/* 3. Sheet Container (Matched to Calendar.tsx) */}
            <div className={cn(tokens.contentContainer.base, "relative")}>
                {/* Teaser Mode Overlay */}
                {isTeaserClient && (
                    <div
                        className="absolute inset-0 z-50 bg-background/60 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-all hover:bg-background/70"
                        onClick={() => setShowInstallModal(true)}
                    >
                        <div className="flex flex-col items-center gap-3 p-8 rounded-[2rem] bg-card/90 border border-white/10 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
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

                <div className={cn("flex-1 flex flex-col overflow-hidden", isTeaserClient && "filter blur-sm pointer-events-none select-none")}>
                    <div className="px-6 pb-2 shrink-0">
                        <SegmentedHeader
                            options={TITLES}
                            activeIndex={activeIndex}
                            onChange={(index) => {
                                const dir = index > activeIndex ? 1 : -1;
                                setPage([index, dir]);
                                setActiveIndex(index);
                            }}
                        />
                    </div>

                    <div className={cn(tokens.contentContainer.base, "relative")}>
                        <div className="flex-1 relative w-full overflow-hidden">
                            <AnimatePresence initial={false} custom={direction}>
                                <motion.div
                                    key={page}
                                    custom={direction}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    dragElastic={0.2}
                                    onDragEnd={(e, { offset, velocity }) => {
                                        const swipe = swipePower(offset.x, velocity.x);
                                        if (swipe < -swipeConfidenceThreshold) paginate(1);
                                        else if (swipe > swipeConfidenceThreshold) paginate(-1);
                                    }}
                                    dragDirectionLock
                                    className="absolute top-0 left-0 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y"
                                >
                                    <div className="space-y-1 pb-32 max-w-lg mx-auto">
                                        {/* Loading state for business tasks */}
                                        {activeCategory === 'business' && businessLoading ? (
                                            <LoadingState />
                                        ) : currentTasks.length > 0 ? (
                                            currentTasks.map(task => (
                                                <TaskCard
                                                    key={task.id}
                                                    title={task.title}
                                                    context={task.context}
                                                    priority={task.priority}
                                                    status={task.status}
                                                    actionType={task.actionType as any}
                                                    onClick={() => handleTaskClick(task)}
                                                />
                                            ))
                                        ) : (
                                            <EmptyState
                                                category={TITLES[activeIndex]}
                                                onAction={activeCategory === 'personal' ? () => setShowChallengeSheet(true) : undefined}
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

            {/* Register FAB Actions */}
            <DashboardFABActions
                activeCategory={activeCategory}
                onShowSnapshot={handleShowSnapshot}
                onShowChallenge={handleShowChallenge}
                selectedTask={selectedTask}
                onExecuteAction={executeAction}
                onMarkDone={handleMarkDone}
                onSnooze={handleSnooze}
                onGoToChat={handleGoToChat}
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
                    {CHALLENGE_TEMPLATES.map((template: ChallengeTemplate) => (
                        <Card
                            key={template.id}
                            onClick={() => {
                                legacyActions.startChallenge(template);
                                setShowChallengeSheet(false);
                            }}
                            className="p-4 border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer rounded-2xl flex items-center justify-between group"
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-lg">{template.title}</h3>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                        {template.durationDays} Days
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">{template.description}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors">
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </Card>
                    ))}
                </div>
            </FullScreenSheet>

            {/* --- WEEKLY SNAPSHOT MODAL --- */}
            <WeeklySnapshotModal
                open={showSnapshotModal}
                onClose={() => {
                    setShowSnapshotModal(false);
                    if (showSnapshot) {
                        dismissSnapshot();
                    }
                }}
                data={snapshot}
            />

        </PageShell >
    );
}
