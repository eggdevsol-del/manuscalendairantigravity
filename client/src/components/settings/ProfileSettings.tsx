import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getAssetUrl } from "@/lib/assets";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { GooglePlacesInput } from "@/components/ui/GooglePlacesInput";
import { ChevronLeft, User } from "lucide-react";

export function ProfileSettings({ onBack }: { onBack: () => void }) {
    const { user, logout } = useAuth();

    // Danger Zone state for clients
    const [activeAction, setActiveAction] = useState<"account" | null>(null);
    const [confirmText, setConfirmText] = useState("");

    // Profile state
    const [profileName, setProfileName] = useState("");
    const [profilePhone, setProfilePhone] = useState("");
    const [profileBio, setProfileBio] = useState("");
    const [profileAvatar, setProfileAvatar] = useState("");
    const [profileBirthday, setProfileBirthday] = useState("");
    const [profileAddress, setProfileAddress] = useState("");
    const [profileCity, setProfileCity] = useState("");
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const updateProfileMutation = trpc.auth.updateProfile.useMutation({
        onSuccess: () => {
            toast.success("Profile updated successfully");
        },
        onError: error => {
            toast.error("Failed to update profile: " + error.message);
        },
    });

    const uploadImageMutation = trpc.upload.uploadImage.useMutation({
        onSuccess: () => {
            toast.success("Image uploaded successfully");
        },
        onError: error => {
            toast.error("Failed to upload image: " + error.message);
            setUploadingAvatar(false);
        },
    });

    const deleteAccountMutation = trpc.auth.deleteAccount.useMutation({
        onSuccess: async () => {
            toast.success("Your account has been permanently deleted.");
            await logout();
            window.location.href = "/";
        },
        onError: error => {
            toast.error("Failed to delete account: " + error.message);
        }
    });

    const initializedProfileRef = useRef(false);

    // Initialize Profile state from user once
    if (user && !initializedProfileRef.current) {
        setProfileName(user.name || "");
        setProfilePhone(user.phone || "");
        setProfileBio(user.bio || "");
        setProfileAvatar(user.avatar || "");
        setProfileBirthday(user.birthday || "");
        setProfileAddress(user.address || "");
        setProfileCity(user.city || "");
        initializedProfileRef.current = true;
    }

    const handleSaveProfile = () => {
        updateProfileMutation.mutate({
            name: profileName,
            phone: profilePhone,
            bio: profileBio,
            avatar: profileAvatar,
            birthday: profileBirthday,
            address: profileAddress,
            city: profileCity,
        });
    };

    const handleExecuteDelete = () => {
        if (confirmText !== "DELETE") {
            toast.error("You must type exactly 'DELETE' to confirm.");
            return;
        }
        deleteAccountMutation.mutate();
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please upload an image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be less than 5MB");
            return;
        }

        setUploadingAvatar(true);

        const reader = new FileReader();
        reader.onload = async e => {
            const base64Data = e.target?.result as string;

            try {
                const result = await uploadImageMutation.mutateAsync({
                    fileName: file.name,
                    fileData: base64Data,
                    contentType: file.type,
                });

                setProfileAvatar(result.url);
                setUploadingAvatar(false);
            } catch (error) {
                console.error(error);
            }
        };

        reader.onerror = () => {
            toast.error("Failed to read image file");
            setUploadingAvatar(false);
        };

        reader.readAsDataURL(file);
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
            {/* 1. Page Header - Floating style */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <h2 className="text-xl font-semibold text-foreground">Profile</h2>
            </div>

            {/* 2. Scroll Container */}
            <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
                <div className="pb-[180px] max-w-lg mx-auto space-y-6 px-4 pt-6">
                    {/* Avatar Display */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center overflow-hidden mb-4 shadow-xl border border-white/10">
                            {profileAvatar ? (
                                <img
                                    src={getAssetUrl(profileAvatar)}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <User className="w-12 h-12 text-white/50" />
                            )}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Profile Picture</Label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="file"
                                    id="avatar-upload"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                    disabled={uploadingAvatar}
                                />
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        document.getElementById("avatar-upload")?.click()
                                    }
                                    disabled={uploadingAvatar}
                                    className="bg-transparent border-white/10 hover:bg-white/5"
                                >
                                    {uploadingAvatar ? "Uploading..." : "Upload New Photo"}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={profileName}
                                onChange={e => setProfileName(e.target.value)}
                                placeholder="Your name"
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                value={profilePhone}
                                onChange={e => setProfilePhone(e.target.value)}
                                placeholder="Your phone number"
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="birthday">Birthdate</Label>
                            <Input
                                id="birthday"
                                type="date"
                                value={profileBirthday}
                                onChange={e => setProfileBirthday(e.target.value)}
                                className="bg-white/5 border-white/10 [color-scheme:dark]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                value={profileAddress}
                                onChange={e => setProfileAddress(e.target.value)}
                                placeholder="E.g. 123 Main St"
                                rows={2}
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <GooglePlacesInput
                                placeholder="Search city..."
                                defaultValue={profileCity}
                                onPlaceSelected={(place) => {
                                    const cityComp = place.address_components.find(c => c.types.includes("locality"));
                                    setProfileCity(cityComp?.long_name || place.name || "");
                                }}
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bio">Bio</Label>
                            <Textarea
                                id="bio"
                                value={profileBio}
                                onChange={e => setProfileBio(e.target.value)}
                                placeholder="Tell us about yourself"
                                rows={4}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                        className="w-full shadow-lg shadow-primary/20"
                    >
                        {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>

                    {/* Delete Account — available to all users for regulatory compliance */}
                    <div className="pt-8 text-center pb-8">
                        <button
                            onClick={() => setActiveAction(activeAction === "account" ? null : "account")}
                            className="text-[10px] text-muted-foreground/30 hover:text-red-500/80 transition-colors uppercase tracking-widest"
                        >
                            delete account
                        </button>

                        {activeAction === "account" && (
                            <div className="mt-4 p-4 border border-red-500/20 bg-red-500/5 rounded-lg animate-in fade-in slide-in-from-top-2 text-left">
                                <p className="text-xs text-red-500 mb-2 font-medium">Type <strong>DELETE</strong> below to permanently delete your account and all data.</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder="DELETE"
                                        className="bg-zinc-900 border border-red-500/50 rounded-[4px] px-3 py-2 text-xs text-foreground w-full outline-none focus:border-red-500 flex-1"
                                    />
                                    <button
                                        onClick={handleExecuteDelete}
                                        disabled={confirmText !== "DELETE" || deleteAccountMutation.isPending}
                                        className="bg-red-500 text-white font-bold text-xs uppercase tracking-wider px-3 rounded-[4px] disabled:opacity-50 transition-all active:scale-95"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
