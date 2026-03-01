import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getAssetUrl } from "@/lib/assets";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { User } from "lucide-react";

export function ProfileSettings({ onBack }: { onBack: () => void }) {
    const { user } = useAuth();

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
        <PageShell>
            {/* 1. Page Header - Left aligned, no icons */}
            <PageHeader title="Profile" onBack={onBack} />

            {/* 2. Top Context Area */}
            <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center overflow-hidden mb-2">
                    {profileAvatar ? (
                        <img
                            src={getAssetUrl(profileAvatar)}
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <User className="w-10 h-10 text-white/50" />
                    )}
                </div>
            </div>

            {/* 3. Sheet Container */}
            <div className={tokens.contentContainer.base}>
                <div className="flex-1 w-full h-full px-4 pt-6 overflow-y-auto mobile-scroll touch-pan-y">
                    <div className="pb-32 max-w-lg mx-auto space-y-6">
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
                                <Input
                                    id="city"
                                    value={profileCity}
                                    onChange={e => setProfileCity(e.target.value)}
                                    placeholder="E.g. Melbourne"
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
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
