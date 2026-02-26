import { relations } from "drizzle-orm/relations";
import {
  users,
  appointments,
  conversations,
  artistSettings,
  clientContent,
  clientNotes,
  consultations,
  messages,
  notificationSettings,
  notificationTemplates,
  policies,
  pushSubscriptions,
  quickActionButtons,
  socialMessageSync,
} from "./schema";

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  user_artistId: one(users, {
    fields: [appointments.artistId],
    references: [users.id],
    relationName: "appointments_artistId_users_id",
  }),
  user_clientId: one(users, {
    fields: [appointments.clientId],
    references: [users.id],
    relationName: "appointments_clientId_users_id",
  }),
  conversation: one(conversations, {
    fields: [appointments.conversationId],
    references: [conversations.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  appointments_artistId: many(appointments, {
    relationName: "appointments_artistId_users_id",
  }),
  appointments_clientId: many(appointments, {
    relationName: "appointments_clientId_users_id",
  }),
  artistSettings: many(artistSettings),
  clientContents_artistId: many(clientContent, {
    relationName: "clientContent_artistId_users_id",
  }),
  clientContents_clientId: many(clientContent, {
    relationName: "clientContent_clientId_users_id",
  }),
  clientNotes_artistId: many(clientNotes, {
    relationName: "clientNotes_artistId_users_id",
  }),
  clientNotes_clientId: many(clientNotes, {
    relationName: "clientNotes_clientId_users_id",
  }),
  consultations_artistId: many(consultations, {
    relationName: "consultations_artistId_users_id",
  }),
  consultations_clientId: many(consultations, {
    relationName: "consultations_clientId_users_id",
  }),
  conversations_artistId: many(conversations, {
    relationName: "conversations_artistId_users_id",
  }),
  conversations_clientId: many(conversations, {
    relationName: "conversations_clientId_users_id",
  }),
  messages: many(messages),
  notificationSettings: many(notificationSettings),
  notificationTemplates: many(notificationTemplates),
  policies: many(policies),
  pushSubscriptions: many(pushSubscriptions),
  quickActionButtons: many(quickActionButtons),
  socialMessageSyncs: many(socialMessageSync),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    appointments: many(appointments),
    consultations: many(consultations),
    user_artistId: one(users, {
      fields: [conversations.artistId],
      references: [users.id],
      relationName: "conversations_artistId_users_id",
    }),
    user_clientId: one(users, {
      fields: [conversations.clientId],
      references: [users.id],
      relationName: "conversations_clientId_users_id",
    }),
    messages: many(messages),
  })
);

export const artistSettingsRelations = relations(artistSettings, ({ one }) => ({
  user: one(users, {
    fields: [artistSettings.userId],
    references: [users.id],
  }),
}));

export const clientContentRelations = relations(clientContent, ({ one }) => ({
  user_artistId: one(users, {
    fields: [clientContent.artistId],
    references: [users.id],
    relationName: "clientContent_artistId_users_id",
  }),
  user_clientId: one(users, {
    fields: [clientContent.clientId],
    references: [users.id],
    relationName: "clientContent_clientId_users_id",
  }),
}));

export const clientNotesRelations = relations(clientNotes, ({ one }) => ({
  user_artistId: one(users, {
    fields: [clientNotes.artistId],
    references: [users.id],
    relationName: "clientNotes_artistId_users_id",
  }),
  user_clientId: one(users, {
    fields: [clientNotes.clientId],
    references: [users.id],
    relationName: "clientNotes_clientId_users_id",
  }),
}));

export const consultationsRelations = relations(consultations, ({ one }) => ({
  user_artistId: one(users, {
    fields: [consultations.artistId],
    references: [users.id],
    relationName: "consultations_artistId_users_id",
  }),
  user_clientId: one(users, {
    fields: [consultations.clientId],
    references: [users.id],
    relationName: "consultations_clientId_users_id",
  }),
  conversation: one(conversations, {
    fields: [consultations.conversationId],
    references: [conversations.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const notificationSettingsRelations = relations(
  notificationSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationSettings.userId],
      references: [users.id],
    }),
  })
);

export const notificationTemplatesRelations = relations(
  notificationTemplates,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationTemplates.userId],
      references: [users.id],
    }),
  })
);

export const policiesRelations = relations(policies, ({ one }) => ({
  user: one(users, {
    fields: [policies.artistId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
);

export const quickActionButtonsRelations = relations(
  quickActionButtons,
  ({ one }) => ({
    user: one(users, {
      fields: [quickActionButtons.userId],
      references: [users.id],
    }),
  })
);

export const socialMessageSyncRelations = relations(
  socialMessageSync,
  ({ one }) => ({
    user: one(users, {
      fields: [socialMessageSync.artistId],
      references: [users.id],
    }),
  })
);
