import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { toast } from "sonner";
import { useBottomNav } from "@/contexts/BottomNavContext";

interface InlineFormSigningProps {
    pendingForms: any[];
    onSuccess?: () => void;
    onClose?: () => void;
    initialForm?: any;
}

export function InlineFormSigning({ pendingForms, onSuccess, onClose, initialForm }: InlineFormSigningProps) {
    const fab = tokens.fab;
    const card = tokens.card;
    const { setLargePanel } = useBottomNav();

    const [activeForm, setActiveForm] = useState<any>(initialForm || pendingForms[0]);
    const [isSigningPhysical, setIsSigningPhysical] = useState(false);

    const { data: user } = trpc.auth.me.useQuery();
    const updateProfileMutation = trpc.auth.updateProfile.useMutation();

    // Side effect to manage FAB panel size
    useEffect(() => {
        setLargePanel(true);
        return () => setLargePanel(false);
    }, [setLargePanel]);

    const signFormMutation = trpc.forms.signForm.useMutation({
        onSuccess: () => {
            toast.success("Form signed successfully");
            onSuccess?.();

            // Check if there are more forms to sign
            const currentIndex = pendingForms.findIndex(f => f.id === activeForm.id);
            const nextForm = pendingForms[currentIndex + 1];

            if (nextForm) {
                setActiveForm(nextForm);
                setIsSigningPhysical(false);
            } else {
                setActiveForm(null);
                onClose?.();
            }
        },
        onError: (err) => toast.error("Failed to sign form: " + err.message)
    });

    const handleSign = async (signature: string) => {
        try {
            if (!user?.savedSignature) {
                await updateProfileMutation.mutateAsync({ savedSignature: signature } as any);
            }
            await signFormMutation.mutateAsync({
                formId: activeForm.id,
                signature
            });
        } catch (err: any) {
            toast.error("Failed to sign: " + err.message);
        }
    };

    if (!activeForm) return null;

    return (
        <div className="flex flex-col w-full h-full pt-2 pb-6 px-1">
            <motion.div variants={fab.animation.item} className={fab.itemRow}>
                <button
                    onClick={() => {
                        if (isSigningPhysical) setIsSigningPhysical(false);
                        else {
                            setActiveForm(null);
                            onClose?.();
                        }
                    }}
                    className={fab.itemButton}
                >
                    <ArrowLeft className={fab.itemIconSize} />
                </button>
                <span className={cn(fab.itemLabel, "uppercase tracking-widest font-bold flex-1 truncate pr-2")}>
                    {activeForm.title}
                </span>
            </motion.div>

            <div className="flex flex-col flex-1 mt-4 px-1 gap-4 overflow-hidden">
                {!isSigningPhysical ? (
                    <motion.div variants={fab.animation.item} className="flex flex-col flex-1 min-h-0">
                        <ScrollArea className={cn(card.base, card.bg, "flex-1 overflow-auto rounded-[4px] p-4 border-white/5")}>
                            <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap text-[10px]">
                                {activeForm.content}
                            </div>
                        </ScrollArea>
                        <button
                            onClick={() => setIsSigningPhysical(true)}
                            className="w-full mt-3 py-3 rounded-[4px] text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                        >
                            Proceed to Signature
                        </button>
                    </motion.div>
                ) : (
                    <motion.div variants={fab.animation.item} className="flex flex-col flex-1 min-h-0 gap-4">
                        <div className={cn(card.base, card.bg, "p-4 flex flex-col items-center justify-center gap-4 rounded-[4px] flex-1 overflow-hidden")}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                                {user?.savedSignature ? "Use Saved Signature or Draw New" : "Physical Signature Required"}
                            </p>

                            {user?.savedSignature ? (
                                <div className="w-full space-y-3 flex flex-col items-center">
                                    <div className="bg-white/5 rounded-[4px] border border-white/10 p-4 flex justify-center w-full">
                                        <img
                                            src={user.savedSignature}
                                            alt="Saved Signature"
                                            className="h-16 w-auto invert dark:invert-0 grayscale opacity-90"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleSign(user.savedSignature!)}
                                        disabled={signFormMutation.isPending}
                                        className="w-full py-2.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-primary text-primary-foreground flex items-center justify-center gap-2"
                                    >
                                        {signFormMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Sign with Saved Signature
                                    </button>

                                    <div className="relative flex py-1 items-center w-full">
                                        <div className="flex-grow border-t border-white/10"></div>
                                        <span className="flex-shrink-0 mx-4 text-muted-foreground text-[9px] uppercase tracking-widest font-bold">Or</span>
                                        <div className="flex-grow border-t border-white/10"></div>
                                    </div>

                                    <div className="w-full min-h-[140px] flex-1">
                                        <SignaturePad
                                            onSave={handleSign}
                                            className="w-full rounded-[4px] h-full"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full flex-1">
                                    <SignaturePad
                                        onSave={handleSign}
                                        className="w-full rounded-[4px] h-full"
                                    />
                                </div>
                            )}

                            {signFormMutation.isPending && !user?.savedSignature && (
                                <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest animate-pulse">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Saving Signature...
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
