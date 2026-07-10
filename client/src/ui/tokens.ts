// TATTOI × Travel App Design System v2.0
// Font: DM Sans (primary), system-ui fallback
export const tokens = {
  // 1. Backgrounds
  // Exact match from Calendar/Dashboard
  bgGradient:
    "fixed inset-0 w-full h-[100dvh] bg-[radial-gradient(circle_at_top_right,rgba(23,44,104,0.4),rgba(2,5,17,1)_60%)]",

  // 2. Sheets
  // Main sheet (Dashboard, Calendar)
  sheetMain: {
    container:
      "flex-1 z-20 flex flex-col bg-popover rounded-t-[24px] overflow-hidden relative",
    highlight:
      "hidden",
    content: "flex-1 relative w-full overflow-hidden",
  },

  // Secondary sheet (Modals, Booking Wizard)
  sheetSecondary: {
    overlay: "fixed inset-0 z-[100] bg-background/80",
    content:
      "fixed inset-0 z-[101] w-full h-[100dvh] outline-none flex flex-col gap-0 overflow-hidden",
    container:
      "flex-1 z-20 flex flex-col bg-popover rounded-t-[24px] overflow-hidden relative will-change-transform",
    glass:
      "bg-popover rounded-t-[24px]",
    highlight:
      "hidden",
    header:
      "shrink-0 pt-6 pb-4 px-4 border-b border-border bg-popover z-10 relative",
  },

  // 3. Cards
  // TATTOI × Travel App DS v2.0 — surface token (bg-card = #1A1A1E dark / #FFFFFF light)
  card: {
    base: "group relative overflow-hidden transition-all duration-[150ms] border border-border/30 rounded-[16px]", // radius-md = 16px
    bg: "bg-card text-card-foreground hover:bg-card/90", // bg-surface in both themes
    bgAccent:
      "bg-gradient-to-r from-primary/20 to-primary/5 hover:from-primary/25 hover:to-primary/10",
    interactive: "cursor-pointer active:scale-[0.98]",
    leftAccent: "absolute left-0 top-0 bottom-0 w-[3px]", // Shared left accent style
    glow: {
      high: { line: "bg-red-600", gradient: "from-red-600/20" },
      medium: { line: "bg-orange-500", gradient: "from-orange-500/20" },
      low: { line: "bg-emerald-500", gradient: "from-emerald-500/20" },
      default: { line: "bg-primary", gradient: "from-primary/20" },
    },
  },

  // 4. Buttons — TATTOI × Travel App DS v2.0: 52px primary, 16px radius (inline) / 999px (CTA pills), yellow accent
  button: {
    primary:
      "bg-primary hover:bg-primary/90 active:bg-[#D4AC2A] text-primary-foreground h-[52px] px-6 rounded-[999px] text-[15px] font-semibold tracking-tight transition-all duration-[150ms] active:scale-[0.98] w-full",
    hero: "w-full h-[52px] rounded-[999px] font-semibold text-[15px] tracking-tight bg-primary hover:bg-primary/90 active:bg-[#D4AC2A] text-primary-foreground flex items-center justify-center transition-all duration-[150ms] active:scale-[0.98]",
    secondary:
      "bg-secondary hover:bg-secondary/80 text-secondary-foreground h-[52px] px-6 rounded-[16px] text-[15px] font-semibold transition-all duration-[150ms] active:scale-[0.98]",
    destructive:
      "bg-destructive hover:bg-destructive/90 text-destructive-foreground h-[52px] px-6 rounded-[16px] text-[15px] font-semibold transition-all duration-[150ms] active:scale-[0.98]",
    outline:
      "border border-border bg-transparent hover:bg-secondary text-foreground h-[52px] px-4 rounded-[16px] text-[15px] font-medium transition-all duration-[150ms] active:scale-[0.98]",
    ghost:
      "text-muted-foreground hover:text-foreground hover:bg-secondary rounded-[16px] transition-colors duration-[150ms]",
    link: "text-primary underline-offset-4 hover:underline px-0 transition-opacity active:opacity-70",
    icon: "rounded-[16px] bg-secondary hover:bg-secondary/80 text-foreground w-[52px] h-[52px] flex items-center justify-center transition-all duration-[150ms] active:scale-90",
    auth: "w-full h-[52px] rounded-[999px] font-semibold text-[15px] tracking-tight bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all duration-[150ms] active:scale-[0.98]",
    authSecondary: "w-full h-[52px] rounded-[16px] border border-border font-semibold text-[15px] bg-secondary hover:bg-secondary/80 text-secondary-foreground flex items-center justify-center transition-all duration-[150ms] active:scale-[0.98]",
  },

  // 5. FAB Menu — TATTOI × Travel App DS v2.0: yellow primary accent only
  fab: {
    container:
      "fixed bottom-[176px] right-5 z-[55] flex flex-col items-end gap-3",
    panel:
      "mb-2 p-4 rounded-[16px] border border-border shadow-none flex flex-col items-end gap-4 bg-popover w-[220px] max-h-[50vh] overflow-y-auto",
    itemRow: "flex items-center justify-end gap-3 w-full",
    itemLabel: "text-xs font-medium text-muted-foreground",
    itemButton:
      "h-10 w-10 rounded-full border border-border bg-card hover:bg-secondary flex items-center justify-center transition-all duration-[150ms] active:scale-95 text-foreground",
    itemButtonHighlight:
      "h-10 w-10 rounded-full border border-primary/30 bg-primary text-white hover:bg-primary/90 flex items-center justify-center transition-all duration-[150ms] active:scale-95",
    itemIconSize: "h-4 w-4",
    toggle:
      "h-14 w-14 rounded-full flex items-center justify-center transition-colors duration-[150ms] border border-border",
    toggleOpen: "bg-foreground text-background",
    toggleClosed: "bg-primary text-white",
    toggleIconSize: "h-6 w-6",

    // Animation variants (used as framer-motion presets)
    animation: {
      panel: {
        hidden: { opacity: 0, scale: 0.8 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: {
            delayChildren: 0.1,
            staggerChildren: 0.05,
          },
        },
      },
      item: {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 },
      },
    },
  },

  // 5b. Inputs — TATTOI × Travel App DS v2.0: 48px height, 16px radius, bg-card surface
  input: {
    base: "flex w-full min-w-0 border bg-card px-4 py-1 text-[15px] transition-[color,box-shadow] duration-[150ms] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm placeholder:text-disabled focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 aria-invalid:ring-destructive/20 aria-invalid:border-destructive file:text-foreground selection:bg-primary selection:text-primary-foreground",
    default: "h-[48px] rounded-[16px]",
    hero: "h-[48px] rounded-[16px] px-5 text-[15px] border-border bg-card hover:bg-card/90 focus-visible:border-primary text-foreground",
  },

  // 5c. Auth Flow Components
  authFlow: {
    iconContainer: "mx-auto w-16 h-16 rounded-[4px] bg-primary/20 flex items-center justify-center mb-4 border-2 border-primary/20 shadow-[0_0_15px_rgba(248,208,87,0.2)]",
    genderButton: "h-14 flex items-center justify-center px-3 rounded-[4px] border-2 text-sm font-medium transition-all outline-none border-border bg-secondary/50 text-foreground hover:bg-secondary/50",
    genderButtonActive: "h-14 flex items-center justify-center px-3 rounded-[4px] border-2 text-sm font-medium transition-all outline-none border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(248,208,87,0.15)]",
    placesInput: "bg-secondary/50 border-border h-14 rounded-[4px] pl-3",
    toggleContainer: "flex bg-secondary/50 p-1 rounded-[4px] mb-6 h-14 items-stretch",
    toggleButton: "flex-1 flex items-center justify-center text-sm font-bold rounded-[4px] transition-all text-muted-foreground hover:text-foreground",
    toggleButtonActive: "flex-1 flex items-center justify-center text-sm font-bold rounded-[4px] transition-all bg-background text-foreground shadow-sm",
  },

  // 6. Typography — TATTOI × Travel App DS v2.0
  header: {
    pageTitle: "text-[28px] font-bold leading-[1.2] text-foreground tracking-tight",
    pageSubtitle: "ml-2 text-[14px] font-normal text-muted-foreground",
    sectionTitle:
      "text-[11px] font-[500] text-muted-foreground tracking-[0.08em] uppercase",
    sheetTitle: "text-[28px] font-bold leading-[1.2] text-foreground tracking-tight",
    sheetSubtitle: "text-[14px] text-muted-foreground mt-1",
    contextTitle: "text-[28px] font-bold text-foreground tracking-tight",
    contextSubtitle: "text-muted-foreground text-[14px] font-normal mt-1",
  },

  // 7. Layout — TATTOI DS v2.0 spacing
  spacing: {
    pagePadding: "px-4 py-4",
    sheetPadding: "px-4 pt-6 pb-2",
    cardPadding: "p-4",
    containerPadding: "px-4 pb-8",
  },

  // 8. Page Shell
  shell: {
    base: "fixed inset-0 w-full h-[100dvh] flex flex-col overflow-hidden bg-background",
    header: "px-4 py-4 z-10 shrink-0 flex items-center bg-[var(--color-bg-header)]",
  },

  // 9. Navigation row — TATTOI DS v2.0: min-height 56px
  row: {
    base: "flex items-center gap-3 px-4 bg-card text-foreground transition-colors duration-[150ms] cursor-pointer hover:bg-secondary/50 active:bg-secondary",
    height: "min-h-[56px] py-[14px]",
    iconContainer: "w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0",
    label: "text-[15px] font-semibold text-foreground leading-[1.3]",
    description: "text-[12px] text-muted-foreground mt-[2px]",
    chevron: "ml-auto text-disabled",
    divider: "border-t border-divider mx-0",
  },

  // 10. Navigation Actions — yellow accent for active state
  navAction: {
    base: "flex flex-col items-center justify-center h-full py-2 px-4 gap-1 min-w-[72px] shrink-0 bg-transparent border-0 rounded-[12px] transition-all duration-[150ms] touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
    pressed: "scale-90 opacity-70",
    idle: "opacity-90 hover:opacity-100 hover:bg-secondary",
    activeCircle: "w-11 h-11 rounded-full bg-primary flex items-center justify-center",
    activeIcon: "text-primary-foreground",
    icon: {
      primary: "text-primary", // yellow accent
      accent: "text-primary",
      idle: "text-muted-foreground",
    },
  },

  // 9. Loading States
  loading: {
    base: "flex items-center justify-center gap-2",
    fullScreen:
      "fixed inset-0 flex items-center justify-center bg-background z-[200]",
    text: "text-muted-foreground",
  },

  // 10. Tabs / Segmented Controls
  tabs: {
    container: "flex w-full items-center justify-between gap-2",
    button:
      "flex-1 text-center text-lg tracking-tight transition-all duration-300 ease-out py-2 outline-none",
    active: "text-foreground font-bold opacity-100 scale-[1.02]",
    inactive:
      "text-muted-foreground font-medium opacity-40 hover:opacity-70 scale-[0.98]",
  },

  // 11. Selection Cards (Pills)
  selectionCard: {
    base: "w-full p-4 rounded-[6px] border transition-all text-left flex items-start gap-4 cursor-pointer group select-none",
    selected: "bg-primary/10 border-primary/50",
    idle: "bg-background/80 dark:bg-secondary/50 border-transparent hover:bg-background/80 dark:hover:bg-secondary/50",
    iconContainer: {
      base: "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors",
      selected: "bg-primary text-primary-foreground",
      idle: "bg-background/80 dark:bg-secondary/50",
    },
    indicator: {
      base: "w-8 h-8 rounded-full flex items-center justify-center border transition-all ml-4",
      selected: "bg-primary border-primary text-primary-foreground",
      idle: "bg-transparent border-black/20 dark:border-border text-transparent group-hover:border-black/40 dark:group-hover:border-border",
    },
    title: {
      base: "font-semibold text-base transition-colors",
      selected: "text-primary",
      idle: "text-foreground group-hover:text-foreground",
    },
    description: "text-sm text-muted-foreground mt-1",
  },

  // NEW: Photography / Destination Card — DS v2.0
  photographyCard: {
    base: "relative overflow-hidden rounded-[24px] bg-black",
    width: "w-[200px]",
    height: "h-[260px]",
    overlay: "absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60",
    tag: "frosted-light rounded-[6px] px-2 py-1 text-[11px] font-[500] text-white absolute top-3 left-3",
    name: "absolute bottom-10 left-3 right-3 text-[18px] font-bold text-white leading-tight",
    price: "absolute bottom-3 left-3 text-[15px] font-bold text-white",
    description: "text-[14px] text-muted-foreground mt-2 line-clamp-2",
  },

  // NEW: Filter Chip Row — DS v2.0
  filterChip: {
    container: "flex gap-2 overflow-x-auto no-scrollbar px-5 py-3",
    idle: "bg-card border border-border/50 text-foreground rounded-[6px] px-3 py-1.5 text-[11px] font-[500] shrink-0 whitespace-nowrap transition-all duration-150",
    active: "bg-primary text-primary-foreground rounded-[6px] px-3 py-1.5 text-[11px] font-[500] shrink-0 whitespace-nowrap transition-all duration-150",
    frosted: "frosted-light text-white rounded-[6px] px-3 py-1.5 text-[11px] font-[500] shrink-0 whitespace-nowrap",
  },

  // NEW: See All pill — DS v2.0
  seeAllPill: "bg-primary text-primary-foreground text-[13px] font-[600] px-[14px] py-[6px] rounded-[999px] h-[30px] flex items-center shrink-0",

  // NEW: Display / Hero typography — DS v2.0
  display: {
    hero: "text-[48px] font-bold uppercase tracking-[-0.02em] leading-[1.05] text-white",
    eyebrow: "text-[13px] font-normal text-muted-foreground",
    destinationName: "text-[18px] font-bold text-foreground",
    price: "text-[15px] font-bold text-foreground",
    specLabel: "text-[11px] font-normal text-muted-foreground",
    specValue: "text-[13px] font-[600] text-foreground",
  },

  // 12. Motion / Animations (Radix + Tailwind Animate)
  animations: {
    fade: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-500",
    sheetSlideUp:
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full duration-500 ease-in-out",
    sheetSlideSide:
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-4 data-[state=open]:slide-in-from-right-4",
    modalZoom:
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  },

  // 13. Framer Motion Variants (SSOT for framer-motion animations)
  motion: {
    // Standard spring transition for smooth, natural motion
    spring: {
      type: "spring" as const,
      damping: 30,
      stiffness: 300,
    },

    // Softer spring for modals and overlays
    springModal: {
      type: "spring" as const,
      damping: 25,
      stiffness: 300,
    },

    // Fixed-duration fade for symmetric overlay animations
    fadeDuration: {
      duration: 0.3,
      ease: "easeInOut" as const,
    },

    // Sheet slide-up animation
    sheetSlide: {
      initial: { y: "100%" },
      animate: { y: 0 },
      exit: { y: "100%" },
    },

    // Overlay fade animation (synchronized with sheet)
    overlayFade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },

    // Modal zoom animation
    modalZoomVariant: {
      initial: { opacity: 0, scale: 0.95, y: 20 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.95, y: 20 },
    },

    // Drag gesture configuration for swipe-to-close
    dragGesture: {
      threshold: 150, // Distance in pixels to trigger close
      elastic: 0.2, // Resistance when dragging beyond bounds
    },
  },

  // Calendar-specific tokens
  calendar: {
    // Cell backgrounds and borders
    cellBg: "bg-background/80 dark:bg-secondary/50",
    cellBgHover: "hover:bg-background/80 dark:hover:bg-secondary/50",
    cellBorder: "border-black/5 dark:border-border",
    cellBorderHover: "hover:border-black/10 dark:hover:border-border",
    selectedBg: "bg-primary/10",
    selectedBorder: "border-primary/50",
    selectedCellBg: "bg-primary/20",
    selectedCellBorder: "border-primary",
    todayBg: "bg-primary/5",
    todayRing: "ring-1 ring-primary/50",
    dimmedBg: "bg-background/80 dark:bg-secondary/50",

    // New Calendar Redesign Colors (Pastel Palette)
    // Light mode: soft pastels. Dark mode: jewel-tone muted variants.
    event: {
      orange: {
        bg: "bg-[#FFE4C4] dark:bg-[#7A3B0F]/40",
        text: "text-[#8B4513] dark:text-[#FFB07C]",
        border: "border-[#DEB887] dark:border-[#8B4513]/60",
      },
      purple: {
        bg: "bg-[#E6E6FA] dark:bg-[#3B0082]/40",
        text: "text-[#4B0082] dark:text-[#C4B5FD]",
        border: "border-[#9370DB] dark:border-[#7C3AED]/60",
      },
      green: {
        bg: "bg-[#F0FFF0] dark:bg-[#004D00]/40",
        text: "text-[#006400] dark:text-[#86EFAC]",
        border: "border-[#90EE90] dark:border-[#16A34A]/60",
      },
      pink: {
        bg: "bg-[#FFF0F5] dark:bg-[#7C0042]/40",
        text: "text-[#C71585] dark:text-[#F9A8D4]",
        border: "border-[#FFB6C1] dark:border-[#BE185D]/60",
      },
      blue: {
        bg: "bg-[#E0F7FA] dark:bg-[#004D5A]/40",
        text: "text-[#006064] dark:text-[#67E8F9]",
        border: "border-[#4DD0E1] dark:border-[#0891B2]/60",
      },
      // Fallback
      default: {
        bg: "bg-secondary",
        text: "text-foreground",
        border: "border-border",
      },
    },

    // Date Strip (New Design)
    dateStrip: {
      container: "flex gap-2 w-full overflow-x-auto no-scrollbar px-4 py-4",
      dayBtn:
        "flex flex-col items-center justify-center min-w-[60px] h-[80px] rounded-2xl transition-all duration-300 relative group shrink-0",
      dayBtnActive:
        "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105",
      dayBtnInactive: "bg-transparent text-foreground hover:bg-secondary",
      dayName: "text-xs font-medium mb-1",
      dayNumber: "text-xl font-bold",
    },

    // Time Grid (New Design)
    timeGrid: {
      timeLabel:
        "text-xs text-muted-foreground font-medium w-12 text-right pr-3 -mt-2",
      line: "border-t border-border w-full relative",
      currentTimeIndicator:
        "absolute left-0 right-0 border-t-2 border-blue-500 z-20 pointer-events-none flex items-center",
      currentTimeBubble:
        "absolute -left-1.5 w-3 h-3 rounded-full bg-blue-500 ring-2 ring-background",
    },

    // Timeline
    timelineBg: "bg-background/80 dark:bg-background/80",
    headerBg: "bg-secondary",
    slotHover: "hover:bg-border",
    slotActive: "active:bg-secondary",
    appointmentBorder: "border-border",
    emptyStateBg: "bg-secondary/50",

    // Text colors
    selectedText: "text-primary",
    todayText: "text-primary",
    dimmedText: "text-muted-foreground/30",
    hourLabel: "text-muted-foreground/60",
    appointmentText: "text-foreground/90",

    // Dividers
    divider: "border-border",
    hourBorder: "border-border",
    minuteBorder: "border-border/50",

    // Spacing
    contextHeight: "h-[20vh]",
    gridHeightCollapsed: "h-[25%]",
    timelineHeightExpanded: "basis-[75%]",
    timelineScrollHeight: "min-h-[2000px]",
    hourSlotHeight: "h-24",
    minuteSlotHeight: "h-6",

    // Icons/Badges
    iconBg: "bg-secondary",
    iconText: "text-secondary-foreground",
    badgeBg: "bg-secondary",
    badgeText: "text-secondary-foreground",
    dot: "bg-primary",
    dotSelected: "bg-primary-foreground/90",

    // Typography
    cardTitle: "font-semibold text-base",
    cardSubtitle: "text-xs text-muted-foreground",
    contextTitle: "text-4xl font-light text-foreground/90 tracking-tight",
    contextSubtitle: "text-muted-foreground text-lg font-medium",
    sheetTitle: "text-lg font-semibold text-foreground tracking-tight",
    dayLabel:
      "text-xs text-muted-foreground uppercase tracking-wider font-semibold",
    dayNumber: "text-2xl font-bold",
    timelineTitle:
      "text-sm font-bold text-muted-foreground uppercase tracking-widest",

    // Card styling
    card: "p-4 min-h-[120px] cursor-pointer transition-all duration-300 border-0 rounded-[6px]",

    // Specific Event Card (Agenda) - Rectangular, Tight Stack
    eventCard: {
      base: "group relative overflow-hidden transition-all duration-300 border-0 rounded-[6px] opacity-80", // Removed mb-2
      bg: "", // Cleared to allow getEventStyle palette to win and prevent purple tint/hover color change
      interactive: "cursor-pointer active:scale-[0.98]",
      padding: "p-3",
    },

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
      appointmentItem:
        "flex-1 flex flex-col justify-center px-1.5 py-0.5 min-h-0", // Individual appointment area
      appointmentText:
        "text-[9px] leading-tight font-medium truncate text-white", // Appointment details text
      appointmentTime: "text-[8px] opacity-80 truncate text-white", // Time text
    },
  },

  // Appointment Wizard (Calendar inline wizard)
  appointmentWizard: {
    // Header
    headerPadding: "px-4 py-4",
    backButton: "rounded-full bg-secondary hover:bg-secondary/80 text-foreground",
    title: "text-2xl font-bold text-foreground",

    // Context Area
    contextPadding: "px-6 pt-4 pb-8",
    contextHeight: "h-[15vh]",
    contextTitle: "text-4xl font-light text-foreground/90 tracking-tight",
    serviceTitle: "text-lg font-bold text-primary",
    contextSubtitle: "text-sm text-muted-foreground",

    // Sheet Container
    sheetBg: "bg-card",
    sheetBlur: "backdrop-blur-2xl",
    sheetRadius: "rounded-t-[2.5rem]",
    sheetShadow: "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]",
    highlightGradient: "bg-gradient-to-l from-foreground/10 to-transparent",
    highlightOpacity: "opacity-50",

    // Content
    contentPadding: "px-4 pt-8",
    bottomPadding: "pb-32",

    // Form Inputs
    inputHeight: "h-14",
    inputRadius: "rounded-[16px]",
    inputBg: "bg-background",
    inputBorder: "border-border",
    inputBorderHover: "hover:bg-secondary",
    inputBorderFocus: "focus:border-primary/50",

    // Buttons
    cancelButton:
      "bg-transparent border-border hover:bg-secondary text-muted-foreground",
    createButton:
      "bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_-5px_rgba(248,208,87,0.4)]",
    buttonHeight: "h-14",
    buttonRadius: "rounded-[16px]",
  },

  // Proposal Modal (Chat feature)
  proposalModal: {
    // Sheet Container
    sheetBg: "bg-card",
    sheetBlur: "backdrop-blur-2xl",
    sheetRadius: "md:rounded-t-[2.5rem]",
    sheetShadow: "shadow-2xl shadow-foreground/5 dark:shadow-none border border-border md:border-b-0",
    highlightGradient: "bg-gradient-to-l from-foreground/10 to-transparent",
    highlightOpacity: "opacity-50",

    // Close Button
    closeButton: "rounded-full bg-secondary hover:bg-secondary/80 text-foreground",

    // Cards
    cardBg: "bg-card hover:bg-secondary/50",
    cardBorder: "border-border",
    cardRadius: "rounded-[16px]",
    cardPadding: "p-4",

    // Typography
    sectionLabel:
      "text-xs font-bold uppercase tracking-widest text-muted-foreground",
    badgeText: "text-[10px] font-bold",
    badgeRadius: "rounded-full",
    title: "text-4xl font-light text-foreground tracking-tight",

    // Session Items
    sessionBadge: "w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-foreground",
    durationBadge:
      "text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md",

    // Accordion
    accordionTrigger:
      "text-sm hover:no-underline hover:bg-secondary px-2 rounded-lg py-3 text-foreground font-medium",

    // Buttons
    buttonHeight: "h-14",
    buttonRadius: "rounded-[16px]",
    voucherButton:
      "border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-semibold",
    declineButton:
      "border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold",
    acceptButton:
      "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20",

    // Status Indicators
    successBg: "bg-green-500/10",
    successBorder: "border-green-500/20",
    warningBg: "bg-amber-500/10",
    warningBorder: "border-amber-500/20",
    errorBg: "bg-red-500/10",
    errorBorder: "border-red-500/20",
    statusPadding: "p-3",
    statusPaddingLarge: "p-4",
    statusRadius: "rounded-[16px]",
  },

  // Content Container (replaces GlassSheet)
  contentContainer: {
    base: "flex-1 flex flex-col overflow-hidden", // Transparent version
  },
} as const;
