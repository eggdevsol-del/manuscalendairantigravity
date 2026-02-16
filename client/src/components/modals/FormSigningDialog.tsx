import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { SignaturePad } from "../ui/SignaturePad";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";

interface FormSigningDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSign: (signature: string) => void;
    formTitle: string;
    formContent: string;
    isSigning: boolean;
}

export function FormSigningDialog({
    isOpen,
    onClose,
    onSign,
    formTitle,
    formContent,
    isSigning
}: FormSigningDialogProps) {
    const [step, setStep] = useState<'content' | 'signature'>('content');

    const handleSign = (signature: string) => {
        onSign(signature);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl p-0 overflow-hidden bg-slate-950 border-white/10 h-[90vh] flex flex-col">
                <DialogHeader className="p-6 border-b border-white/10 shrink-0">
                    <DialogTitle className="text-xl font-bold">{formTitle}</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm">
                        {step === 'content'
                            ? "Please review the document below before signing."
                            : "Provide your digital signature below."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 relative">
                    {step === 'content' ? (
                        <div className="h-full flex flex-col">
                            <ScrollArea className="flex-1 p-6">
                                <div className="prose prose-invert prose-sm max-w-none text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                    {formContent}
                                </div>
                            </ScrollArea>
                            <div className="p-6 border-t border-white/10 bg-black/20 shrink-0">
                                <Button
                                    className="w-full h-12 shadow-lg shadow-primary/20"
                                    onClick={() => setStep('signature')}
                                >
                                    Proceed to Signature
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full p-6 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex-1 flex flex-col justify-center">
                                <Label className="block mb-4 text-center font-medium opacity-70 uppercase tracking-widest text-xs">
                                    Sign Here (Physical Finger Signature)
                                </Label>
                                <SignaturePad
                                    onSave={handleSign}
                                    onCancel={() => setStep('content')}
                                />
                                {isSigning && (
                                    <div className="mt-4 flex items-center justify-center gap-2 text-primary animate-pulse">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                        <span className="text-sm font-medium">Processing signature...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

import { Label } from "@/components/ui/label";
