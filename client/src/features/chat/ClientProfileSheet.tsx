import { ScrollArea, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { User, Mail, Phone, Cake, BadgeCheck, Image as ImageIcon, Camera, Loader2, Ticket, Calendar, Edit2, Check, X } from "lucide-react";
import { format, addDays } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { createPortal } from "react-dom";
import { WebPushSettings } from "@/components/WebPushSettings";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getAssetUrl } from "@/lib/assets";

interface ClientProfileSheetProps {
    isOpen: boolean;
    onClose: () => void;
    client: {
        id?: string;
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        birthday?: string | null;
        avatar?: string | null;
    } | null | undefined;
}

export function ClientProfileSheet({ isOpen, onClose, client }: ClientProfileSheetProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDate, setEditDate] = useState<string>("");
    const utils = trpc.useUtils();

    // Fetch client media from leads
    const { data: mediaData, isLoading: mediaLoading } = trpc.conversations.getClientMedia.useQuery(
        { clientId: client?.id || '' },
        {
            enabled: isOpen && !!client?.id,
            staleTime: 30000, // Cache for 30 seconds
        }
    );

    // Fetch client promotions
    const { data: promotions, isLoading: promotionsLoading } = trpc.promotions.getClientPromotions.useQuery(
        { clientId: client?.id || '' },
        {
            enabled: isOpen && !!client?.id,
        }
    );

    const updatePromotionMutation = trpc.promotions.updateIssuedPromotion.useMutation({
        onSuccess: () => {
            toast.success("Promotion updated");
            utils.promotions.getClientPromotions.invalidate({ clientId: client?.id || '' });
        },
        onError: (err) => {
            toast.error(err.message);
        }
    });

    if (!client) return null;

    const hasMedia = mediaData && mediaData.totalCount > 0;

    return (
        <>
            <SheetShell
                isOpen={isOpen}
                onClose={onClose}
                title="Client Profile"
                side="right"
                className="w-[400px] sm:w-[540px] border-l border-white/10"
                overlayName="Client Profile"
                overlayId="chat.client_profile"
            >
                <div className="flex items-center gap-4 mb-6 px-1">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden ring-4 ring-background/50 shadow-xl">
                        {client.avatar ? (
                            <img src={getAssetUrl(client.avatar)} alt={client.name || "Client"} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-2xl text-white font-bold">
                                {(client.name || "?").charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            {client.name || "Unknown Client"}
                            <BadgeCheck className="w-5 h-5 text-blue-400" />
                        </h2>
                        <p className="text-sm text-muted-foreground">Client since {new Date().getFullYear()}</p>
                    </div>
                </div>

                <Tabs defaultValue="info" className="flex-1">
                    <TabsList className="grid w-full grid-cols-4 bg-muted/20 p-1 rounded-xl">
                        <TabsTrigger value="info" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-lg text-xs sm:text-sm">Info</TabsTrigger>
                        <TabsTrigger value="promotions" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-lg text-xs sm:text-sm">
                            Promos {promotions && promotions.length > 0 && <span className="ml-1 text-[10px] opacity-70">({promotions.length})</span>}
                        </TabsTrigger>
                        <TabsTrigger value="media" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-lg text-xs sm:text-sm">
                            Media {hasMedia && <span className="ml-1 text-[10px] opacity-70">({mediaData.totalCount})</span>}
                        </TabsTrigger>
                        <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-lg text-xs sm:text-sm">History</TabsTrigger>
                    </TabsList>

                    <ScrollArea className="h-[calc(100vh-250px)] mt-6 -mr-6 pr-6">
                        <TabsContent value="info" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                            <div className="grid gap-4">
                                <div className="p-4 rounded-2xl bg-muted/30 border border-white/5 space-y-1">
                                    <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                                        <Mail className="w-3 h-3" /> Contact Email
                                    </div>
                                    <p className="font-medium text-foreground text-sm">{client.email || "No email provided"}</p>
                                </div>

                                <div className="p-4 rounded-2xl bg-muted/30 border border-white/5 space-y-1">
                                    <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                                        <Phone className="w-3 h-3" /> Phone Number
                                    </div>
                                    <p className="font-medium text-foreground text-sm">{client.phone || "No phone number"}</p>
                                </div>

                                <div className="p-4 rounded-2xl bg-muted/30 border border-white/5 space-y-1">
                                    <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                                        <Cake className="w-3 h-3" /> Birthday
                                    </div>
                                    <p className="font-medium text-foreground text-sm">
                                        {client.birthday
                                            ? format(new Date(client.birthday), 'MMMM do, yyyy')
                                            : "Not set"}
                                    </p>
                                </div>

                                <WebPushSettings />
                            </div>
                        </TabsContent>

                        <TabsContent value="promotions" className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                            {promotionsLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Loading promotions...</p>
                                </div>
                            ) : !promotions || promotions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-50">
                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                        <Ticket className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-medium">No active promotions</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {promotions.map((promo) => {
                                        const isEditing = editingId === promo.id;
                                        const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();

                                        return (
                                            <div key={promo.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-base">{promo.name}</h4>
                                                        <p className="text-sm text-muted-foreground">
                                                            {promo.valueType === 'percentage'
                                                                ? `${promo.originalAmount}% Discount` // Using originalAmount as placeholder if value is missing
                                                                : `$${(promo.originalAmount / 100).toFixed(2)} Value`
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className={cn(
                                                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                                                        isExpired ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500"
                                                    )}>
                                                        {isExpired ? 'Expired' : promo.status === 'active' ? 'Active' : promo.status}
                                                    </div>
                                                </div>

                                                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Calendar className="w-4 h-4" />
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    type="date"
                                                                    value={editDate}
                                                                    onChange={(e) => setEditDate(e.target.value)}
                                                                    className="h-8 w-32 px-2 text-xs"
                                                                />
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-green-500 hover:text-green-400"
                                                                    onClick={() => {
                                                                        // Save
                                                                        const date = new Date(editDate);
                                                                        // Set to end of day? Or just date. Backend expects ISO string.
                                                                        // Let's ensure time is preserved or set to end of day.
                                                                        // Simple approach: set to 23:59:59 of that day
                                                                        date.setHours(23, 59, 59);
                                                                        const iso = date.toISOString().slice(0, 19).replace('T', ' ');

                                                                        updatePromotionMutation.mutate({
                                                                            id: promo.id,
                                                                            expiresAt: iso
                                                                        });
                                                                        setEditingId(null);
                                                                    }}
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-red-500 hover:text-red-400"
                                                                    onClick={() => setEditingId(null)}
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span>
                                                                Expires: {promo.expiresAt
                                                                    ? format(new Date(promo.expiresAt), 'MMM do, yyyy')
                                                                    : 'Never'
                                                                }
                                                            </span>
                                                        )}
                                                    </div>

                                                    {!isEditing && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                            onClick={() => {
                                                                setEditingId(promo.id);
                                                                // Initialize edit date
                                                                if (promo.expiresAt) {
                                                                    setEditDate(format(new Date(promo.expiresAt), 'yyyy-MM-dd'));
                                                                } else {
                                                                    setEditDate('');
                                                                }
                                                            }}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="media" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                            {mediaLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Loading media...</p>
                                </div>
                            ) : hasMedia ? (
                                <div className="space-y-6">
                                    {/* Reference Images */}
                                    {mediaData.referenceImages.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-3">
                                                <ImageIcon className="w-3 h-3" /> Reference Images
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {mediaData.referenceImages.map((img, index) => (
                                                    <button
                                                        key={`ref-${index}`}
                                                        onClick={() => setSelectedImage(img.url)}
                                                        className="aspect-square rounded-lg overflow-hidden bg-muted/30 border border-white/5 hover:border-primary/50 transition-colors"
                                                    >
                                                        <img
                                                            src={getAssetUrl(img.url)}
                                                            alt={`Reference ${index + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Body Placement Images */}
                                    {mediaData.bodyPlacementImages.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-3">
                                                <Camera className="w-3 h-3" /> Body Placement Photos
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {mediaData.bodyPlacementImages.map((img, index) => (
                                                    <button
                                                        key={`body-${index}`}
                                                        onClick={() => setSelectedImage(img.url)}
                                                        className="aspect-square rounded-lg overflow-hidden bg-muted/30 border border-white/5 hover:border-primary/50 transition-colors"
                                                    >
                                                        <img
                                                            src={getAssetUrl(img.url)}
                                                            alt={`Body placement ${index + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-50">
                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                        <ImageIcon className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-medium">No shared media</p>
                                    <p className="text-xs text-muted-foreground">
                                        Images uploaded through the consultation funnel will appear here
                                    </p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="history">
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-50">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                    <User className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-medium">No booking history</p>
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </SheetShell>

            {/* Image Lightbox - Portal to body to ensure it's above all sheets */}
            {selectedImage && createPortal(
                <div
                    className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/70 hover:text-white text-sm px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm z-10"
                        onClick={() => setSelectedImage(null)}
                    >
                        Close
                    </button>
                    <img
                        src={getAssetUrl(selectedImage)}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>,
                document.body
            )}
        </>
    );
}
