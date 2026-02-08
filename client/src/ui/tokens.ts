
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
        primary: "shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-6 rounded-xl text-base font-semibold transition-all active:scale-[0.98]",
        hero: "w-full h-14 rounded-2xl font-bold text-base shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all active:scale-[0.97]",
        secondary: "bg-white/5 hover:bg-white/10 text-foreground h-12 px-6 rounded-xl text-base font-semibold transition-all active:scale-[0.98]",
        destructive: "bg-destructive hover:bg-destructive/90 text-white h-12 px-6 rounded-xl text-base font-semibold transition-all active:scale-[0.98]",
        outline: "border border-white/10 bg-transparent hover:bg-white/5 text-foreground h-10 px-4 rounded-xl text-sm font-medium transition-all active:scale-[0.98]",
        ghost: "text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors",
        link: "text-primary underline-offset-4 hover:underline px-0 transition-opacity active:opacity-70",
        icon: "rounded-full bg-white/5 hover:bg-white/10 text-foreground w-10 h-10 flex items-center justify-center transition-all active:scale-90"
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
        base: "flex flex-col items-center justify-center h-full py-2 px-4 gap-1 min-w-[72px] shrink-0 bg-transparent border-0 rounded-xl transition-all duration-150 touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        pressed: "scale-90 opacity-70",
        idle: "opacity-90 hover:opacity-100 hover:bg-white/10 dark:hover:bg-white/5",
        icon: {
            primary: "text-blue-500 dark:text-blue-400 fill-current/10",
            accent: "text-amber-500 dark:text-amber-400 fill-current/10",
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
        fade: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-500",
        sheetSlideUp: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full duration-500 ease-in-out",
        sheetSlideSide: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-4 data-[state=open]:slide-in-from-right-4",
        modalZoom: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
    },

    // 13. Framer Motion Variants (SSOT for framer-motion animations)
    motion: {
        // Standard spring transition for smooth, natural motion
        spring: {
            type: "spring" as const,
            damping: 30,
            stiffness: 300
        },

        // Softer spring for modals and overlays
        springModal: {
            type: "spring" as const,
            damping: 25,
            stiffness: 300
        },

        // Fixed-duration fade for symmetric overlay animations
        fadeDuration: {
            duration: 0.3,
            ease: "easeInOut" as const
        },

        // Sheet slide-up animation
        sheetSlide: {
            initial: { y: "100%" },
            animate: { y: 0 },
            exit: { y: "100%" }
        },

        // Overlay fade animation (synchronized with sheet)
        overlayFade: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 }
        },

        // Modal zoom animation
        modalZoomVariant: {
            initial: { opacity: 0, scale: 0.95, y: 20 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.95, y: 20 }
        },

        // Drag gesture configuration for swipe-to-close
        dragGesture: {
            threshold: 150, // Distance in pixels to trigger close
            elastic: 0.2    // Resistance when dragging beyond bounds
        }
    },

    // Calendar-specific tokens
    calendar: {
        // Cell backgrounds and borders
        cellBg: "bg-white/5",
        cellBgHover: "hover:bg-white/10",
        cellBorder: "border-white/10",
        cellBorderHover: "hover:border-white/20",
        selectedBg: "bg-primary/10",
        selectedBorder: "border-primary/50",
        selectedCellBg: "bg-primary/20",
        selectedCellBorder: "border-primary",
        todayBg: "bg-primary/5",
        todayRing: "ring-1 ring-primary/50",
        dimmedBg: "bg-white/[0.02]",

        // Timeline
        timelineBg: "bg-black/20",
        headerBg: "bg-white/5",
        slotHover: "hover:bg-white/5",
        slotActive: "active:bg-white/10",
        appointmentBorder: "border-white/10",
        emptyStateBg: "bg-white/5",

        // Text colors
        selectedText: "text-primary",
        todayText: "text-primary",
        dimmedText: "text-white/30",
        hourLabel: "text-muted-foreground/60",
        appointmentText: "text-foreground/90",

        // Dividers
        divider: "border-white/5",
        hourBorder: "border-white/10",
        minuteBorder: "border-white/[0.02]",

        // Spacing
        contextHeight: "h-[20vh]",
        gridHeightCollapsed: "h-[25%]",
        timelineHeightExpanded: "basis-[75%]",
        timelineScrollHeight: "min-h-[2000px]",
        hourSlotHeight: "h-24",
        minuteSlotHeight: "h-6",

        // Icons/Badges
        iconBg: "bg-white/10",
        iconText: "text-white/70",
        badgeBg: "bg-white/5",
        badgeText: "text-white/90",
        dot: "bg-primary",
        dotSelected: "bg-primary-foreground/90",

        // Typography
        cardTitle: "font-semibold text-base",
        cardSubtitle: "text-xs text-muted-foreground",
        contextTitle: "text-4xl font-light text-foreground/90 tracking-tight",
        contextSubtitle: "text-muted-foreground text-lg font-medium",
        sheetTitle: "text-lg font-semibold text-foreground tracking-tight",
        dayLabel: "text-xs text-muted-foreground uppercase tracking-wider font-semibold",
        dayNumber: "text-2xl font-bold",
        timelineTitle: "text-sm font-bold text-muted-foreground uppercase tracking-widest",

        // Card styling
        card: "p-4 min-h-[120px] cursor-pointer transition-all duration-300 border-0 rounded-2xl",
        cardWeek: "p-4 min-h-[120px]",

        // Spacing presets
        contextPadding: "px-6 pt-4",
        sheetHeaderPadding: "pt-6 pb-2 px-6",
        sheetContentPadding: "px-4 pt-4",
        timelineHeaderPadding: "px-4 py-3",
        appointmentPadding: "pt-2 px-3",

        // Day Card Appointment Indicators
        dayCard: {
            dateSection: "flex-shrink-0 pb-1", // Top section with date
            appointmentSection: "flex-1 flex flex-col w-full overflow-hidden", // Bottom section with appointments
            appointmentItem: "flex-1 flex flex-col justify-center px-1.5 py-0.5 min-h-0", // Individual appointment area
            appointmentText: "text-[9px] leading-tight font-medium truncate text-white", // Appointment details text
            appointmentTime: "text-[8px] opacity-80 truncate text-white", // Time text
        },
    },

    // Appointment Wizard (Calendar inline wizard)
    appointmentWizard: {
        // Header
        headerPadding: "px-4 py-4",
        backButton: "rounded-full bg-white/5 hover:bg-white/10",
        title: "text-2xl font-bold text-foreground",

        // Context Area
        contextPadding: "px-6 pt-4 pb-8",
        contextHeight: "h-[15vh]",
        contextTitle: "text-4xl font-light text-foreground/90 tracking-tight",
        serviceTitle: "text-lg font-bold text-primary",
        contextSubtitle: "text-sm text-muted-foreground",

        // Sheet Container
        sheetBg: "bg-white/5",
        sheetBlur: "backdrop-blur-2xl",
        sheetRadius: "rounded-t-[2.5rem]",
        sheetShadow: "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]",
        highlightGradient: "bg-gradient-to-l from-white/20 to-transparent",
        highlightOpacity: "opacity-50",

        // Content
        contentPadding: "px-4 pt-8",
        bottomPadding: "pb-32",

        // Form Inputs
        inputHeight: "h-14",
        inputRadius: "rounded-xl",
        inputBg: "bg-white/5",
        inputBorder: "border-white/10",
        inputBorderHover: "hover:bg-white/10",
        inputBorderFocus: "focus:border-primary/50",

        // Buttons
        cancelButton: "bg-transparent border-white/10 hover:bg-white/5 text-muted-foreground",
        createButton: "bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_-5px_rgba(var(--primary-rgb),0.5)]",
        buttonHeight: "h-14",
        buttonRadius: "rounded-full"
    },

    // Proposal Modal (Chat feature)
    proposalModal: {
        // Sheet Container
        sheetBg: "bg-white/5",
        sheetBlur: "backdrop-blur-2xl",
        sheetRadius: "md:rounded-t-[2.5rem]",
        sheetShadow: "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]",
        highlightGradient: "bg-gradient-to-l from-white/20 to-transparent",
        highlightOpacity: "opacity-50",

        // Close Button
        closeButton: "rounded-full bg-white/5 hover:bg-white/10",

        // Cards
        cardBg: "bg-white/5",
        cardBorder: "border-white/10",
        cardRadius: "rounded-2xl",
        cardPadding: "p-4",

        // Typography
        sectionLabel: "text-xs font-bold uppercase tracking-widest text-muted-foreground",
        badgeText: "text-[10px] font-bold",
        badgeRadius: "rounded-full",
        title: "text-4xl font-light text-foreground tracking-tight",

        // Session Items
        sessionBadge: "w-10 h-10 rounded-full bg-white/5 border border-white/10",
        durationBadge: "text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md",

        // Accordion
        accordionTrigger: "text-sm hover:no-underline hover:bg-white/[0.02] px-2 rounded-lg py-3 text-foreground font-medium",

        // Buttons
        buttonHeight: "h-12",
        buttonRadius: "rounded-xl",
        voucherButton: "border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-semibold",
        declineButton: "border-white/10 bg-white/5 hover:bg-white/10 text-foreground font-semibold",
        acceptButton: "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20",

        // Status Indicators
        successBg: "bg-green-500/10",
        successBorder: "border-green-500/20",
        warningBg: "bg-amber-500/10",
        warningBorder: "border-amber-500/20",
        errorBg: "bg-red-500/10",
        errorBorder: "border-red-500/20",
        statusPadding: "p-3",
        statusPaddingLarge: "p-4",
        statusRadius: "rounded-xl"
    },

    // Content Container (replaces GlassSheet)
    contentContainer: {
        base: "flex-1 flex flex-col overflow-hidden", // Transparent version
    },
} as const;
