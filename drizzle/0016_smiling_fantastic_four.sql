CREATE TABLE `studio_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`role` enum('owner','manager','artist','apprentice') NOT NULL DEFAULT 'artist',
	`status` enum('active','inactive','pending_invite') NOT NULL DEFAULT 'active',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `studio_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `studio_user_unique` UNIQUE(`studioId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `studios` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`ownerId` varchar(64) NOT NULL,
	`stripeSubscriptionId` varchar(255),
	`subscriptionStatus` enum('active','past_due','canceled','trialing') DEFAULT 'active',
	`subscriptionTier` enum('solo','studio') DEFAULT 'solo',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `studios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD `studioId` varchar(64);--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `displayName` varchar(255);--> statement-breakpoint
ALTER TABLE `conversations` ADD `studioId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `city` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `savedSignature` longtext;--> statement-breakpoint
ALTER TABLE `studio_members` ADD CONSTRAINT `studio_members_studioId_studios_id_fk` FOREIGN KEY (`studioId`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studio_members` ADD CONSTRAINT `studio_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studios` ADD CONSTRAINT `studios_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;