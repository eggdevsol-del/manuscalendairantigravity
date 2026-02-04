import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PromotionCardData } from "@/features/promotions";

export function usePromotionsController() {
    const { user } = useAuth();
    const isArtist = user?.role === 'artist';

    const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
    const [focalIndex, setFocalIndex] = useState(0);
    const [showCreateWizard, setShowCreateWizard] = useState(false);
    const [showSendSheet, setShowSendSheet] = useState(false);
    const [showAutoApplySheet, setShowAutoApplySheet] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<PromotionCardData | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // Fetch all promotions
    const { data: promotions = [], isLoading, refetch } = trpc.promotions.getPromotions.useQuery(
        {},
        { enabled: !!user }
    );

    const deleteMutation = trpc.promotions.deleteTemplate.useMutation({
        onSuccess: () => {
            toast.success('Promotion deleted');
            setSelectedCardId(null);
            setShowDeleteDialog(false);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete promotion');
        }
    });

    const handleDelete = () => {
        if (selectedCardId) {
            deleteMutation.mutate({ templateId: selectedCardId });
        }
    };

    const handleEdit = () => {
        const card = promotions.find(p => p.id === selectedCardId);
        if (card) {
            setEditingPromotion(card as PromotionCardData);
            setShowCreateWizard(true);
        }
    };

    const handleUseOnBooking = () => {
        const selectedCard = promotions.find(c => c.id === selectedCardId);
        if (!selectedCard) return;
        sessionStorage.setItem('pendingPromotion', JSON.stringify({
            id: selectedCard.id,
            type: selectedCard.type,
            name: selectedCard.name,
            value: selectedCard.value,
            valueType: selectedCard.valueType,
            code: selectedCard.code,
        }));
        toast.success('Promotion ready to use!');
    };

    const handleCreate = () => {
        setEditingPromotion(null);
        setShowCreateWizard(true);
    };

    const closeCreateWizard = () => {
        setShowCreateWizard(false);
        setEditingPromotion(null);
        refetch();
    };

    return {
        user,
        isArtist,
        promotions,
        isLoading,
        selectedCardId,
        setSelectedCardId,
        focalIndex,
        setFocalIndex,
        showCreateWizard,
        setShowCreateWizard,
        showSendSheet,
        setShowSendSheet,
        showAutoApplySheet,
        setShowAutoApplySheet,
        editingPromotion,
        showDeleteDialog,
        setShowDeleteDialog,
        deleteMutation,
        handleDelete,
        handleEdit,
        handleUseOnBooking,
        handleCreate,
        closeCreateWizard,
        refetch
    };
}
