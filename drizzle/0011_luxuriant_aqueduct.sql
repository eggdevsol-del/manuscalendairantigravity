CREATE TABLE `issued_promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`clientId` varchar(64),
	`code` varchar(32) NOT NULL,
	`type` enum('voucher','discount','credit') NOT NULL,
	`valueType` enum('fixed','percentage') NOT NULL DEFAULT 'fixed',
	`originalValue` int NOT NULL,
	`remainingValue` int NOT NULL,
	`isAutoApply` tinyint DEFAULT 0,
	`autoApplyStartDate` datetime,
	`autoApplyEndDate` datetime,
	`status` enum('active','partially_used','fully_used','expired','revoked') NOT NULL DEFAULT 'active',
	`redeemedAt` timestamp,
	`redeemedOnAppointmentId` int,
	`expiresAt` datetime,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `issued_promotions_id` PRIMARY KEY(`id`),
	CONSTRAINT `issued_promotions_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `promotion_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promotionId` int NOT NULL,
	`appointmentId` int NOT NULL,
	`amountRedeemed` int NOT NULL,
	`originalAmount` int NOT NULL,
	`finalAmount` int NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `promotion_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotion_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`type` enum('voucher','discount','credit') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`valueType` enum('fixed','percentage') NOT NULL DEFAULT 'fixed',
	`value` int NOT NULL,
	`templateDesign` varchar(50) NOT NULL DEFAULT 'classic',
	`primaryColor` varchar(50),
	`gradientFrom` varchar(50),
	`gradientTo` varchar(50),
	`customText` varchar(100),
	`logoUrl` text,
	`backgroundImageUrl` text,
	`backgroundScale` decimal(3,2) DEFAULT '1.00',
	`backgroundPositionX` int DEFAULT 50,
	`backgroundPositionY` int DEFAULT 50,
	`isActive` tinyint DEFAULT 1,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `promotion_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `businessEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `publicSlug` varchar(50);--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `funnelEnabled` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `funnelWelcomeMessage` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `styleOptions` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `placementOptions` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `budgetRanges` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `clientFirstName` varchar(100);--> statement-breakpoint
ALTER TABLE `leads` ADD `clientLastName` varchar(100);--> statement-breakpoint
ALTER TABLE `leads` ADD `clientBirthdate` varchar(20);--> statement-breakpoint
ALTER TABLE `leads` ADD `bodyPlacementImages` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD CONSTRAINT `artistSettings_publicSlug_unique` UNIQUE(`publicSlug`);--> statement-breakpoint
ALTER TABLE `issued_promotions` ADD CONSTRAINT `issued_promotions_templateId_promotion_templates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `promotion_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issued_promotions` ADD CONSTRAINT `issued_promotions_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issued_promotions` ADD CONSTRAINT `issued_promotions_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issued_promotions` ADD CONSTRAINT `issued_promotions_redeemedOnAppointmentId_appointments_id_fk` FOREIGN KEY (`redeemedOnAppointmentId`) REFERENCES `appointments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotion_redemptions` ADD CONSTRAINT `promotion_redemptions_promotionId_issued_promotions_id_fk` FOREIGN KEY (`promotionId`) REFERENCES `issued_promotions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotion_redemptions` ADD CONSTRAINT `promotion_redemptions_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotion_templates` ADD CONSTRAINT `promotion_templates_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_client_promotions` ON `issued_promotions` (`clientId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_artist_promotions` ON `issued_promotions` (`artistId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_auto_apply` ON `issued_promotions` (`isAutoApply`,`autoApplyStartDate`,`autoApplyEndDate`);--> statement-breakpoint
CREATE INDEX `idx_promotion_redemptions` ON `promotion_redemptions` (`promotionId`);--> statement-breakpoint
CREATE INDEX `idx_appointment_redemptions` ON `promotion_redemptions` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `idx_artist_templates` ON `promotion_templates` (`artistId`,`type`);