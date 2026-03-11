import React, { useState, useEffect } from "react";
import Joyride, { Step, CallBackProps, STATUS } from "react-joyride";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export function AppTour() {
    const { user } = useAuth();
    const [location] = useLocation();
    const updateOnboardingMutation = trpc.auth.completeOnboarding.useMutation();
    const [run, setRun] = useState(false);

    // Only run tour for users who haven't completed onboarding yet on the Calendar
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Give the DOM a tiny fraction of a second to render the layout before starting the tour
        if (user && user.hasCompletedOnboarding === 0 && location === "/calendar") {
            const timer = setTimeout(() => {
                setRun(true);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [user, location]);

    if (!user || user.hasCompletedOnboarding !== 0) {
        return null; // Don't mount at all if they are already onboarded
    }

    const isClient = user.role === "client";

    const artistSteps: Step[] = [
        {
            target: "body", // Central fallback for a welcome message
            content: (
                <div className="space-y-2 text-left">
                    <h3 className="text-lg font-bold text-foreground">Welcome to CalendAIr</h3>
                    <p className="text-sm text-foreground/80">
                        Let's take a quick 3-step tour of your new command center.
                    </p>
                </div>
            ),
            placement: "center",
            disableBeacon: true,
        },
        {
            target: ".calendar-view-container", // We need to ensure we add this class to Calendar.tsx
            content: "This is your active schedule. Tap any day to block out time or view appointments.",
            placement: "bottom",
        },
        {
            target: ".nav-fab-button", // We will add this to the central FAB
            content: "This is your engine. Click this golden plus button to add an Event, process a Consultation, or access Settings.",
            placement: "top",
        },
        {
            target: ".nav-tab-conversations", // We will add this ID to the Conversations tab
            content: "When clients request bookings via your link, they arrive here in your Inbox.",
            placement: "top",
        },
        {
            target: ".dashboard-setup-widget", // We will add this ID to the setup widget on the dashboard
            content: (
                <div className="space-y-2 text-left">
                    <h3 className="text-lg font-bold text-foreground">Studio Setup</h3>
                    <p className="text-sm text-foreground/80">
                        You're all set! Now, click through this checklist to finish configuring your services and work hours.
                    </p>
                </div>
            ),
            placement: "bottom",
        }
    ];

    const clientSteps: Step[] = [
        {
            target: "body", 
            content: (
                <div className="space-y-2 text-left">
                    <h3 className="text-lg font-bold text-foreground">Welcome to CalendAIr</h3>
                    <p className="text-sm text-foreground/80">
                        Here is a quick tour of how to track your upcoming tattoos.
                    </p>
                </div>
            ),
            placement: "center",
            disableBeacon: true,
        },
        {
            target: ".nav-tab-conversations", 
            content: "Your Inbox is where you can chat with your artists and review design proposals.",
            placement: "top",
        },
        {
            target: ".nav-fab-button", 
            content: "Use the central menu to update your Profile or review your Past Bookings.",
            placement: "top",
        }
    ];

    const steps = isClient ? clientSteps : artistSteps;

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);
            
            // For Clients, finishing the tour is the end of their required setup map.
            // We can safely mark them as fully onboarded.
            // Artists DO NOT complete here; they must finish the Setup Checklist widget.
            if (isClient) {
                try {
                    await updateOnboardingMutation.mutateAsync();
                } catch (e) {
                    console.error("Failed to complete client onboarding", e);
                }
            }
        }
    };

    return (
        <Joyride
            callback={handleJoyrideCallback}
            continuous
            hideCloseButton
            run={run}
            scrollToFirstStep
            showProgress
            showSkipButton
            steps={steps}
            styles={{
                options: {
                    zIndex: 10000,
                    primaryColor: '#E09F3E', // The Golden Amber
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    arrowColor: 'rgba(20, 20, 20, 0.95)',
                    textColor: '#ffffff',
                    overlayColor: 'rgba(0, 0, 0, 0.65)',
                },
                tooltipContainer: {
                    textAlign: "left",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.1)",
                },
                buttonNext: {
                    borderRadius: "6px",
                    backgroundColor: '#E09F3E',
                    padding: "8px 16px",
                    fontWeight: "bold",
                },
                buttonSkip: {
                    color: "rgba(255,255,255,0.5)",
                }
            }}
        />
    );
}
