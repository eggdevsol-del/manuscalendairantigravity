import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo } from "react";

export interface InboxRequest {
    type: 'lead' | 'consultation';
    id: number;
    leadId: number | null;
    name: string;
    subject: string;
    description: string | null;
    date: string | null;
    data: any;
}

/**
 * Hook to fetch and merge all types of inbox requests (Leads, Consultations)
 * Centralizes deduction and sorting logic (SSOT)
 */
export function useInboxRequests() {
    const { user } = useAuth();
    const isArtist = user?.role === 'artist' || user?.role === 'admin';

    // 1. Fetch Leads
    const { data: leadsData, isLoading: leadsLoading } = trpc.funnel.getLeads.useQuery(
        { status: 'new', limit: 50, offset: 0 },
        {
            enabled: !!user && isArtist,
            refetchInterval: 10000,
        }
    );

    // 2. Fetch Pending Consultations
    const { data: consultationsData, isLoading: consultationsLoading } = trpc.consultations.list.useQuery(
        { status: 'pending' },
        {
            enabled: !!user && isArtist,
            refetchInterval: 10000,
        }
    );

    // 3. Centralized Derivation (SSOT)
    const requestItems = useMemo(() => {
        const items: InboxRequest[] = [];

        // Add leads
        if (leadsData?.leads) {
            leadsData.leads.forEach(lead => {
                const l = lead as any;
                items.push({
                    type: 'lead',
                    id: l.id,
                    leadId: l.id,
                    name: l.clientName || 'Unknown Client',
                    subject: l.projectType?.replace(/-/g, ' ') || 'New consultation',
                    description: l.projectDescription || null,
                    date: l.createdAt || null,
                    data: l
                });
            });
        }

        // Add consultations (deduplicated)
        if (consultationsData) {
            consultationsData.forEach((consult: any) => {
                // SSOT: Only show unviewed consultations in the "New Requests" list
                // Viewed consultations will appear in the main conversation list
                if (consult.viewed) return;

                // Check if any lead already in items points to this consultation
                const isDuplicate = items.some(item => item.type === 'lead' && (item.data as any).consultationId === consult.id);

                if (!isDuplicate) {
                    items.push({
                        type: 'consultation',
                        id: consult.id,
                        leadId: consult.leadId || null,
                        name: consult.client?.name || 'Unknown Client',
                        subject: consult.subject || 'Consultation Request',
                        description: consult.description || null,
                        date: consult.createdAt || null,
                        data: consult
                    });
                }
            });
        }

        // Sort by date (newest first)
        return items.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });
    }, [leadsData, consultationsData]);

    const value = useMemo(() => ({
        requestItems,
        isLoading: leadsLoading || consultationsLoading,
        isArtist
    }), [requestItems, leadsLoading, consultationsLoading, isArtist]);

    return value;
}
