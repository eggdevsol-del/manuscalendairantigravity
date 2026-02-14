import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

export function useClientProfileController() {
    // Queries
    const { data: profile, isLoading: loadingProfile } = trpc.clientProfile.getProfile.useQuery();
    const { data: spend, isLoading: loadingSpend } = trpc.clientProfile.getSpendSummary.useQuery();
    const { data: history, isLoading: loadingHistory } = trpc.clientProfile.getHistory.useQuery();
    const { data: boards, isLoading: loadingBoards } = trpc.clientProfile.getBoards.useQuery();
    const { data: photos, isLoading: loadingPhotos } = trpc.clientProfile.getPhotos.useQuery();
    const { data: upcoming, isLoading: loadingUpcoming } = trpc.clientProfile.getUpcoming.useQuery();
    const { data: forms, isLoading: loadingForms } = trpc.clientProfile.getConsentForms.useQuery();

    const utils = trpc.useContext();

    // Mutations
    const updateBio = trpc.clientProfile.updateBio.useMutation({
        onSuccess: () => utils.clientProfile.getProfile.invalidate()
    });
    const updateAvatar = trpc.clientProfile.updateAvatar.useMutation({
        onSuccess: () => utils.clientProfile.getProfile.invalidate()
    });
    const createMoodboard = trpc.clientProfile.createMoodboard.useMutation({
        onSuccess: () => utils.clientProfile.getBoards.invalidate()
    });
    const deleteMoodboard = trpc.clientProfile.deleteMoodboard.useMutation({
        onSuccess: () => utils.clientProfile.getBoards.invalidate()
    });
    const addMoodboardImage = trpc.clientProfile.addMoodboardImage.useMutation({
        onSuccess: () => utils.clientProfile.getBoards.invalidate()
    });

    // Trust Badge Logic (Selector)
    const trustBadges = useMemo(() => {
        if (!spend) return [];
        const badges: { id: string; label: string; type: 'gold' | 'platinum' }[] = [];

        // Big Spender: Any single sitting >= $2k
        if (spend.maxSingleSpend >= 2000) {
            badges.push({ id: 'big_spender', label: 'Big Spender', type: 'gold' });
        }

        // Richy Rich: Lifetime >= $30k
        if (spend.totalSpend >= 30000) {
            badges.push({ id: 'richy_rich', label: 'Richy Rich', type: 'platinum' });
        }

        return badges;
    }, [spend]);

    return {
        // Data
        profile,
        spend,
        history,
        boards,
        photos,
        forms,
        upcoming,
        trustBadges,

        // Loading States
        isLoading: loadingProfile || loadingSpend || loadingHistory || loadingBoards || loadingPhotos || loadingUpcoming || loadingForms,

        // Mutations
        updateBio,
        updateAvatar,
        createMoodboard,
        deleteMoodboard,
        addMoodboardImage
    };
}
