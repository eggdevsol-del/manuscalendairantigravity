import { mysqlTable, mysqlSchema, AnyMySqlColumn, primaryKey, int, varchar, text, datetime, mysqlEnum, timestamp, index, longtext, unique, tinyint, decimal } from "drizzle-orm/mysql-core"
import { sql, type InferSelectModel, type InferInsertModel, relations } from "drizzle-orm"

export const appointments = mysqlTable("appointments", {
	id: int().primaryKey().autoincrement(),
	conversationId: int().notNull().references(() => conversations.id, { onDelete: "cascade" }),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	startTime: datetime({ mode: 'string' }).notNull(),
	endTime: datetime({ mode: 'string' }).notNull(),
	timeZone: varchar({ length: 64 }).notNull().default('Australia/Brisbane'),
	status: mysqlEnum(['pending', 'confirmed', 'cancelled', 'completed']).default('pending').notNull(),
	serviceName: varchar({ length: 255 }),
	price: int(),
	depositAmount: int(),
	depositPaid: tinyint().default(0),
	paymentProof: text(),
	confirmationSent: tinyint().default(0),
	reminderSent: tinyint().default(0),
	followUpSent: tinyint().default(0),
	actualStartTime: datetime({ mode: 'string' }),
	actualEndTime: datetime({ mode: 'string' }),
	clientArrived: tinyint().default(0),
	clientPaid: tinyint().default(0),
	amountPaid: int(),
	paymentMethod: mysqlEnum('payment_method', ['stripe', 'paypal', 'bank', 'cash']),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
	]);

export const appointmentLogs = mysqlTable("appointment_logs", {
	id: int().primaryKey().autoincrement(),
	appointmentId: int().notNull().references(() => appointments.id, { onDelete: "cascade" }),
	action: mysqlEnum(['created', 'rescheduled', 'cancelled', 'completed', 'proposal_revoked']).notNull(),
	oldValue: text(), // JSON
	newValue: text(), // JSON
	performedBy: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("log_appt_idx").on(table.appointmentId),
]);

export const artistSettings = mysqlTable("artistSettings", {
	id: int().primaryKey().autoincrement(),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	businessName: text(),
	businessAddress: text(),
	businessEmail: varchar({ length: 320 }),
	bsb: varchar({ length: 10 }),
	accountNumber: varchar({ length: 20 }),
	depositAmount: int(),
	workSchedule: text().notNull(),
	services: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	autoSendDepositInfo: tinyint().default(0),
	// Funnel settings (SSOT for booking link)
	publicSlug: varchar({ length: 50 }),
	funnelEnabled: tinyint().default(0),
	funnelWelcomeMessage: text(),
	styleOptions: text(), // JSON array of style options
	placementOptions: text(), // JSON array of placement options
	budgetRanges: text(), // JSON array of budget range objects
},
	(table) => [
		unique("artistSettings_publicSlug_unique").on(table.publicSlug),
	]);

