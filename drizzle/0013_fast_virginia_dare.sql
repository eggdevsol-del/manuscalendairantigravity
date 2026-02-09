ALTER TABLE `leads` DROP FOREIGN KEY `leads_conversationId_conversations_id_fk`;
--> statement-breakpoint
ALTER TABLE `leads` DROP FOREIGN KEY `leads_consultationId_consultations_id_fk`;
--> statement-breakpoint
ALTER TABLE `push_subscriptions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `issued_vouchers` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `timeZone` varchar(64) DEFAULT 'Australia/Brisbane' NOT NULL;--> statement-breakpoint
ALTER TABLE `consultations` ADD `leadId` int;--> statement-breakpoint
ALTER TABLE `conversations` ADD `leadId` int;