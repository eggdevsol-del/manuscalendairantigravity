CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`keys` text NOT NULL,
	`userAgent` varchar(255),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `pushSubscriptions`;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `push_subscriptions` (`userId`);