export const clientContent = mysqlTable("client_content", {
	id: int().primaryKey().autoincrement(),
	clientId: varchar("client_id", { length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	artistId: varchar("artist_id", { length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	fileKey: varchar("file_key", { length: 255 }).notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileType: mysqlEnum("file_type", ['image', 'video']).notNull(),
	mimeType: varchar("mime_type", { length: 100 }).notNull(),
	fileSize: int("file_size").notNull(),
	title: varchar({ length: 255 }),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow(),
},
	(table) => [
		index("artist_id").on(table.artistId),
		index("idx_client_artist").on(table.clientId, table.artistId),
		index("idx_file_key").on(table.fileKey),
	]);

export const clientNotes = mysqlTable("client_notes", {
	id: varchar({ length: 255 }).primaryKey(),
	artistId: varchar("artist_id", { length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar("client_id", { length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	note: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow(),
},
	(table) => [
		index("client_id").on(table.clientId),
		index("idx_artist_client").on(table.artistId, table.clientId),
	]);

export const consultations = mysqlTable("consultations", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	conversationId: int().references(() => conversations.id, { onDelete: "cascade" }),
	subject: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	preferredDate: datetime({ mode: 'string' }),
	status: mysqlEnum(['pending', 'responded', 'scheduled', 'completed', 'cancelled', 'archived']).default('pending').notNull(),
	leadId: int(),
	viewed: tinyint().default(0),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
	]);

export const conversations = mysqlTable("conversations", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	leadId: int(),
	pinnedConsultationId: int(), // Breaking circular reference for now
	lastMessageAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		index("conv_artist_idx").on(table.artistId),
		index("conv_client_idx").on(table.clientId),
	]);

export const fileStorage = mysqlTable("file_storage", {
	fileKey: varchar("file_key", { length: 255 }).primaryKey(),
	fileData: longtext("file_data").notNull(),
	mimeType: varchar("mime_type", { length: 100 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
},
	(table) => [
	]);

export const messages = mysqlTable("messages", {
	id: int().primaryKey().autoincrement(),
	conversationId: int().notNull().references(() => conversations.id, { onDelete: "cascade" }),
	senderId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	content: text().notNull(),
	messageType: mysqlEnum(['text', 'system', 'appointment_request', 'appointment_confirmed', 'image', 'video']).default('text').notNull(),
	metadata: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	readBy: text(),
},
	(table) => [
		index("msg_conversation_idx").on(table.conversationId),
	]);

export const notificationSettings = mysqlTable("notificationSettings", {
	id: int().primaryKey().autoincrement(),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	followupEnabled: tinyint().default(0),
	followupSms: tinyint().default(0),
	followupEmail: tinyint().default(0),
	followupPush: tinyint().default(0),
	followupText: text(),
	followupTriggerType: varchar({ length: 50 }).default('days'),
	followupTriggerValue: int().default(1),
	aftercareEnabled: tinyint().default(0),
	aftercareSms: tinyint().default(0),
	aftercareEmail: tinyint().default(0),
	aftercarePush: tinyint().default(0),
	aftercareDailyMessage: text(),
	aftercarePostMessage: text(),
	aftercareFrequency: varchar({ length: 50 }).default('daily'),
	aftercareDurationDays: int().default(14),
	aftercareTime: varchar({ length: 10 }).default('09:00'),
	reviewEnabled: tinyint().default(0),
	reviewSms: tinyint().default(0),
	reviewEmail: tinyint().default(0),
	reviewPush: tinyint().default(0),
	reviewText: text(),
	reviewGoogleLink: varchar({ length: 500 }),
	reviewFacebookLink: varchar({ length: 500 }),
	reviewCustomLink: varchar({ length: 500 }),
	reviewTriggerType: varchar({ length: 50 }).default('days'),
	reviewTriggerValue: int().default(3),
	prebookingEnabled: tinyint().default(0),
	prebookingSms: tinyint().default(0),
	prebookingEmail: tinyint().default(0),
	prebookingPush: tinyint().default(0),
	prebookingText: text(),
	prebookingIncludeDetails: tinyint().default(1),
	prebookingIncludeTime: tinyint().default(1),
	prebookingIncludeMaps: tinyint().default(0),
	prebookingTriggerType: varchar({ length: 50 }).default('hours'),
	prebookingTriggerValue: int().default(24),
	businessLocation: varchar({ length: 500 }),
	businessAddress: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
},
	(table) => [
		unique("userId").on(table.userId),
	]);

export const notificationTemplates = mysqlTable("notificationTemplates", {
	id: int().primaryKey().autoincrement(),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	templateType: mysqlEnum(['confirmation', 'reminder', 'follow_up', 'birthday', 'promotional', 'aftercare', 'preparation', 'custom']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	timing: text(),
	enabled: tinyint().default(1),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
	]);

export const policies = mysqlTable("policies", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	policyType: mysqlEnum(['deposit', 'design', 'reschedule', 'cancellation']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	enabled: tinyint().default(1),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
	]);

export const portfolios = mysqlTable("portfolios", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	imageUrl: text().notNull(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
]);

export const portfolioLikes = mysqlTable("portfolio_likes", {
	id: int().primaryKey().autoincrement(),
	portfolioId: int().notNull().references(() => portfolios.id, { onDelete: "cascade" }),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	unique("user_portfolio_like").on(table.userId, table.portfolioId),
]);


export const quickActionButtons = mysqlTable("quickActionButtons", {
	id: int().primaryKey().autoincrement(),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	label: varchar({ length: 100 }).notNull(),
	actionType: mysqlEnum(['send_text', 'find_availability', 'deposit_info', 'custom']).notNull(),
	content: text().notNull(),
	position: int().default(0).notNull(),
	enabled: tinyint().default(1),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
	]);

export const socialMessageSync = mysqlTable("socialMessageSync", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	platform: mysqlEnum(['instagram', 'facebook']).notNull(),
	lastSyncedAt: timestamp({ mode: 'string' }),
	lastMessageId: varchar({ length: 255 }),
	accessToken: text(),
	refreshToken: text(),
	tokenExpiresAt: timestamp({ mode: 'string' }),
	enabled: tinyint().default(1),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
	]);

export const users = mysqlTable("users", {
	id: varchar({ length: 64 }).primaryKey(),
	clerkId: varchar({ length: 255 }).unique(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: varchar({ length: 20 }).default('client').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	lastSignedIn: timestamp({ mode: 'string' }).default(sql`(now())`),
	phone: varchar({ length: 20 }),
	avatar: text(),
	bio: text(),
	instagramId: varchar({ length: 255 }),
	instagramUsername: varchar({ length: 255 }),
	facebookId: varchar({ length: 255 }),
	facebookName: varchar({ length: 255 }),
	hasCompletedOnboarding: tinyint().default(0),
	password: text(),
	birthday: datetime({ mode: 'string' }),
},
	(table) => [
	]);

export const voucherTemplates = mysqlTable("voucher_templates", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	name: varchar({ length: 255 }).notNull(),
	value: int().notNull(), // stored in cents
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
]);

export const issuedVouchers = mysqlTable("issued_vouchers", {
	id: int().primaryKey().autoincrement(),
	templateId: int().notNull().references(() => voucherTemplates.id, { onDelete: "cascade" }),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	code: varchar({ length: 50 }).notNull().unique(),
	status: mysqlEnum(['active', 'redeemed', 'expired']).default('active').notNull(),
	expiresAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	redeemedAt: timestamp({ mode: 'string' }),
}, (table) => [
	index("idx_templateId").on(table.templateId),
]);

export const notificationOutbox = mysqlTable("notification_outbox", {
	id: int().primaryKey().autoincrement(),
	eventType: varchar({ length: 100 }).notNull(),
	payloadJson: text().notNull(),
	status: mysqlEnum(['pending', 'sent', 'failed']).default('pending'),
	attemptCount: int().default(0),
	lastError: text(),
	nextAttemptAt: datetime({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		index("idx_status_next_attempt").on(table.status, table.nextAttemptAt),
	]);

export const moodboards = mysqlTable("moodboards", {
	id: int().primaryKey().autoincrement(),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	title: varchar({ length: 255 }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
]);

export const moodboardItems = mysqlTable("moodboard_items", {
	id: int().primaryKey().autoincrement(),
	moodboardId: int().notNull().references(() => moodboards.id, { onDelete: "cascade" }),
	imageUrl: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
]);


export type InsertAppointment = InferInsertModel<typeof appointments>;
export type SelectAppointment = InferSelectModel<typeof appointments>;
export type InsertConsultation = InferInsertModel<typeof consultations>;
export type SelectConsultation = InferSelectModel<typeof consultations>;
export type InsertConversation = InferInsertModel<typeof conversations>;
export type InsertMessage = InferInsertModel<typeof messages>;
export type InsertSocialMessageSync = InferInsertModel<typeof socialMessageSync>;
export type InsertPortfolio = InferInsertModel<typeof portfolios>;
export type InsertVoucherTemplate = InferInsertModel<typeof voucherTemplates>;
export type InsertIssuedVoucher = InferInsertModel<typeof issuedVouchers>;
export type InsertNotificationOutbox = InferInsertModel<typeof notificationOutbox>;
export type InsertArtistSettings = InferInsertModel<typeof artistSettings>;
export type SelectArtistSettings = InferSelectModel<typeof artistSettings>;
export type InsertQuickActionButton = InferInsertModel<typeof quickActionButtons>;
export type SelectQuickActionButton = InferSelectModel<typeof quickActionButtons>;
export type InsertNotificationTemplate = InferInsertModel<typeof notificationTemplates>;
export type SelectNotificationTemplate = InferSelectModel<typeof notificationTemplates>;


export const usersRelations = relations(users, ({ many }) => ({
	artistAppointments: many(appointments, { relationName: "artist_appointments" }),
	clientAppointments: many(appointments, { relationName: "client_appointments" }),
	artistConsultations: many(consultations, { relationName: "artist_consultations" }),
	clientConsultations: many(consultations, { relationName: "client_consultations" }),
	portfolios: many(portfolios),
	portfolioLikes: many(portfolioLikes),
	voucherTemplates: many(voucherTemplates),
	issuedVouchersAsArtist: many(issuedVouchers, { relationName: "artist_issued_vouchers" }),
	issuedVouchersAsClient: many(issuedVouchers, { relationName: "client_issued_vouchers" }),
	moodboards: many(moodboards),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
	artist: one(users, {
		fields: [appointments.artistId],
		references: [users.id],
		relationName: "artist_appointments"
	}),
	client: one(users, {
		fields: [appointments.clientId],
		references: [users.id],
		relationName: "client_appointments"
	}),
	conversation: one(conversations, {
		fields: [appointments.conversationId],
		references: [conversations.id]
	})
}));

export const consultationsRelations = relations(consultations, ({ one }) => ({
	artist: one(users, {
		fields: [consultations.artistId],
		references: [users.id],
		relationName: "artist_consultations"
	}),
	client: one(users, {
		fields: [consultations.clientId],
		references: [users.id],
		relationName: "client_consultations"
	}),
	conversation: one(conversations, {
		fields: [consultations.conversationId],
		references: [conversations.id]
	}),
	lead: one(leads, {
		fields: [consultations.leadId],
		references: [leads.id]
	})
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
	artist: one(users, {
		fields: [conversations.artistId],
		references: [users.id],
	}),
	client: one(users, {
		fields: [conversations.clientId],
		references: [users.id],
	}),
	messages: many(messages),
	appointments: many(appointments),
	consultations: many(consultations),
	lead: one(leads, {
		fields: [conversations.leadId],
		references: [leads.id]
	})
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
	sender: one(users, {
		fields: [messages.senderId],
		references: [users.id]
	})
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
	artist: one(users, {
		fields: [portfolios.artistId],
		references: [users.id],
	}),
	likes: many(portfolioLikes),
}));

export const portfolioLikesRelations = relations(portfolioLikes, ({ one }) => ({
	portfolio: one(portfolios, {
		fields: [portfolioLikes.portfolioId],
		references: [portfolios.id],
	}),
	user: one(users, {
		fields: [portfolioLikes.userId],
		references: [users.id],
	}),
}));

export const voucherTemplatesRelations = relations(voucherTemplates, ({ one, many }) => ({
	artist: one(users, {
		fields: [voucherTemplates.artistId],
		references: [users.id],
	}),
	issuedVouchers: many(issuedVouchers),
}));

export const issuedVouchersRelations = relations(issuedVouchers, ({ one }) => ({
	template: one(voucherTemplates, {
		fields: [issuedVouchers.templateId],
		references: [voucherTemplates.id],
	}),
	artist: one(users, {
		fields: [issuedVouchers.artistId],
		references: [users.id],
		relationName: "artist_issued_vouchers"
	}),
	client: one(users, {
		fields: [issuedVouchers.clientId],
		references: [users.id],
		relationName: "client_issued_vouchers"
	}),
}));

export const moodboardsRelations = relations(moodboards, ({ one, many }) => ({
	client: one(users, {
		fields: [moodboards.clientId],
		references: [users.id],
	}),
	items: many(moodboardItems),
}));

export const moodboardItemsRelations = relations(moodboardItems, ({ one }) => ({
	moodboard: one(moodboards, {
		fields: [moodboardItems.moodboardId],
		references: [moodboards.id],
	}),
}));


// ==========================================
// REVENUE PROTECTION ALGORITHM TABLES
// ==========================================

/**
 * Task Completion Registry
 * Records every task completion for analytics
 */
export const taskCompletions = mysqlTable("task_completions", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	taskType: varchar({ length: 100 }).notNull(), // e.g., 'new_consultation', 'deposit_collection', 'birthday_outreach'
	taskTier: mysqlEnum(['tier1', 'tier2', 'tier3', 'tier4']).notNull(),
	taskDomain: mysqlEnum(['business', 'social', 'personal']).default('business').notNull(),
	relatedEntityType: varchar({ length: 50 }), // 'consultation', 'appointment', 'conversation', 'user'
	relatedEntityId: varchar({ length: 64 }), // ID of the related entity
	clientId: varchar({ length: 64 }).references(() => users.id, { onDelete: "set null" }),
	priorityScore: int().notNull(), // Score at time of completion
	startedAt: timestamp({ mode: 'string' }).notNull(), // When task was selected/started
	completedAt: timestamp({ mode: 'string' }).notNull(), // When task was marked complete
	timeToCompleteSeconds: int().notNull(), // Calculated: completedAt - startedAt
	actionTaken: varchar({ length: 50 }), // 'sms', 'email', 'in_app', 'manual'
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("idx_artist_task_type").on(table.artistId, table.taskType),
	index("idx_artist_completed").on(table.artistId, table.completedAt),
	index("idx_task_domain").on(table.taskDomain),
]);

/**
 * Weekly Analytics Snapshots
 * Pre-computed weekly metrics for the analytics modal
 */
export const weeklyAnalytics = mysqlTable("weekly_analytics", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	weekStartDate: datetime({ mode: 'string' }).notNull(), // Monday of the week
	weekEndDate: datetime({ mode: 'string' }).notNull(), // Sunday of the week

	// Task completion metrics
	totalTasksCompleted: int().default(0),
	tier1TasksCompleted: int().default(0),
	tier2TasksCompleted: int().default(0),
	tier3TasksCompleted: int().default(0),
	tier4TasksCompleted: int().default(0),

	// Response time metrics (in seconds)
	avgConsultationResponseTime: int(), // Average time to respond to new consultations
	fastestConsultationResponse: int(),
	slowestConsultationResponse: int(),

	// Task completion time metrics (in seconds)
	avgTaskCompletionTime: int(),
	avgTier1CompletionTime: int(),
	avgTier2CompletionTime: int(),

	// Follow-up metrics
	followUpsWithin24Hours: int().default(0),
	followUpsWithin48Hours: int().default(0),
	totalFollowUpsNeeded: int().default(0),
	followUpRate: int(), // Percentage (0-100)

	// Revenue protection metrics
	depositsCollected: int().default(0),
	depositsOutstanding: int().default(0),
	appointmentsConfirmed: int().default(0),
	appointmentsUnconfirmed: int().default(0),

	// Consultation conversion
	newConsultations: int().default(0),
	consultationsConverted: int().default(0), // Became appointments
	conversionRate: int(), // Percentage (0-100)

	// Comparison to benchmarks (stored as percentage relative to benchmark)
	responseTimeVsBenchmark: int(), // 100 = at benchmark, >100 = faster, <100 = slower
	completionRateVsBenchmark: int(),
	followUpRateVsBenchmark: int(),

	// Overall efficiency score (0-100)
	efficiencyScore: int(),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	unique("artist_week").on(table.artistId, table.weekStartDate),
	index("idx_artist_week").on(table.artistId, table.weekStartDate),
]);

/**
 * Artist Dashboard Settings
 * Stores artist preferences for dashboard behavior
 */
export const dashboardSettings = mysqlTable("dashboard_settings", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),

	// Task display settings
	maxVisibleTasks: int().default(10),

	// Booking goal settings
	goalAdvancedBookingMonths: int().default(3), // How far ahead they want to be booked (1-12)

	// Email client preference
	preferredEmailClient: mysqlEnum(['default', 'gmail', 'outlook', 'apple_mail']).default('default'),

	// Analytics preferences
	showWeeklySnapshot: tinyint().default(1),
	lastSnapshotShownAt: timestamp({ mode: 'string' }),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	unique("artist_dashboard_settings").on(table.artistId),
]);

/**
 * Active Tasks Cache
 * Stores currently generated tasks for quick retrieval
 * Regenerated on relevant data changes
 */
export const activeTasks = mysqlTable("active_tasks", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	taskDomain: mysqlEnum(['business', 'social', 'personal']).default('business').notNull(),
	taskType: varchar({ length: 100 }).notNull(),
	taskTier: mysqlEnum(['tier1', 'tier2', 'tier3', 'tier4']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	context: text(), // Additional context shown on card
	priorityScore: int().notNull(),
	priorityLevel: mysqlEnum(['critical', 'high', 'medium', 'low']).notNull(),

	// Related entity info
	relatedEntityType: varchar({ length: 50 }),
	relatedEntityId: varchar({ length: 64 }),
	clientId: varchar({ length: 64 }).references(() => users.id, { onDelete: "cascade" }),
	clientName: varchar({ length: 255 }),

	// Action info for SMS/Email integration
	actionType: mysqlEnum(['in_app', 'sms', 'email', 'external']),
	smsNumber: varchar({ length: 20 }),
	smsBody: text(),
	emailRecipient: varchar({ length: 320 }),
	emailSubject: varchar({ length: 255 }),
	emailBody: text(),
	deepLink: varchar({ length: 500 }), // In-app navigation link

	// Timing info
	dueAt: timestamp({ mode: 'string' }), // When this task becomes urgent
	expiresAt: timestamp({ mode: 'string' }), // When this task is no longer relevant

	// Tracking
	startedAt: timestamp({ mode: 'string' }), // When user selected this task

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("idx_artist_domain").on(table.artistId, table.taskDomain),
	index("idx_artist_score").on(table.artistId, table.priorityScore),
]);

// Type exports for new tables
export type InsertTaskCompletion = InferInsertModel<typeof taskCompletions>;
export type SelectTaskCompletion = InferSelectModel<typeof taskCompletions>;
export type InsertWeeklyAnalytics = InferInsertModel<typeof weeklyAnalytics>;
export type SelectWeeklyAnalytics = InferSelectModel<typeof weeklyAnalytics>;
export type InsertDashboardSettings = InferInsertModel<typeof dashboardSettings>;
export type SelectDashboardSettings = InferSelectModel<typeof dashboardSettings>;
export type InsertActiveTask = InferInsertModel<typeof activeTasks>;
export type SelectActiveTask = InferSelectModel<typeof activeTasks>;

// Relations for new tables
export const taskCompletionsRelations = relations(taskCompletions, ({ one }) => ({
	artist: one(users, {
		fields: [taskCompletions.artistId],
		references: [users.id],
	}),
	client: one(users, {
		fields: [taskCompletions.clientId],
		references: [users.id],
	}),
}));

export const weeklyAnalyticsRelations = relations(weeklyAnalytics, ({ one }) => ({
	artist: one(users, {
		fields: [weeklyAnalytics.artistId],
		references: [users.id],
	}),
}));

export const dashboardSettingsRelations = relations(dashboardSettings, ({ one }) => ({
	artist: one(users, {
		fields: [dashboardSettings.artistId],
		references: [users.id],
	}),
}));

export const activeTasksRelations = relations(activeTasks, ({ one }) => ({
	artist: one(users, {
		fields: [activeTasks.artistId],
		references: [users.id],
	}),
	client: one(users, {
		fields: [activeTasks.clientId],
		references: [users.id],
	}),
}));


// ==========================================
// CONSULTATION FUNNEL / ARTIST LINK TABLES
// ==========================================

/**
 * Artist Public Profile Settings
 * Stores artist's public link configuration and customization
 */
export const artistPublicProfile = mysqlTable("artist_public_profile", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),

	// Public link slug (e.g., "pmason" for calendair.app/start/pmason)
	slug: varchar({ length: 50 }).notNull().unique(),

	// Profile display settings
	displayName: varchar({ length: 255 }),
	tagline: text(), // Short bio/tagline for public profile
	profileImageUrl: text(),
	coverImageUrl: text(),

	// Funnel settings
	funnelEnabled: tinyint().default(1), // Whether public link is active

	// Funnel step configuration (JSON array of enabled steps)
	// Default: ['intent', 'contact', 'style', 'budget', 'availability']
	enabledSteps: text().default('["intent","contact","style","budget","availability"]'),

	// Style options available (JSON array)
	styleOptions: text().default('["realism","traditional","neo-traditional","japanese","blackwork","dotwork","watercolor","geometric","minimalist","other"]'),

	// Placement options available (JSON array)
	placementOptions: text().default('["full-sleeve","half-sleeve","forearm","upper-arm","back-piece","chest","ribs","thigh","calf","hand","neck","other"]'),

	// Budget ranges available (JSON array of {label, min, max})
	budgetRanges: text().default('[{"label":"Under $500","min":0,"max":500},{"label":"$500-$1,000","min":500,"max":1000},{"label":"$1,000-$2,500","min":1000,"max":2500},{"label":"$2,500-$5,000","min":2500,"max":5000},{"label":"$5,000-$10,000","min":5000,"max":10000},{"label":"$10,000+","min":10000,"max":null}]'),

	// Availability settings
	showAvailability: tinyint().default(1),

	// Analytics
	totalViews: int().default(0),
	totalSubmissions: int().default(0),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	unique("artist_public_profile_artist").on(table.artistId),
	index("idx_slug").on(table.slug),
]);

/**
 * Leads Table
 * The single source of truth for all consultation funnel submissions
 * This is the core entity that drives the Revenue Protection Algorithm
 */
export const leads = mysqlTable("leads", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),

	// Client info (may or may not have a user account yet)
	clientId: varchar({ length: 64 }).references(() => users.id, { onDelete: "set null" }),
	clientName: varchar({ length: 255 }).notNull(),
	clientFirstName: varchar({ length: 100 }),
	clientLastName: varchar({ length: 100 }),
	clientBirthdate: varchar({ length: 20 }),
	clientEmail: varchar({ length: 320 }).notNull(),
	clientPhone: varchar({ length: 20 }),

	// Lead source tracking
	source: mysqlEnum(['funnel', 'direct_message', 'instagram', 'facebook', 'referral', 'walk_in', 'other']).default('funnel').notNull(),
	sourceDetails: text(), // Additional source info (e.g., referrer name, ad campaign)
	funnelSessionId: varchar({ length: 64 }), // Links to funnel_sessions for analytics

	// Lead status progression
	status: mysqlEnum([
		'new',              // Just submitted, not viewed
		'viewed',           // Artist has seen the lead
		'contacted',        // Artist has reached out
		'qualifying',       // In discussion, gathering more info
		'proposal_sent',    // Proposal/quote sent
		'proposal_accepted',// Client accepted proposal
		'deposit_requested',// Deposit has been requested
		'deposit_pending',  // Deposit claimed but not verified
		'deposit_verified', // Deposit confirmed
		'scheduled',        // Appointment booked
		'completed',        // Work done
		'lost',             // Lead didn't convert
		'archived'          // Old/inactive lead
	]).default('new').notNull(),

	// Intent/Project details (from funnel)
	projectType: varchar({ length: 100 }), // e.g., 'full-sleeve', 'back-piece', 'cover-up'
	projectDescription: text(),

	// Style preferences
	stylePreferences: text(), // JSON array of selected styles
	referenceImages: text(), // JSON array of uploaded image URLs
	bodyPlacementImages: text(), // JSON array of body placement photo URLs

	// Size & Budget
	placement: varchar({ length: 100 }),
	estimatedSize: varchar({ length: 100 }), // e.g., 'small', 'medium', 'large', 'extra-large'
	budgetMin: int(), // In cents
	budgetMax: int(), // In cents
	budgetLabel: varchar({ length: 100 }), // Human-readable budget range

	// Availability preferences
	preferredTimeframe: varchar({ length: 100 }), // e.g., 'asap', '1-3 months', '3-6 months', '6-12 months'
	preferredMonths: text(), // JSON array of preferred months
	urgency: mysqlEnum(['flexible', 'moderate', 'urgent']).default('flexible'),

	// Derived tags (computed from form answers, stored as JSON array)
	// e.g., ["Full Sleeve", "Est $6k-$8k", "High Priority", "Realism", "2026 Target"]
	derivedTags: text(),

	// Priority scoring (computed by algorithm)
	priorityScore: int().default(0),
	priorityTier: mysqlEnum(['tier1', 'tier2', 'tier3', 'tier4']).default('tier2'),

	// Value estimation
	estimatedValue: int(), // In cents, computed from budget range

	// Linked entities (created when lead progresses)
	conversationId: int(),
	consultationId: int(),
	appointmentId: int().references(() => appointments.id, { onDelete: "set null" }),

	// Proposal tracking
	proposalSentAt: timestamp({ mode: 'string' }),
	proposalAcceptedAt: timestamp({ mode: 'string' }),
	proposedDates: text(), // JSON array of proposed date options
	acceptedDate: datetime({ mode: 'string' }),

	// Deposit tracking
	depositAmount: int(), // In cents
	depositRequestedAt: timestamp({ mode: 'string' }),
	depositClaimedAt: timestamp({ mode: 'string' }),
	depositVerifiedAt: timestamp({ mode: 'string' }),
	depositMethod: mysqlEnum(['stripe', 'paypal', 'bank_transfer', 'cash']),
	depositProof: text(), // Screenshot URL for bank transfers

	// Timestamps
	lastContactedAt: timestamp({ mode: 'string' }),
	lastActivityAt: timestamp({ mode: 'string' }),
	convertedAt: timestamp({ mode: 'string' }), // When became a booked appointment
	lostAt: timestamp({ mode: 'string' }),
	lostReason: varchar({ length: 255 }),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("idx_artist_status").on(table.artistId, table.status),
	index("idx_artist_priority").on(table.artistId, table.priorityScore),
	index("idx_client_email").on(table.clientEmail),
	index("idx_created").on(table.createdAt),
]);

/**
 * Funnel Sessions
 * Tracks each visitor's progress through the funnel
 * Used for analytics and abandoned funnel recovery
 */
export const funnelSessions = mysqlTable("funnel_sessions", {
	id: varchar({ length: 64 }).primaryKey(), // UUID
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),

	// Session tracking
	visitorFingerprint: varchar({ length: 255 }), // For anonymous tracking
	ipAddress: varchar({ length: 45 }),
	userAgent: text(),
	referrer: text(),

	// Funnel progress
	currentStep: varchar({ length: 50 }).default('intent'),
	completedSteps: text().default('[]'), // JSON array of completed step names
	stepData: text().default('{}'), // JSON object with data from each step

	// Completion status
	completed: tinyint().default(0),
	leadId: int().references(() => leads.id, { onDelete: "set null" }),

	// Timing
	startedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	lastActivityAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	completedAt: timestamp({ mode: 'string' }),

	// Abandonment tracking
	abandoned: tinyint().default(0),
	abandonedAt: timestamp({ mode: 'string' }),
	abandonedStep: varchar({ length: 50 }),
	recoveryEmailSent: tinyint().default(0),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("idx_artist_session").on(table.artistId),
	index("idx_abandoned").on(table.abandoned, table.recoveryEmailSent),
]);

/**
 * Lead Activity Log
 * Tracks all activity on a lead for timeline display
 */
export const leadActivityLog = mysqlTable("lead_activity_log", {
	id: int().primaryKey().autoincrement(),
	leadId: int().notNull().references(() => leads.id, { onDelete: "cascade" }),

	activityType: mysqlEnum([
		'created',
		'viewed',
		'status_changed',
		'contacted',
		'message_sent',
		'message_received',
		'proposal_sent',
		'proposal_accepted',
		'proposal_declined',
		'deposit_requested',
		'deposit_claimed',
		'deposit_verified',
		'appointment_scheduled',
		'appointment_confirmed',
		'appointment_completed',
		'note_added',
		'tag_added',
		'tag_removed',
		'marked_lost',
		'archived'
	]).notNull(),

	// Activity details
	description: text(),
	metadata: text(), // JSON object with additional data

	// Who performed the action
	performedBy: varchar({ length: 64 }).references(() => users.id, { onDelete: "set null" }),
	performedByType: mysqlEnum(['artist', 'client', 'system']).default('system'),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("idx_lead_activity").on(table.leadId, table.createdAt),
]);

// Type exports for funnel tables
export type InsertArtistPublicProfile = InferInsertModel<typeof artistPublicProfile>;
export type SelectArtistPublicProfile = InferSelectModel<typeof artistPublicProfile>;
export type InsertLead = InferInsertModel<typeof leads>;
export type SelectLead = InferSelectModel<typeof leads>;
export type InsertFunnelSession = InferInsertModel<typeof funnelSessions>;
export type SelectFunnelSession = InferSelectModel<typeof funnelSessions>;
export type InsertLeadActivityLog = InferInsertModel<typeof leadActivityLog>;
export type SelectLeadActivityLog = InferSelectModel<typeof leadActivityLog>;

// Relations for funnel tables
export const artistPublicProfileRelations = relations(artistPublicProfile, ({ one }) => ({
	artist: one(users, {
		fields: [artistPublicProfile.artistId],
		references: [users.id],
	}),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
	artist: one(users, {
		fields: [leads.artistId],
		references: [users.id],
		relationName: "artist_leads"
	}),
	client: one(users, {
		fields: [leads.clientId],
		references: [users.id],
		relationName: "client_leads"
	}),
	conversation: one(conversations, {
		fields: [leads.conversationId],
		references: [conversations.id],
	}),
	consultation: one(consultations, {
		fields: [leads.consultationId],
		references: [consultations.id],
	}),
	appointment: one(appointments, {
		fields: [leads.appointmentId],
		references: [appointments.id],
	}),
	activityLog: many(leadActivityLog),
}));

export const funnelSessionsRelations = relations(funnelSessions, ({ one }) => ({
	artist: one(users, {
		fields: [funnelSessions.artistId],
		references: [users.id],
	}),
	lead: one(leads, {
		fields: [funnelSessions.leadId],
		references: [leads.id],
	}),
}));

export const leadActivityLogRelations = relations(leadActivityLog, ({ one }) => ({
	lead: one(leads, {
		fields: [leadActivityLog.leadId],
		references: [leads.id],
	}),
	performer: one(users, {
		fields: [leadActivityLog.performedBy],
		references: [users.id],
	}),
}));


// ==========================================
// PROMOTIONS SYSTEM TABLES
// ==========================================

/**
 * Promotion Templates
 * Artist-created templates for vouchers, discounts, and credits
 */
export const promotionTemplates = mysqlTable("promotion_templates", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),

	// Template type
	type: mysqlEnum(['voucher', 'discount', 'credit']).notNull(),

	// Display info
	name: varchar({ length: 255 }).notNull(),
	description: text(),

	// Value configuration
	valueType: mysqlEnum(['fixed', 'percentage']).default('fixed').notNull(),
	value: int().notNull(), // Amount in cents for fixed, percentage for percentage type

	// Design customization
	templateDesign: varchar({ length: 50 }).default('classic').notNull(), // References SSOT template registry
	primaryColor: varchar({ length: 50 }), // Color key from palette
	gradientFrom: varchar({ length: 50 }), // Gradient start color key
	gradientTo: varchar({ length: 50 }), // Gradient end color key
	customText: varchar({ length: 100 }), // Custom text overlay
	logoUrl: text(), // S3 URL for custom logo
	backgroundImageUrl: text(), // S3 URL for background image
	backgroundScale: decimal({ precision: 3, scale: 2 }).default('1.00'), // Scale factor for background image
	backgroundPositionX: int().default(50), // X position percentage (0-100)
	backgroundPositionY: int().default(50), // Y position percentage (0-100)

	// Status
	isActive: tinyint().default(1),

	// Advanced Logic
	validityDuration: int(), // Days until expiry (null = no expiry)
	autoApplyTrigger: mysqlEnum(['none', 'new_client', 'birthday']).default('none').notNull(),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("idx_artist_templates").on(table.artistId, table.type),
]);

