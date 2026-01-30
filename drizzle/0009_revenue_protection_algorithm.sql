CREATE TABLE `active_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`taskDomain` enum('business','social','personal') NOT NULL DEFAULT 'business',
	`taskType` varchar(100) NOT NULL,
	`taskTier` enum('tier1','tier2','tier3','tier4') NOT NULL,
	`title` varchar(255) NOT NULL,
	`context` text,
	`priorityScore` int NOT NULL,
	`priorityLevel` enum('critical','high','medium','low') NOT NULL,
	`relatedEntityType` varchar(50),
	`relatedEntityId` varchar(64),
	`clientId` varchar(64),
	`clientName` varchar(255),
	`actionType` enum('in_app','sms','email','external'),
	`smsNumber` varchar(20),
	`smsBody` text,
	`emailRecipient` varchar(320),
	`emailSubject` varchar(255),
	`emailBody` text,
	`deepLink` varchar(500),
	`dueAt` timestamp,
	`expiresAt` timestamp,
	`startedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `active_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dashboard_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`maxVisibleTasks` int DEFAULT 10,
	`goalAdvancedBookingMonths` int DEFAULT 3,
	`preferredEmailClient` enum('default','gmail','outlook','apple_mail') DEFAULT 'default',
	`showWeeklySnapshot` tinyint DEFAULT 1,
	`lastSnapshotShownAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `dashboard_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `artist_dashboard_settings` UNIQUE(`artistId`)
);
--> statement-breakpoint
CREATE TABLE `moodboard_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moodboardId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `moodboard_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moodboards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `moodboards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`payloadJson` text NOT NULL,
	`status` enum('pending','sent','failed') DEFAULT 'pending',
	`attemptCount` int DEFAULT 0,
	`lastError` text,
	`nextAttemptAt` datetime,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `notification_outbox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`taskType` varchar(100) NOT NULL,
	`taskTier` enum('tier1','tier2','tier3','tier4') NOT NULL,
	`taskDomain` enum('business','social','personal') NOT NULL DEFAULT 'business',
	`relatedEntityType` varchar(50),
	`relatedEntityId` varchar(64),
	`clientId` varchar(64),
	`priorityScore` int NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp NOT NULL,
	`timeToCompleteSeconds` int NOT NULL,
	`actionTaken` varchar(50),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `task_completions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`weekStartDate` datetime NOT NULL,
	`weekEndDate` datetime NOT NULL,
	`totalTasksCompleted` int DEFAULT 0,
	`tier1TasksCompleted` int DEFAULT 0,
	`tier2TasksCompleted` int DEFAULT 0,
	`tier3TasksCompleted` int DEFAULT 0,
	`tier4TasksCompleted` int DEFAULT 0,
	`avgConsultationResponseTime` int,
	`fastestConsultationResponse` int,
	`slowestConsultationResponse` int,
	`avgTaskCompletionTime` int,
	`avgTier1CompletionTime` int,
	`avgTier2CompletionTime` int,
	`followUpsWithin24Hours` int DEFAULT 0,
	`followUpsWithin48Hours` int DEFAULT 0,
	`totalFollowUpsNeeded` int DEFAULT 0,
	`followUpRate` int,
	`depositsCollected` int DEFAULT 0,
	`depositsOutstanding` int DEFAULT 0,
	`appointmentsConfirmed` int DEFAULT 0,
	`appointmentsUnconfirmed` int DEFAULT 0,
	`newConsultations` int DEFAULT 0,
	`consultationsConverted` int DEFAULT 0,
	`conversionRate` int,
	`responseTimeVsBenchmark` int,
	`completionRateVsBenchmark` int,
	`followUpRateVsBenchmark` int,
	`efficiencyScore` int,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `weekly_analytics_id` PRIMARY KEY(`id`),
	CONSTRAINT `artist_week` UNIQUE(`artistId`,`weekStartDate`)
);
--> statement-breakpoint
DROP INDEX `idx_voucher_code` ON `issued_vouchers`;--> statement-breakpoint
ALTER TABLE `issued_vouchers` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `consultations` ADD `viewed` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `active_tasks` ADD CONSTRAINT `active_tasks_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `active_tasks` ADD CONSTRAINT `active_tasks_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dashboard_settings` ADD CONSTRAINT `dashboard_settings_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moodboard_items` ADD CONSTRAINT `moodboard_items_moodboardId_moodboards_id_fk` FOREIGN KEY (`moodboardId`) REFERENCES `moodboards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moodboards` ADD CONSTRAINT `moodboards_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_completions` ADD CONSTRAINT `task_completions_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_completions` ADD CONSTRAINT `task_completions_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_analytics` ADD CONSTRAINT `weekly_analytics_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_artist_domain` ON `active_tasks` (`artistId`,`taskDomain`);--> statement-breakpoint
CREATE INDEX `idx_artist_score` ON `active_tasks` (`artistId`,`priorityScore`);--> statement-breakpoint
CREATE INDEX `idx_status_next_attempt` ON `notification_outbox` (`status`,`nextAttemptAt`);--> statement-breakpoint
CREATE INDEX `idx_artist_task_type` ON `task_completions` (`artistId`,`taskType`);--> statement-breakpoint
CREATE INDEX `idx_artist_completed` ON `task_completions` (`artistId`,`completedAt`);--> statement-breakpoint
CREATE INDEX `idx_task_domain` ON `task_completions` (`taskDomain`);--> statement-breakpoint
CREATE INDEX `idx_artist_week` ON `weekly_analytics` (`artistId`,`weekStartDate`);