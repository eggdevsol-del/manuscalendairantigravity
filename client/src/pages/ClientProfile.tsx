import { useState, useMemo, useEffect } from "react";
import { useClientProfileController } from "@/features/profile/useClientProfileController";
import { ProfileHeader } from "@/features/profile/components/ProfileHeader";
import { ProfileSwipeCarousel } from "@/features/profile/components/ProfileSwipeCarousel";

import { motion } from "framer-motion";
import {
  PhotosCard,
  HistoryCard,
  UpcomingCard,
  FormsCard,
} from "@/features/profile/components/ContentCards";
import { EditBioModal } from "@/features/profile/components/EditBioModal";
import { useRegisterBottomNavRow } from "@/contexts/BottomNavContext";
import { ClientArtistCard } from "@/features/client-profile/ClientArtistCard";
import {
  Edit3,
  User,
  ToggleLeft,
  ToggleRight,
  MessageCircle,
} from "lucide-react";
import { NavActionButton, PageShell } from "@/components/ui/ssot";

import { useTeaser } from "@/contexts/TeaserContext";
import { Lock } from "lucide-react";
import { InstallAppModal } from "@/components/modals/InstallAppModal";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function ClientProfile() {
  const { isTeaserClient } = useTeaser();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [, setLocation] = useLocation();

  const {
    profile,
    trustBadges,

    photos,
    history,
    upcoming,
    forms,
    updateBio,
    updateAvatar,
  } = useClientProfileController();

  const [isEditMode, setIsEditMode] = useState(false);
  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [activeTabId, setActiveTabId] = useState("artists");
  const [isShopExpanded, setIsShopExpanded] = useState(false);

  // Deep-linking to tabs via query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["artists", "upcoming", "forms", "history", "photos"].includes(tab)) {
      setActiveTabId(tab);
    }
  }, []);

  // Fetch conversations to get connected artists
  const { data: conversations } = trpc.conversations.list.useQuery(undefined, {
    staleTime: 30000,
  });

  // File Input Ref for Profile Pic
  const handleProfilePicUpload = () => {
    // Mock upload for now
    const url = prompt("Enter new avatar URL:");
    if (url) updateAvatar.mutate({ avatarUrl: url });
  };
  const clientProfileActions = useMemo(
    () => (
      <>
        {[
          {
            id: "edit-toggle",
            label: isEditMode ? "Done" : "Edit",
            icon: isEditMode ? ToggleRight : ToggleLeft,
            onClick: () => setIsEditMode(!isEditMode),
            highlight: isEditMode,
          },
          {
            id: "profile-pic",
            label: "Profile Pic",
            icon: User,
            onClick: handleProfilePicUpload,
          },
          {
            id: "edit-bio",
            label: "Bio",
            icon: Edit3,
            onClick: () => setIsBioModalOpen(true),
          },
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
    ),
    [isEditMode, handleProfilePicUpload]
  );

  useRegisterBottomNavRow("client-profile", clientProfileActions);

  // Artist cards content
  const artistCardsContent = useMemo(() => {
    if (!conversations || conversations.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">No artists yet</p>
            <p className="text-muted-foreground/60 text-xs">Your artist connections will appear here</p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-3 overflow-y-auto mobile-scroll h-full">
        {conversations.map((conv: any) => {
          const artist = conv.otherUser;
          if (!artist) return null;

          const bannerUrl = artist.funnelBannerUrl || null;
          const artistName = artist.name || artist.firstName || "Artist";
          const avatarUrl = artist.avatar || null;

          return (
            <ClientArtistCard 
              key={conv.id} 
              conv={conv} 
              onShopToggle={setIsShopExpanded}
            />
          );
        })}
      </div>
    );
  }, [conversations, setIsShopExpanded]);

  const tabs = useMemo(
    () => [
      {
        id: "artists",
        label: "My Artists",
        content: artistCardsContent,
      },
      {
        id: "upcoming",
        label: "Upcoming",
        content: <UpcomingCard upcoming={upcoming || []} />,
      },
      {
        id: "forms",
        label: "Forms",
        content: <FormsCard forms={forms || []} />,
      },
      {
        id: "history",
        label: "History",
        content: <HistoryCard history={history || []} />,
      },
      {
        id: "photos",
        label: "Photos",
        content: <PhotosCard photos={photos || []} isEditMode={isEditMode} />,
      },
    ],
    [upcoming, forms, history, photos, isEditMode, artistCardsContent]
  );

  return (
    <PageShell className="bg-transparent">
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

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

      <div
        className={cn(
          "flex flex-col h-full w-full",
          isTeaserClient && "filter blur-sm pointer-events-none select-none"
        )}
      >
        {/* Header */}
        <motion.div layout className="shrink-0">
          <ProfileHeader
            user={profile}
            trustBadges={trustBadges}
            isEditMode={isEditMode}
            onEditAvatar={handleProfilePicUpload}
            isCompact={isShopExpanded}
          />
        </motion.div>

        {/* Swipeable Cards */}
        <motion.div layout className="flex-1 min-h-0 relative">
          <ProfileSwipeCarousel
            tabs={tabs}
            defaultTab={activeTabId}
            onTabChange={setActiveTabId}
          />
        </motion.div>

        {/* Modals */}
        <EditBioModal
          isOpen={isBioModalOpen}
          onClose={() => setIsBioModalOpen(false)}
          initialBio={profile?.bio || ""}
          onSave={async bio => updateBio.mutate({ bio })}
        />
      </div>
    </PageShell>
  );
}
