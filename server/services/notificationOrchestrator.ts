import { eventBus } from "../_core/eventBus";
import { getDb } from "../services/core";
import { notificationOutbox } from "../../drizzle/schema";
import { InferInsertModel } from "drizzle-orm";

export class NotificationOrchestrator {
    constructor() {
        this.setupListeners();
    }

    private setupListeners() {
        // Subscribe to domain events
        eventBus.subscribe('message.created', this.handleMessageCreated.bind(this));
        eventBus.subscribe('appointment.confirmed', this.handleAppointmentConfirmed.bind(this));
        eventBus.subscribe('consultation.created', this.handleConsultationCreated.bind(this));
        eventBus.subscribe('proposal.accepted', this.handleProposalAccepted.bind(this));
    }

    private async handleMessageCreated(payload: any) {
        // Logic to clear unread counts or determine if notification needed
        // For now, simpler implementation: just queue a check or push

        // Example: Queue a push notification job
        await this.queueNotification('push_message', payload);
    }

    private async handleAppointmentConfirmed(payload: any) {
        await this.queueNotification('email_confirmation', payload);
        await this.queueNotification('push_message', payload);
    }

    private async handleConsultationCreated(payload: any) {
        await this.queueNotification('push_message', payload);
    }

    private async handleProposalAccepted(payload: any) {
        const pushPayload = {
            targetUserId: payload.clientId,
            title: "Booking Confirmed! 📝",
            body: "Your appointment is locked in. Please tap here to sign your required consent forms before you arrive.",
            url: "/profile?tab=forms",
            data: {
                type: "proposal_accepted",
                appointmentId: payload.appointmentId,
                conversationId: payload.conversationId
            }
        };

        await this.queueNotification('push_message', pushPayload);
    }

    private async queueNotification(type: string, payload: any) {
        const db = await getDb();
        if (!db) {
            console.error('[NotificationOrchestrator] DB not ready');
            return;
        }

        try {
            await db.insert(notificationOutbox).values({
                eventType: type,
                payloadJson: JSON.stringify(payload),
                status: 'pending'
            });
        } catch (e) {
            console.error('[NotificationOrchestrator] Failed to queue notification', e);
        }
    }
}

export const notificationOrchestrator = new NotificationOrchestrator();
