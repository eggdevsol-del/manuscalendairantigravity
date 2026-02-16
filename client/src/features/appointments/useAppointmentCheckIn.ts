/**
 * useAppointmentCheckIn — monitors upcoming appointments and triggers check-in/out modals.
 * 
 * Polls user's appointments every 30s. When the current time falls within ±15 minutes
 * of an appointment's start or end time, surfaces that appointment for the modal flow.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export type CheckInPhase = 'arrival' | 'completion' | null;

export interface ActiveCheckIn {
    appointment: any;
    phase: CheckInPhase;
}

export function useAppointmentCheckIn() {
    const { data: appointments } = trpc.appointments.list.useQuery(
        {
            startDate: new Date(new Date().setHours(0, 0, 0, 0)),
            endDate: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        {
            refetchInterval: 30_000, // Poll every 30s
            placeholderData: (prev) => prev,
        }
    );

    const activeCheckIn = useMemo<ActiveCheckIn | null>(() => {
        if (!appointments || appointments.length === 0) return null;
        const now = new Date();
        const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

        for (const appt of appointments) {
            if (appt.status === 'cancelled') continue;

            const start = new Date(appt.startTime);
            const end = new Date(appt.endTime);

            // Check arrival window: ±15 min of start time, client not yet arrived
            if (!appt.clientArrived) {
                const diff = Math.abs(now.getTime() - start.getTime());
                if (diff <= WINDOW_MS) {
                    return { appointment: appt, phase: 'arrival' };
                }
            }

            // Check completion window: ±15 min of end time, client arrived but not yet completed
            if (appt.clientArrived && appt.status !== 'completed') {
                const diff = Math.abs(now.getTime() - end.getTime());
                if (diff <= WINDOW_MS) {
                    return { appointment: appt, phase: 'completion' };
                }
            }
        }

        return null;
    }, [appointments]);

    const utils = trpc.useContext();

    const updateAppointment = trpc.appointments.update.useMutation({
        onSuccess: () => {
            utils.appointments.list.invalidate();
        },
    });

    return {
        activeCheckIn,
        appointments: appointments || [],
        updateAppointment,
    };
}
