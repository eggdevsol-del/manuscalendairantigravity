import { format } from "date-fns";
import { Bookmark, Clock, Grid, Image as ImageIcon, Check, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FormSigningDialog } from "@/components/modals/FormSigningDialog";
import { useClientProfileController } from "../useClientProfileController";
import { toast } from "sonner";

// ============================================================================
// Photos Card
// ============================================================================

export function HistoryCard({ history }: { history: any[] }) {
    return (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1 pb-24">
            {history?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground opacity-50">
                    <Clock className="w-10 h-10 mb-4" />
                    <p>No history yet</p>
                </div>
            ) : (
                <div className="space-y-0 relative border-l border-white/10 ml-3 pl-6 py-2">
                    {history?.map((item) => {
                        const isLog = item.type === 'log';
                        const isForm = item.type === 'form';
                        const isAppt = item.type === 'appointment';

                        // Map actions to icons/colors
                        const getIcon = () => {
                            if (isForm) return <FileText className="w-3 h-3 text-orange-500" />;
                            if (isAppt) return <Check className="w-3 h-3 text-emerald-500" />;
                            switch (item.action) {
                                case 'created': return <Clock className="w-3 h-3 text-primary" />;
                                case 'rescheduled': return <Clock className="w-3 h-3 text-orange-400" />;
                                case 'cancelled': return <AlertCircle className="w-3 h-3 text-red-500" />;
                                case 'proposal_revoked': return <AlertCircle className="w-3 h-3 text-red-500" />;
                                case 'confirmed': return <Check className="w-3 h-3 text-emerald-500" />;
                                case 'completed': return <Check className="w-3 h-3 text-indigo-500" />;
                                default: return <Check className="w-3 h-3 text-muted-foreground" />;
                            }
                        };

                        const getStatusColor = () => {
                            if (isForm) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
                            if (isAppt) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
                            switch (item.action) {
                                case 'cancelled':
                                case 'proposal_revoked': return 'bg-red-500/10 text-red-500 border-red-500/20';
                                case 'rescheduled': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                                case 'confirmed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
                                case 'completed': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                                default: return 'bg-white/5 text-muted-foreground border-white/5';
                            }
                        };

                        return (
                            <div key={item.id} className="relative mb-8 last:mb-0">
                                <span className={cn(
                                    "absolute -left-[30px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background flex items-center justify-center bg-background border",
                                    !isLog && !isForm ? "border-emerald-500" : isForm ? "border-orange-500" : "border-white/20"
                                )}>
                                    <div className={cn("w-1.5 h-1.5 rounded-full", !isLog && !isForm ? "bg-emerald-500" : isForm ? "bg-orange-500" : "bg-muted-foreground")} />
                                </span>

                                <div className="flex flex-col">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                            {isLog && item.action === 'completed'
                                                ? format(new Date(item.date), 'MMM d, yyyy • h:mm a')
                                                : format(new Date(item.date), 'MMM d, yyyy')}
                                        </span>
                                        {isLog && (
                                            <span className="text-[10px] text-muted-foreground/60 italic">
                                                Audited Action
                                            </span>
                                        )}
                                        {isForm && (
                                            <span className="text-[10px] text-orange-500/80 italic">
                                                Legal Record
                                            </span>
                                        )}
                                    </div>
                                    <h4 className={cn("text-sm font-semibold flex items-center gap-2", isAppt ? "text-foreground" : "text-foreground/80")}>
                                        {item.title}
                                        {getIcon()}
                                    </h4>
                                    <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">{item.description}</p>

                                    <div className="mt-2 flex items-center gap-2">
                                        <span className={cn(
                                            "inline-flex text-[9px] px-2 py-0.5 rounded-full border capitalize font-bold tracking-tight",
                                            getStatusColor()
                                        )}>
                                            {isLog && item.action ? item.action.replace('_', ' ') : item.status || 'Signed'}
                                        </span>
                                        {isAppt && item.price > 0 && (
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                ${item.price} Total
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function UpcomingCard({ upcoming }: { upcoming: any[] }) {
    return (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1 pb-24">
            {upcoming?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground opacity-50">
                    <Clock className="w-10 h-10 mb-4" />
                    <p>No upcoming sittings</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {upcoming?.map((item) => {
                        const date = new Date(item.date);
                        const now = new Date();
                        const daysAway = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                        return (
                            <div key={item.id} className="relative p-4 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                                {daysAway <= 5 && (
                                    <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-bl-xl">
                                        In {daysAway} days
                                    </div>
                                )}
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-primary font-bold uppercase tracking-wider">
                                        {format(date, 'MMM d, yyyy • h:mm a')}
                                    </span>
                                    <h4 className="text-lg font-bold text-foreground">{item.title}</h4>
                                    <p className="text-sm text-muted-foreground">{item.serviceName}</p>

                                    <div className="mt-4 flex items-center gap-3">
                                        {item.depositAmount > 0 && (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Deposit</span>
                                                <span className="text-xs font-medium text-foreground">${item.depositAmount}</span>
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Price Estimate</span>
                                            <span className="text-xs font-medium text-foreground">${item.price}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function PhotosCard({ photos, isEditMode }: { photos: any[], isEditMode: boolean }) {
    return (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1 pb-24">
            {photos?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground opacity-50">
                    <Grid className="w-10 h-10 mb-4" />
                    <p>No photos yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-1">
                    {/* Add Photo Button in Grid (Edit Mode Only?) */}
                    {isEditMode && (
                        <div className="aspect-square bg-muted/20 flex flex-col items-center justify-center text-muted-foreground">
                            <span className="text-xs">Add</span>
                        </div>
                    )}

                    {photos?.map(photo => (
                        <div key={photo.id} className="aspect-square relative overflow-hidden bg-muted rounded-md group">
                            <img src={photo.url} alt="User upload" className="w-full h-full object-cover" loading="lazy" />
                            {isEditMode && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    {/* Delete action */}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function FormsCard({ forms }: { forms: any[] }) {
    const { signForm } = useClientProfileController();
    const [signingForm, setSigningForm] = useState<any>(null);

    const handleSign = async (signature: string) => {
        if (!signingForm) return;
        try {
            await signForm.mutateAsync({
                formId: signingForm.id,
                signature
            });
            toast.success("Form signed successfully");
            setSigningForm(null);
        } catch (err) {
            toast.error("Failed to sign form");
        }
    };

    return (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1 pb-24">
            {forms?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground opacity-50">
                    <FileText className="w-10 h-10 mb-4" />
                    <p>No forms on file</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {forms?.map((form) => (
                        <div key={form.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${form.status === 'signed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'
                                }`}>
                                {form.status === 'signed' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-foreground truncate">{form.title}</h4>
                                <p className="text-xs text-muted-foreground">
                                    {form.status === 'signed'
                                        ? `Signed ${format(new Date(form.signedAt || form.updatedAt), 'MMM d, yyyy')}`
                                        : 'Pending signature'}
                                </p>
                            </div>
                            {form.status !== 'signed' ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0 text-xs border-orange-500/20 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                                    onClick={() => setSigningForm(form)}
                                >
                                    Sign Now
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="shrink-0 text-xs hover:bg-white/5 opacity-60 hover:opacity-100"
                                    onClick={() => setSigningForm(form)}
                                >
                                    View
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {signingForm && (
                <FormSigningDialog
                    isOpen={!!signingForm}
                    onClose={() => setSigningForm(null)}
                    onSign={handleSign}
                    formTitle={signingForm.title}
                    formContent={signingForm.content}
                    isSigning={signForm.isPending}
                    signature={signingForm.signature}
                    viewOnly={signingForm.status === 'signed'}
                />
            )}
        </div>
    );
}

// ============================================================================
// Saved Card
// ============================================================================

export function SavedCard() {
    return (
        <div className="h-full flex flex-col items-center justify-center py-20 text-center text-muted-foreground opacity-50">
            <Bookmark className="w-12 h-12 mb-4" />
            <p className="text-sm max-w-[200px]">Save posts and flashes to view them here.</p>
        </div>
    );
}
