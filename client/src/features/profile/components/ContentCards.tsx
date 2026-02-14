import { format } from "date-fns";
import { Bookmark, Clock, Grid, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui";

// ============================================================================
// Photos Card
// ============================================================================

export function PhotosCard({ photos, isEditMode }: { photos: any[], isEditMode: boolean }) {
    return (
        <div className="h-full">
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

// ============================================================================
// Upcoming Card
// ============================================================================

export function UpcomingCard({ upcoming }: { upcoming: any[] }) {
    return (
        <div className="h-full">
            {upcoming?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground opacity-50">
                    <Clock className="w-10 h-10 mb-4" />
                    <p>No upcoming sittings</p>
                </div>
            ) : (
                <div className="space-y-4 px-1">
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

// ============================================================================
// Forms Card
// ============================================================================

import { FileText, Check, AlertCircle } from "lucide-react";

export function FormsCard({ forms }: { forms: any[] }) {
    // Mock upcoming forms if none exist, just for UI demo in this phase since we don't have form assignment logic yet
    const displayForms = forms;

    return (
        <div className="h-full">
            {displayForms?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground opacity-50">
                    <FileText className="w-10 h-10 mb-4" />
                    <p>No forms on file</p>
                </div>
            ) : (
                <div className="space-y-3 px-1">
                    {displayForms?.map((form) => (
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
                            {form.status !== 'signed' && (
                                <Button size="sm" variant="ghost" className="shrink-0 text-xs">
                                    Sign
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function HistoryCard({ history }: { history: any[] }) {
    return (
        <div className="h-full">
            {history?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground opacity-50">
                    <Clock className="w-10 h-10 mb-4" />
                    <p>No history yet</p>
                </div>
            ) : (
                <div className="space-y-0 relative border-l border-white/10 ml-3 pl-6 py-2">
                    {history?.map((item) => (
                        <div key={item.id} className="relative mb-8 last:mb-0">
                            <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
                                    {format(new Date(item.date), 'MMM d, yyyy')}
                                </span>
                                <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                                <p className="text-xs text-muted-foreground/80 mt-0.5">{item.description}</p>
                                <span className="inline-flex mt-2 text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-muted-foreground w-fit capitalize">
                                    {item.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
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
