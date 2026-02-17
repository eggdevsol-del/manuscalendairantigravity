CREATE TABLE `appointment_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`action` enum('created','rescheduled','cancelled','completed','proposal_revoked','no-show') NOT NULL,
	`oldValue` text,
	`newValue` text,
	`performedBy` varchar(64) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `appointment_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consent_forms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int,
	`clientId` varchar(64) NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`form_type` enum('procedure_consent','medical_release','form_9') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`signature` longtext,
	`signedAt` datetime,
	`formData` text,
	`consent_status` enum('pending','signed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `consent_forms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_method_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`stripeEnabled` tinyint DEFAULT 0,
	`paypalEnabled` tinyint DEFAULT 0,
	`bankEnabled` tinyint DEFAULT 0,
	`cashEnabled` tinyint DEFAULT 1,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `payment_method_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `procedure_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`date` datetime NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`clientDob` datetime,
	`artistLicenceNumber` varchar(100) NOT NULL,
	`amountPaid` int NOT NULL,
	`paymentMethod` varchar(50) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `procedure_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`level` enum('debug','info','warn','error') NOT NULL DEFAULT 'info',
	`category` varchar(100) NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`userId` varchar(64),
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `system_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `issued_promotions` DROP FOREIGN KEY `issued_promotions_clientId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `push_subscriptions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `appointments` MODIFY COLUMN `status` enum('pending','confirmed','cancelled','completed','no-show') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `client_content` MODIFY COLUMN `client_id` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `client_content` MODIFY COLUMN `artist_id` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `client_notes` MODIFY COLUMN `artist_id` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `client_notes` MODIFY COLUMN `client_id` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `notificationSettings` MODIFY COLUMN `userId` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `actualStartTime` datetime;--> statement-breakpoint
ALTER TABLE `appointments` ADD `actualEndTime` datetime;--> statement-breakpoint
ALTER TABLE `appointments` ADD `clientArrived` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `appointments` ADD `clientPaid` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `appointments` ADD `amountPaid` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `payment_method` enum('stripe','paypal','bank','cash');--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `licenceNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `consentTemplate` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `medicalTemplate` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `form9Template` text;--> statement-breakpoint
ALTER TABLE `appointment_logs` ADD CONSTRAINT `appointment_logs_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_logs` ADD CONSTRAINT `appointment_logs_performedBy_users_id_fk` FOREIGN KEY (`performedBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consent_forms` ADD CONSTRAINT `consent_forms_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consent_forms` ADD CONSTRAINT `consent_forms_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consent_forms` ADD CONSTRAINT `consent_forms_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_method_settings` ADD CONSTRAINT `payment_method_settings_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedure_logs` ADD CONSTRAINT `procedure_logs_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedure_logs` ADD CONSTRAINT `procedure_logs_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedure_logs` ADD CONSTRAINT `procedure_logs_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `system_logs` ADD CONSTRAINT `system_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `log_appt_idx` ON `appointment_logs` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `cf_client_idx` ON `consent_forms` (`clientId`);--> statement-breakpoint
CREATE INDEX `cf_artist_idx` ON `consent_forms` (`artistId`);--> statement-breakpoint
CREATE INDEX `cf_appointment_idx` ON `consent_forms` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `pms_artist_idx` ON `payment_method_settings` (`artistId`);--> statement-breakpoint
CREATE INDEX `pl_artist_idx` ON `procedure_logs` (`artistId`);--> statement-breakpoint
CREATE INDEX `pl_client_idx` ON `procedure_logs` (`clientId`);--> statement-breakpoint
CREATE INDEX `pl_appointment_idx` ON `procedure_logs` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `sl_level_idx` ON `system_logs` (`level`);--> statement-breakpoint
CREATE INDEX `sl_category_idx` ON `system_logs` (`category`);--> statement-breakpoint
CREATE INDEX `sl_user_idx` ON `system_logs` (`userId`);--> statement-breakpoint
ALTER TABLE `issued_promotions` ADD CONSTRAINT `issued_promotions_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `conv_artist_idx` ON `conversations` (`artistId`);--> statement-breakpoint
CREATE INDEX `conv_client_idx` ON `conversations` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_templateId` ON `issued_promotions` (`templateId`);--> statement-breakpoint
CREATE INDEX `idx_templateId` ON `issued_vouchers` (`templateId`);--> statement-breakpoint
CREATE INDEX `msg_conversation_idx` ON `messages` (`conversationId`);