/**
 * Issued Promotions
 * Individual promotions issued to clients (instances of templates)
 */
export const issuedPromotions = mysqlTable("issued_promotions", {
	id: int().primaryKey().autoincrement(),
	templateId: int().notNull().references(() => promotionTemplates.id, { onDelete: "cascade" }),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar({ length: 64 }).references(() => users.id, { onDelete: "set null" }), // Null for auto-apply promotions

	// Unique code for redemption
	code: varchar({ length: 32 }).notNull(),

	// Value at time of issue (snapshot from template)
	type: mysqlEnum(['voucher', 'discount', 'credit']).notNull(),
	valueType: mysqlEnum(['fixed', 'percentage']).default('fixed').notNull(),
	originalValue: int().notNull(), // Original value when issued
	remainingValue: int().notNull(), // Remaining value (for partial redemptions)

	// Auto-apply settings
	isAutoApply: tinyint().default(0),
	autoApplyStartDate: datetime({ mode: 'string' }),
	autoApplyEndDate: datetime({ mode: 'string' }),

	// Status
	status: mysqlEnum(['active', 'partially_used', 'fully_used', 'expired', 'revoked']).default('active').notNull(),

	// Redemption tracking
	redeemedAt: timestamp({ mode: 'string' }),
	redeemedOnAppointmentId: int().references(() => appointments.id, { onDelete: "set null" }),

	// Validity
	expiresAt: datetime({ mode: 'string' }),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	unique("issued_promotions_code").on(table.code),
	index("idx_client_promotions").on(table.clientId, table.status),
	index("idx_artist_promotions").on(table.artistId, table.status),
	index("idx_auto_apply").on(table.isAutoApply, table.autoApplyStartDate, table.autoApplyEndDate),
	index("idx_templateId").on(table.templateId),
]);

