
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useDashboardTasks } from "@/features/dashboard/useDashboardTasks";
import { CHALLENGE_TEMPLATES, DashboardTask } from "@/features/dashboard/DashboardTaskRegister";
import { ActionSheet, PageShell, PageHeader, GlassSheet } from "@/components/ui/ssot";
import { DialogTitle } from "@/components/ui/dialog";
import { X, Check, Clock, ExternalLink, MessageSquare, Mail, Play, Plus, Trash2, Smartphone, Monitor } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card"; // For Challenges only

// SSOT Components
import { SegmentedHeader } from "@/components/ui/ssot/SegmentedHeader";
import { TaskCard } from "@/components/ui/ssot/TaskCard";

// --- Components ---

function EmptyState({ category, onAction }: { category: string; onAction?: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center h-64">
            <p className="text-muted-foreground/50 text-base font-medium">
                {category === 'Personal' && !onAction ? "You're crushing it." : "All clear for " + category + "."}
            </p>
            {category === 'Personal' && onAction && (
                <div className="mt-6">
                    <Button size="lg" onClick={onAction} className="shadow-lg shadow-primary/20 font-bold text-lg h-14 px-8 rounded-full">
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

const TITLES = ["Business", "Social", "Personal"];

export default function Dashboard() {
    const [activeIndex, setActiveIndex] = useState(0);
    const selectedDate = new Date();

    // Feature Hook
    const { tasks: allTasks, actions, stats, config } = useDashboardTasks();

    // UI State
    const [selectedTask, setSelectedTask] = useState<DashboardTask | null>(null);
    const [showTaskSheet, setShowTaskSheet] = useState(false);
    const [showChallengeSheet, setShowChallengeSheet] = useState(false);
    const [showSettingsSheet, setShowSettingsSheet] = useState(false);

    // Derived State
    const activeCategory = TITLES[activeIndex].toLowerCase() as 'business' | 'social' | 'personal';
    const currentTasks = allTasks[activeCategory] || [];

    // Handlers
    const handleTaskClick = (task: DashboardTask) => {
        setSelectedTask(task);
        setShowTaskSheet(true);
    };

    const executeAction = (task: DashboardTask) => {
        const { actionType, actionPayload } = task;
        if (actionType === 'email' && actionPayload) return actions.handleComms.email(actionPayload);
        if (actionType === 'sms' && actionPayload) return actions.handleComms.sms(actionPayload);
        if (actionType === 'social' && actionPayload) return window.open(actionPayload, '_blank');
        if (actionPayload) console.log("Internal Nav:", actionPayload);
    };

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
        <PageShell className="bg-[radial-gradient(circle_at_top_right,rgba(88,28,135,0.4),rgba(2,6,23,1)_60%)]">

            {/* 1. Page Header */}
            <PageHeader variant="transparent" className="justify-between mt-2">
                <h1 className="text-xl font-bold text-white tracking-wide">Dashboard</h1>
                <div className="flex items-center gap-3">
                    {/* Settings Trigger - Matching reference right icon */}
                    <Button variant="ghost" size="icon" onClick={() => setShowSettingsSheet(true)} className="text-white/50 hover:text-white">
                        <Smartphone className="w-5 h-5" />
                    </Button>
                </div>
            </PageHeader>

            {/* 2. Top Context Area (Date) */}
            <div className="px-8 pt-6 pb-8 z-10 shrink-0 flex flex-col justify-start h-[25vh] relative text-left">
                <p className="text-6xl font-extralight text-white/90 tracking-tight leading-none mb-1">
                    {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
                </p>
                <p className="text-white/50 text-lg font-light tracking-wide pl-1">
                    {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                </p>
            </div>

            {/* 3. Sheet Container (Matched to Calendar.tsx) */}
            <GlassSheet className="bg-slate-950/80">

                {/* Sheet Header Tabs */}
                <div className="shrink-0 pt-6 pb-2 px-6 border-b border-white/5">
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

                {/* Sheet Content */}
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
                            <div className="space-y-3 pb-32 max-w-lg mx-auto">
                                {currentTasks.length > 0 ? (
                                    currentTasks.map(task => (
                                        <TaskCard
                                            key={task.id}
                                            title={task.title}
                                            context={task.context}
                                            priority={task.priority as 'high' | 'medium' | 'low'}
                                            status={task.status}
                                            actionType={task.actionType as any}
                                            onClick={() => handleTaskClick(task)}
                                        />
                                    ))
                                ) : (
                                    <EmptyState category={TITLES[activeIndex]} onAction={activeCategory === 'personal' ? () => setShowChallengeSheet(true) : undefined} />
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </GlassSheet>


            {/* --- ACTION SHEET --- */}
            <ActionSheet open={showTaskSheet} onOpenChange={setShowTaskSheet} title="Task Actions">
                        <div className="mx-auto w-12 h-1.5 rounded-full bg-white/20 mb-2" />

                        {selectedTask && (
                            <>
                                <div className="space-y-1">
                                    <DialogTitle className="text-2xl font-bold">{selectedTask.title}</DialogTitle>
                                    <p className="text-muted-foreground">{selectedTask.context}</p>
                                </div>

                                <div className="grid gap-3">
                                    {/* Primary Action */}
                                    {selectedTask.actionType !== 'none' && (
                                        <Button
                                            size="lg"
                                            className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/20"
                                            onClick={() => executeAction(selectedTask)}
                                        >
                                            {selectedTask.actionType === 'sms' && <MessageSquare className="mr-2 w-5 h-5" />}
                                            {selectedTask.actionType === 'email' && <Mail className="mr-2 w-5 h-5" />}
                                            {selectedTask.actionType === 'social' && <ExternalLink className="mr-2 w-5 h-5" />}
                                            {selectedTask.actionType === 'internal' && <Play className="mr-2 w-5 h-5" />}
                                            Execute Action
                                        </Button>
                                    )}

                                    {/* Task Management Actions */}
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        className="w-full h-14 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5"
                                        onClick={() => { actions.markDone(selectedTask.id); setShowTaskSheet(false); }}
                                    >
                                        <Check className="mr-2 w-5 h-5 text-green-500" />
                                        Mark Completed
                                    </Button>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            variant="outline"
                                            className="h-12 rounded-xl border-white/10 bg-transparent hover:bg-white/5"
                                            onClick={() => { actions.snooze(selectedTask.id); setShowTaskSheet(false); }}
                                        >
                                            <Clock className="mr-2 w-4 h-4" />
                                            Snooze 24h
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-12 rounded-xl border-white/10 bg-transparent hover:bg-white/5 text-muted-foreground"
                                            onClick={() => { actions.dismiss(selectedTask.id); setShowTaskSheet(false); }}
                                        >
                                            <X className="mr-2 w-4 h-4" />
                                            Dismiss
                                        </Button>
                                    </div>

                                    {/* Stop Challenge (Personal Only) */}
                                    {selectedTask.domain === 'personal' && stats.activeChallengeId && (
                                        <Button
                                            variant="ghost"
                                            className="w-full h-12 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                            onClick={() => { actions.stopChallenge(); setShowTaskSheet(false); }}
                                        >
                                            <Trash2 className="mr-2 w-4 h-4" />
                                            Stop Challenge
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}
            </ActionSheet>

            {/* --- CHALLENGE SHEET --- */}
            <ActionSheet 
                open={showChallengeSheet} 
                onOpenChange={setShowChallengeSheet} 
                title="Select a Challenge"
                maxHeight="85vh"
                className="p-0 bg-slate-950/95"
            >
                        <div className="px-6 py-4 border-b border-white/5 shrink-0">
                            <div className="mx-auto w-12 h-1.5 rounded-full bg-white/20 mb-4" />
                            <DialogTitle className="text-xl font-bold">Select a Challenge</DialogTitle>
                            <p className="text-sm text-muted-foreground">Commit to a new personal growth goal.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {CHALLENGE_TEMPLATES.map(template => (
                                <Card
                                    key={template.id}
                                    onClick={() => {
                                        actions.startChallenge(template);
                                        setShowChallengeSheet(false);
                                    }}
                                    className="p-4 border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer rounded-xl flex items-center justify-between group"
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
                                        <Plus className="w-4 h-4" />
                                    </div>
                                </Card>
                            ))}
                        </div>
            </ActionSheet>

            {/* --- SETTINGS SHEET --- */}
            <ActionSheet open={showSettingsSheet} onOpenChange={setShowSettingsSheet} title="Preferences">
                        <div className="mx-auto w-12 h-1.5 rounded-full bg-white/20 mb-2" />
                        <div className="space-y-1">
                            <DialogTitle className="text-2xl font-bold">Preferences</DialogTitle>
                            <p className="text-muted-foreground">Configure your dashboard experience.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Device Platform (For SMS/Sharing)</Label>
                                <Select value={config.comms.platform} onValueChange={(val: any) => actions.setCommsPlatform(val)}>
                                    <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ios">
                                            <div className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> iOS (iPhone)</div>
                                        </SelectItem>
                                        <SelectItem value="android">
                                            <div className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Android</div>
                                        </SelectItem>
                                        <SelectItem value="desktop">
                                            <div className="flex items-center gap-2"><Monitor className="w-4 h-4" /> Desktop / Web</div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
            </ActionSheet>

        </PageShell>
    );
}

