import React from "react";
import { ModalShell } from "@/components/ui/overlays/modal-shell";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import InstallPrompt from "@/components/InstallPrompt";

interface InstallAppModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function InstallAppModal({ isOpen, onClose }: InstallAppModalProps) {
    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            title="Install App"
            description="Unlock the full experience"
            overlayName="Install App"
            overlayId="teaser.install_app"
            footer={
                <div className="flex flex-col gap-3 w-full">
                    {/* Install Button Logic */}
                    <div className="w-full">
                        <Button
                            className={cn("w-full", tokens.button.hero)}
                            onClick={async () => {
                                const { setupInstallPrompt } = await import("@/lib/pwa");
                                const handler = setupInstallPrompt();
                                if (handler.isAvailable()) {
                                    handler.showPrompt();
                                    onClose();
                                } else {
                                    alert("To install: Tap 'Share' -> 'Add to Home Screen'");
                                }
                            }}
                        >
                            Install Now
                        </Button>
                    </div>
                    {/* Fallback visual if system prompt not available (handled by InstallPrompt usually, but we add custom instruction here if needed) */}

                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className={tokens.button.secondary}
                    >
                        Not now
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-6">
                <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary to-primary/50 shadow-2xl flex items-center justify-center">
                    <Download className="w-10 h-10 text-white" />
                </div>

                <div className="space-y-2">
                    <h3 className="text-xl font-bold">Unlock {tokens.header.contextTitle ? "Features" : "Features"}</h3>
                    <p className="text-muted-foreground max-w-[260px] mx-auto">
                        Install CalendAIr to access your dashboard, promotions, and manage your appointments.
                    </p>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 w-full border border-white/10 text-left space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <span className="text-green-500 text-xs">✓</span>
                        </div>
                        <span className="text-sm font-medium">Manage Appointments</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <span className="text-green-500 text-xs">✓</span>
                        </div>
                        <span className="text-sm font-medium">Access Promotions</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <span className="text-green-500 text-xs">✓</span>
                        </div>
                        <span className="text-sm font-medium">Instant Notifications</span>
                    </div>
                </div>
            </div>
        </ModalShell>
    );
}
