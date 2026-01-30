CREATE TABLE `artist_public_profile` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`displayName` varchar(255),
	`tagline` text,
	`profileImageUrl` text,
	`coverImageUrl` text,
	`funnelEnabled` tinyint DEFAULT 1,
	`enabledSteps` text DEFAULT ('["intent","contact","style","budget","availability"]'),
	`styleOptions` text DEFAULT ('["realism","traditional","neo-traditional","japanese","blackwork","dotwork","watercolor","geometric","minimalist","other"]'),
	`placementOptions` text DEFAULT ('["full-sleeve","half-sleeve","forearm","upper-arm","back-piece","chest","ribs","thigh","calf","hand","neck","other"]'),
	`budgetRanges` text DEFAULT ('[{"label":"Under $500","min":0,"max":500},{"label":"$500-$1,000","min":500,"max":1000},{"label":"$1,000-$2,500","min":1000,"max":2500},{"label":"$2,500-$5,000","min":2500,"max":5000},{"label":"$5,000-$10,000","min":5000,"max":10000},{"label":"$10,000+","min":10000,"max":null}]'),
	`showAvailability` tinyint DEFAULT 1,
	`totalViews` int DEFAULT 0,
	`totalSubmissions` int DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `artist_public_profile_id` PRIMARY KEY(`id`),
	CONSTRAINT `artist_public_profile_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `artist_public_profile_artist` UNIQUE(`artistId`)
);
--> statement-breakpoint
CREATE TABLE `funnel_sessions` (
	`id` varchar(64) NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`visitorFingerprint` varchar(255),
	`ipAddress` varchar(45),
	`userAgent` text,
	`referrer` text,
	`currentStep` varchar(50) DEFAULT 'intent',
	`completedSteps` text DEFAULT ('[]'),
	`stepData` text DEFAULT ('{}'),
	`completed` tinyint DEFAULT 0,
	`leadId` int,
	`startedAt` timestamp DEFAULT (now()),
	`lastActivityAt` timestamp DEFAULT (now()),
	`completedAt` timestamp,
	`abandoned` tinyint DEFAULT 0,
	`abandonedAt` timestamp,
	`abandonedStep` varchar(50),
	`recoveryEmailSent` tinyint DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `funnel_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`activityType` enum('created','viewed','status_changed','contacted','message_sent','message_received','proposal_sent','proposal_accepted','proposal_declined','deposit_requested','deposit_claimed','deposit_verified','appointment_scheduled','appointment_confirmed','appointment_completed','note_added','tag_added','tag_removed','marked_lost','archived') NOT NULL,
	`description` text,
	`metadata` text,
	`performedBy` varchar(64),
	`performedByType` enum('artist','client','system') DEFAULT 'system',
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `lead_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`clientId` varchar(64),
	`clientName` varchar(255) NOT NULL,
	`clientEmail` varchar(320) NOT NULL,
	`clientPhone` varchar(20),
	`source` enum('funnel','direct_message','instagram','facebook','referral','walk_in','other') NOT NULL DEFAULT 'funnel',
	`sourceDetails` text,
	`funnelSessionId` varchar(64),
	`status` enum('new','viewed','contacted','qualifying','proposal_sent','proposal_accepted','deposit_requested','deposit_pending','deposit_verified','scheduled','completed','lost','archived') NOT NULL DEFAULT 'new',
	`projectType` varchar(100),
	`projectDescription` text,
	`stylePreferences` text,
	`referenceImages` text,
	`placement` varchar(100),
	`estimatedSize` varchar(100),
	`budgetMin` int,
	`budgetMax` int,
	`budgetLabel` varchar(100),
	`preferredTimeframe` varchar(100),
	`preferredMonths` text,
	`urgency` enum('flexible','moderate','urgent') DEFAULT 'flexible',
	`derivedTags` text,
	`priorityScore` int DEFAULT 0,
	`priorityTier` enum('tier1','tier2','tier3','tier4') DEFAULT 'tier2',
	`estimatedValue` int,
	`conversationId` int,
	`consultationId` int,
	`appointmentId` int,
	`proposalSentAt` timestamp,
	`proposalAcceptedAt` timestamp,
	`proposedDates` text,
	`acceptedDate` datetime,
	`depositAmount` int,
	`depositRequestedAt` timestamp,
	`depositClaimedAt` timestamp,
	`depositVerifiedAt` timestamp,
	`depositMethod` enum('stripe','paypal','bank_transfer','cash'),
	`depositProof` text,
	`lastContactedAt` timestamp,
	`lastActivityAt` timestamp,
	`convertedAt` timestamp,
	`lostAt` timestamp,
	`lostReason` varchar(255),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `artist_public_profile` ADD CONSTRAINT `artist_public_profile_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `funnel_sessions` ADD CONSTRAINT `funnel_sessions_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `funnel_sessions` ADD CONSTRAINT `funnel_sessions_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lead_activity_log` ADD CONSTRAINT `lead_activity_log_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lead_activity_log` ADD CONSTRAINT `lead_activity_log_performedBy_users_id_fk` FOREIGN KEY (`performedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_consultationId_consultations_id_fk` FOREIGN KEY (`consultationId`) REFERENCES `consultations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_slug` ON `artist_public_profile` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_artist_session` ON `funnel_sessions` (`artistId`);--> statement-breakpoint
CREATE INDEX `idx_abandoned` ON `funnel_sessions` (`abandoned`,`recoveryEmailSent`);--> statement-breakpoint
CREATE INDEX `idx_lead_activity` ON `lead_activity_log` (`leadId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_artist_status` ON `leads` (`artistId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_artist_priority` ON `leads` (`artistId`,`priorityScore`);--> statement-breakpoint
CREATE INDEX `idx_client_email` ON `leads` (`clientEmail`);--> statement-breakpoint
CREATE INDEX `idx_created` ON `leads` (`createdAt`);