/**
 * Promotion Redemptions
 * Track partial or full redemptions of promotions
 */
export const promotionRedemptions = mysqlTable("promotion_redemptions", {
	id: int().primaryKey().autoincrement(),
	promotionId: int().notNull().references(() => issuedPromotions.id, { onDelete: "cascade" }),
	appointmentId: int().notNull().references(() => appointments.id, { onDelete: "cascade" }),

	// Amount redeemed in this transaction
	amountRedeemed: int().notNull(), // In cents

	// Original booking amount before discount
	originalAmount: int().notNull(),
	// Final amount after discount
	finalAmount: int().notNull(),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("idx_promotion_redemptions").on(table.promotionId),
	index("idx_appointment_redemptions").on(table.appointmentId),
]);

// Type exports for promotion tables
export type InsertPromotionTemplate = InferInsertModel<typeof promotionTemplates>;
export type SelectPromotionTemplate = InferSelectModel<typeof promotionTemplates>;
export type InsertIssuedPromotion = InferInsertModel<typeof issuedPromotions>;
export type SelectIssuedPromotion = InferSelectModel<typeof issuedPromotions>;
export type InsertPromotionRedemption = InferInsertModel<typeof promotionRedemptions>;
export type SelectPromotionRedemption = InferSelectModel<typeof promotionRedemptions>;
export type InsertPushSubscription = InferInsertModel<typeof pushSubscriptions>;
export type SelectPushSubscription = InferSelectModel<typeof pushSubscriptions>;

