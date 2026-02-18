import { useState, useRef, useCallback, useMemo } from 'react';

export function useChatState() {
    const [messageText, setMessageText] = useState("");

    // Scroll Logic
    const viewportRef = useRef<HTMLDivElement>(null);
    const [scrollIntent, setScrollIntent] = useState<'AUTO_FOLLOW' | 'USER_READING_HISTORY'>('AUTO_FOLLOW');

    // UI State
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showClientInfo, setShowClientInfo] = useState(false);
    const [showBookingCalendar, setShowBookingCalendar] = useState(false);
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Project Wizard State
    const [showProjectWizard, setShowProjectWizard] = useState(false);
    const [projectStartDate, setProjectStartDate] = useState<Date | null>(null);

    // Proposal View State
    const [selectedProposal, setSelectedProposal] = useState<{ message: any, metadata: any } | null>(null);

    // Client Confirm Dialog State
    const [showClientConfirmDialog, setShowClientConfirmDialog] = useState(false);
    const [clientConfirmMessageId, setClientConfirmMessageId] = useState<number | null>(null);
    const [clientConfirmDates, setClientConfirmDates] = useState<{ date: string, selected: boolean }[]>([]);
    const [clientConfirmMetadata, setClientConfirmMetadata] = useState<any>(null);

    // Scroll Handlers
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (viewportRef.current) {
            const vp = viewportRef.current;
            setScrollIntent('AUTO_FOLLOW');
            vp.scrollTo({ top: vp.scrollHeight, behavior });
        }
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const { scrollTop, scrollHeight, clientHeight } = target;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

        if (isAtBottom) {
            if (scrollIntent !== 'AUTO_FOLLOW') {
                setScrollIntent('AUTO_FOLLOW');
            }
        } else {
            if (scrollIntent !== 'USER_READING_HISTORY') {
                setScrollIntent('USER_READING_HISTORY');
            }
        }
    }, [scrollIntent]);

    // Calendar Logic
    const nextMonth = useCallback(() => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }, []);

    const prevMonth = useCallback(() => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }, []);

    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push({ type: 'empty', key: `empty-${i}` });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            days.push({ type: 'day', day, date, key: day });
        }
        return days;
    }, [currentMonth]);

    const value = useMemo(() => ({
        // State
        messageText, setMessageText,
        viewportRef,
        scrollIntent, setScrollIntent,
        uploadingImage, setUploadingImage,
        showClientInfo, setShowClientInfo,
        showBookingCalendar, setShowBookingCalendar,
        selectedDates, setSelectedDates,
        currentMonth, setCurrentMonth,
        showProjectWizard, setShowProjectWizard,
        projectStartDate, setProjectStartDate,
        selectedProposal, setSelectedProposal,
        showClientConfirmDialog, setShowClientConfirmDialog,
        clientConfirmMessageId, setClientConfirmMessageId,
        clientConfirmDates, setClientConfirmDates,
        clientConfirmMetadata, setClientConfirmMetadata,

        // Handlers/Computeds
        scrollToBottom,
        handleScroll,
        nextMonth,
        prevMonth,
        calendarDays
    }), [
        messageText,
        scrollIntent,
        uploadingImage,
        showClientInfo,
        showBookingCalendar,
        selectedDates,
        currentMonth,
        showProjectWizard,
        projectStartDate,
        selectedProposal,
        showClientConfirmDialog,
        clientConfirmMessageId,
        clientConfirmDates,
        clientConfirmMetadata,
        scrollToBottom,
        handleScroll,
        nextMonth,
        prevMonth,
        calendarDays
    ]);

    return value;
}
