import { trpc } from "@/lib/trpc";
import { Button, Card } from "@/components/ui";
import { PageHeader, PageShell } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { Check, X, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function ArtistInvitations({ onBack }: { onBack: () => void }) {
    const { data: invites, refetch } = trpc.studios.getPendingInvites.useQuery();
    const respondMutation = trpc.studios.respondToInvite.useMutation({
        onSuccess: () => {
            refetch();
            toast.success("Invitation response recorded.");
        },
        onError: (err) => {
            toast.error(err.message);
        }
    });

    return (
        <PageShell>
            <PageHeader title="Studio Invitations" onBack={onBack} />
            <div className={tokens.contentContainer.base}>
                <div className="flex-1 w-full h-full px-4 pt-6 overflow-y-auto">
                    <div className="pb-32 max-w-lg mx-auto space-y-4">
                        {invites?.length === 0 && (
                            <p className="text-center text-muted-foreground mt-10">No pending invitations.</p>
                        )}
                        {invites?.map((invite) => (
                            <Card key={invite.id} className="p-4 bg-white/5 border-white/10">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/5 flex-shrink-0">
                                        {invite.studio.logoUrl ? (
                                            <img src={invite.studio.logoUrl} alt={invite.studio.name || "Studio"} className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                            <Building2 className="w-6 h-6 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-foreground">{invite.studio.name}</h3>
                                        <p className="text-sm text-muted-foreground mb-3">Invited you to join as a <span className="font-medium text-primary">{invite.role}</span></p>
                                        <div className="flex gap-2">
                                            <Button
                                                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                                                disabled={respondMutation.isPending}
                                                onClick={() => respondMutation.mutate({ inviteId: invite.id, response: 'accept' })}
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                Accept
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="flex-1 hover:bg-red-500/10 hover:text-red-400 border-white/10"
                                                disabled={respondMutation.isPending}
                                                onClick={() => respondMutation.mutate({ inviteId: invite.id, response: 'decline' })}
                                            >
                                                <X className="w-4 h-4 mr-2" />
                                                Decline
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
