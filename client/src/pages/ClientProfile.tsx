import { useState, useMemo } from "react";
import { useClientProfileController } from "@/features/profile/useClientProfileController";
import { ProfileHeader } from "@/features/profile/components/ProfileHeader";
import { ProfileSwipeCarousel } from "@/features/profile/components/ProfileSwipeCarousel";

import { PhotosCard, HistoryCard, UpcomingCard, FormsCard } from "@/features/profile/components/ContentCards";
import { EditBioModal } from "@/features/profile/components/EditBioModal";
import { useRegisterBottomNavRow } from "@/contexts/BottomNavContext";
import { Edit3, User, ToggleLeft, ToggleRight, LayoutTemplate } from "lucide-react";
import { NavActionButton } from "@/components/ui/ssot";

import { useTeaser } from "@/contexts/TeaserContext";
import { Lock } from "lucide-react";
import { InstallAppModal } from "@/components/modals/InstallAppModal";
import { cn } from "@/lib/utils";

export default function ClientProfile() {
    const { isTeaserClient } = useTeaser();
    const [showInstallModal, setShowInstallModal] = useState(false);

    const {
        profile,
        trustBadges,

        photos,
        history,
        upcoming,
        forms,
        updateBio,
        updateAvatar
    } = useClientProfileController();

    const [isEditMode, setIsEditMode] = useState(false);
    const [isBioModalOpen, setIsBioModalOpen] = useState(false);
    const [activeTabId, setActiveTabId] = useState("upcoming");

    // File Input Ref for Profile Pic
    const handleProfilePicUpload = () => {
        // Mock upload for now
        const url = prompt("Enter new avatar URL:");
        if (url) updateAvatar.mutate({ avatarUrl: url });
    };
    useRegisterBottomNavRow("client-profile", (
        <>
            {[
                {
                    id: "edit-toggle",
                    label: isEditMode ? "Done" : "Edit",
                    icon: isEditMode ? ToggleRight : ToggleLeft,
                    onClick: () => setIsEditMode(!isEditMode),
                    highlight: isEditMode
                },
                {
                    id: "profile-pic",
                    label: "Profile Pic",
                    icon: User,
                    onClick: handleProfilePicUpload
                },
                {
                    id: "edit-bio",
                    label: "Bio",
                    icon: Edit3,
                    onClick: () => setIsBioModalOpen(true)
                }
            ].map(item => (
                <NavActionButton
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    icon={item.icon}
                    onAction={item.onClick}
                    highlight={item.highlight}
                />
            ))}
        </>
    ));

    const tabs = useMemo(() => [
        {
            id: "upcoming",
            label: "Upcoming",
            content: <UpcomingCard upcoming={upcoming || []} />
        },
        {
            id: "forms",
            label: "Forms",
            content: <FormsCard forms={forms || []} />
        },
        {
            id: "history",
            label: "History",
            content: <HistoryCard history={history || []} />
        },
        {
            id: "photos",
            label: "Photos",
            content: <PhotosCard photos={photos || []} isEditMode={isEditMode} />
        }
    ], [upcoming, forms, history, photos, isEditMode]);

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-background to-background/80 relative overflow-hidden">
            <InstallAppModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />

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
                        <h3 className="text-xl font-bold">Profile Locked</h3>
                        <button className="text-sm font-medium text-primary hover:underline">
                            Install app to manage profile
                        </button>
                    </div>
                </div>
            )}

            <div className={cn("flex flex-col h-full w-full", isTeaserClient && "filter blur-sm pointer-events-none select-none")}>
                {/* Header */}
                <div className="shrink-0">
                    <ProfileHeader
                        user={profile}
                        trustBadges={trustBadges}
                        isEditMode={isEditMode}
                        onEditAvatar={handleProfilePicUpload}
                    />
                </div>

                {/* Swipeable Cards */}
                <div className="flex-1 min-h-0 relative">
                    <ProfileSwipeCarousel tabs={tabs} defaultTab={activeTabId} onTabChange={setActiveTabId} />
                </div>

                {/* Modals */}
                <EditBioModal
                    isOpen={isBioModalOpen}
                    onClose={() => setIsBioModalOpen(false)}
                    initialBio={profile?.bio || ""}
                    onSave={async (bio) => updateBio.mutate({ bio })}
                />
            </div>
        </div>
    );
}
