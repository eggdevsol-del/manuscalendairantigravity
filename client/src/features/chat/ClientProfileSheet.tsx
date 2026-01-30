import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Mail, Phone, Cake, BadgeCheck, Image as ImageIcon, Camera, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { createPortal } from "react-dom";

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

    // Fetch client media from leads
    const { data: mediaData, isLoading: mediaLoading } = trpc.conversations.getClientMedia.useQuery(
        { clientId: client?.id || '' },
        {
            enabled: isOpen && !!client?.id,
            staleTime: 30000, // Cache for 30 seconds
        }
    );

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
                            <img src={client.avatar} alt={client.name || "Client"} className="w-full h-full object-cover" />
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
                    <TabsList className="grid w-full grid-cols-3 bg-muted/20 p-1 rounded-xl">
                        <TabsTrigger value="info" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-lg">Info</TabsTrigger>
                        <TabsTrigger value="media" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-lg">
                            Media {hasMedia && <span className="ml-1 text-xs opacity-70">({mediaData.totalCount})</span>}
                        </TabsTrigger>
                        <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-lg">History</TabsTrigger>
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
                            </div>
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
                                                            src={img.url}
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
                                                            src={img.url}
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
                        src={selectedImage}
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
