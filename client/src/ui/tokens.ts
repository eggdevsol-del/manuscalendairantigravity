
export const tokens = {
    // 1. Backgrounds
    // Exact match from Calendar/Dashboard
    bgGradient: "fixed inset-0 w-full h-[100dvh] bg-[radial-gradient(circle_at_top_right,rgba(88,28,135,0.4),rgba(2,6,23,1)_60%)]",

    // 2. Sheets
    // Main sheet (Dashboard, Calendar) - extends past bottom
    sheetMain: {
        container: "flex-1 z-20 flex flex-col bg-[#0f1323]/80 backdrop-blur-[32px] rounded-t-[2.5rem] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] overflow-hidden relative",
        highlight: "absolute top-0 inset-x-0 h-px bg-gradient-to-l from-white/20 to-transparent opacity-50 pointer-events-none",
        content: "flex-1 relative w-full overflow-hidden"
    },

    // Secondary sheet (Modals, Booking Wizard)
    sheetSecondary: {
        overlay: "fixed inset-0 z-[100] bg-black/40 backdrop-blur-md",
        content: "fixed inset-0 z-[101] w-full h-[100dvh] outline-none flex flex-col gap-0 overflow-hidden",
        container: "flex-1 z-20 flex flex-col bg-gradient-to-b from-white/10 to-[#0f172a] rounded-t-[2.5rem] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] overflow-hidden relative will-change-transform",
        glass: "bg-gradient-to-b from-white/10 to-[#0f172a] rounded-t-[2.5rem] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]",
        highlight: "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent",
        header: "shrink-0 pt-6 pb-4 px-6 border-b border-white/5 bg-white/[0.01] backdrop-blur-md z-10 relative"
    },

    // 3. Cards
    // Dashboard v1.0.101 style
    card: {
        base: "group relative overflow-hidden transition-all duration-300 border-0 rounded-2xl",
        bg: "bg-white/5 hover:bg-white/10",
        bgAccent: "bg-gradient-to-r from-primary/20 to-primary/5 hover:from-primary/25 hover:to-primary/10",
        interactive: "cursor-pointer active:scale-[0.98]",
        glow: {
            high: { line: "bg-red-600", gradient: "from-red-600/20" },
            medium: { line: "bg-orange-500", gradient: "from-orange-500/20" },
            low: { line: "bg-emerald-500", gradient: "from-emerald-500/20" }
        }
    },

    // 4. Buttons
    button: {
        primary: "shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold",
        secondary: "bg-white/5 hover:bg-white/10 text-foreground h-12 text-base font-semibold",
        ghost: "text-white/50 hover:text-white hover:bg-white/5",
        icon: "rounded-full bg-white/5 hover:bg-white/10 text-foreground w-10 h-10 flex items-center justify-center transition-colors"
    },

    // 5. Typography
    header: {
        pageTitle: "text-2xl font-bold text-foreground",
        pageSubtitle: "ml-2 text-sm font-medium text-muted-foreground/60",
        sectionTitle: "text-xs font-bold text-muted-foreground tracking-widest uppercase",
        sheetTitle: "text-2xl font-bold text-foreground",
        sheetSubtitle: "text-muted-foreground mt-1",
        contextTitle: "text-4xl font-light text-foreground/90 tracking-tight",
        contextSubtitle: "text-muted-foreground text-lg font-medium mt-1"
    },

    // 6. Layout
    spacing: {
        pagePadding: "px-6 py-4",
        sheetPadding: "px-6 pt-6 pb-2",
        cardPadding: "p-4",
        containerPadding: "px-6 pb-8"
    },

    // 7. Page Shell Logic
    shell: {
        base: "fixed inset-0 w-full h-[100dvh] flex flex-col overflow-hidden bg-transparent",
        header: "px-6 py-4 z-10 shrink-0 flex items-center bg-transparent"
    },

    // 8. Navigation Actions
    navAction: {
        base: "flex flex-col items-center justify-center h-auto py-2 px-4 gap-1 min-w-[72px] shrink-0 bg-transparent border-0 rounded-xl transition-all duration-150 touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        pressed: "scale-90 opacity-70",
        idle: "opacity-90 hover:opacity-100 hover:bg-white/10 dark:hover:bg-white/5",
        icon: {
            primary: "text-blue-500 dark:text-blue-400",
            accent: "text-amber-500 dark:text-amber-400",
            idle: "text-foreground/80"
        }
    },

    // 9. Loading States
    loading: {
        base: "flex items-center justify-center gap-2",
        fullScreen: "fixed inset-0 flex items-center justify-center bg-background z-[200]",
        text: "text-muted-foreground"
    },

    // 10. Tabs / Segmented Controls
    tabs: {
        container: "flex w-full items-center justify-between gap-2",
        button: "flex-1 text-center text-lg tracking-tight transition-all duration-300 ease-out py-2 outline-none",
        active: "text-foreground font-bold opacity-100 scale-[1.02]",
        inactive: "text-muted-foreground font-medium opacity-40 hover:opacity-70 scale-[0.98]"
    },

    // 11. Selection Cards (Pills)
    selectionCard: {
        base: "w-full p-4 rounded-lg border transition-all text-left flex items-start gap-4 cursor-pointer group select-none",
        selected: "bg-primary/10 border-primary/50",
        idle: "bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10",
        iconContainer: {
            base: "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors",
            selected: "bg-primary text-primary-foreground",
            idle: "bg-black/10 dark:bg-white/10"
        },
        indicator: {
            base: "w-8 h-8 rounded-full flex items-center justify-center border transition-all ml-4",
            selected: "bg-primary border-primary text-primary-foreground",
            idle: "bg-transparent border-black/20 dark:border-white/20 text-transparent group-hover:border-black/40 dark:group-hover:border-white/40"
        },
        title: {
            base: "font-semibold text-base transition-colors",
            selected: "text-primary",
            idle: "text-foreground group-hover:text-foreground"
        },
        description: "text-sm text-muted-foreground mt-1"
    },

    // 12. Motion / Animations (Radix + Tailwind Animate)
    animations: {
        fade: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
        sheetSlideUp: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full duration-500 ease-in-out",
        sheetSlideSide: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-4 data-[state=open]:slide-in-from-right-4",
        modalZoom: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
    }
} as const;