// Relations for promotion tables
export const promotionTemplatesRelations = relations(promotionTemplates, ({ one, many }) => ({
	artist: one(users, {
		fields: [promotionTemplates.artistId],
		references: [users.id],
	}),
	issuedPromotions: many(issuedPromotions),
}));

export const issuedPromotionsRelations = relations(issuedPromotions, ({ one, many }) => ({
	template: one(promotionTemplates, {
		fields: [issuedPromotions.templateId],
		references: [promotionTemplates.id],
	}),
	artist: one(users, {
		fields: [issuedPromotions.artistId],
		references: [users.id],
	}),
	client: one(users, {
		fields: [issuedPromotions.clientId],
		references: [users.id],
	}),
	redemptions: many(promotionRedemptions),
}));

export const promotionRedemptionsRelations = relations(promotionRedemptions, ({ one }) => ({
	promotion: one(issuedPromotions, {
		fields: [promotionRedemptions.promotionId],
		references: [issuedPromotions.id],
	}),
	appointment: one(appointments, {
		fields: [promotionRedemptions.appointmentId],
		references: [appointments.id],
	}),
}));

export const pushSubscriptions = mysqlTable("push_subscriptions", {
	id: int().primaryKey().autoincrement(),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	endpoint: varchar({ length: 500 }).notNull(),
	keys: text("keys").notNull(), // JSON { p256dh, auth }
	userAgent: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("user_id_idx").on(table.userId),
]);

export const paymentMethodSettings = mysqlTable("payment_method_settings", {
	id: int().primaryKey().autoincrement(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	stripeEnabled: tinyint().default(0),
	paypalEnabled: tinyint().default(0),
	bankEnabled: tinyint().default(0),
	cashEnabled: tinyint().default(1),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("pms_artist_idx").on(table.artistId),
]);

export const consentForms = mysqlTable("consent_forms", {
	id: int().primaryKey().autoincrement(),
	appointmentId: int().references(() => appointments.id, { onDelete: "set null" }),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	formType: mysqlEnum('form_type', ['procedure_consent', 'medical_release']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text(),
	signedAt: datetime({ mode: 'string' }),
	formData: text(), // JSON blob
	status: mysqlEnum('consent_status', ['pending', 'signed']).default('pending').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	index("cf_client_idx").on(table.clientId),
	index("cf_artist_idx").on(table.artistId),
	index("cf_appointment_idx").on(table.appointmentId),
]);
