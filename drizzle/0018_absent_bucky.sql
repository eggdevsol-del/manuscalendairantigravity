CREATE TABLE `payment_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int,
	`artistId` varchar(64),
	`clientId` varchar(64),
	`ledger_transaction_type` enum('deposit','balance','refund','dispute','payout') NOT NULL,
	`amountCents` int NOT NULL,
	`platformFeeCents` int NOT NULL DEFAULT 0,
	`artistFeeCents` int NOT NULL DEFAULT 0,
	`processingCostEstimateCents` int DEFAULT 0,
	`stripePaymentId` varchar(255),
	`stripeConnectAccountId` varchar(255),
	`ledger_payout_status` enum('pending','scheduled','processing','paid','held') DEFAULT 'pending',
	`ledger_tier` enum('free','pro','top') DEFAULT 'free',
	`paymentMethod` varchar(30),
	`metadata` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `payment_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `consultations` MODIFY COLUMN `clientId` varchar(64);--> statement-breakpoint
ALTER TABLE `conversations` MODIFY COLUMN `clientId` varchar(64);--> statement-breakpoint
ALTER TABLE `appointments` ADD `depositPaymentId` varchar(255);--> statement-breakpoint
ALTER TABLE `appointments` ADD `balancePaymentId` varchar(255);--> statement-breakpoint
ALTER TABLE `appointments` ADD `totalExpectedAmountCents` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `totalPaidAmountCents` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `appointments` ADD `remainingBalanceCents` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `payment_status` enum('pending_deposit','deposit_paid','fully_paid','refunded') DEFAULT 'pending_deposit';--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `businessCountry` varchar(2) DEFAULT 'AU' NOT NULL;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `sendAutomatedReminders` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `funnelTheme` varchar(10) DEFAULT 'light';--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `funnelBannerUrl` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `googleCalendarToken` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `appleCalendarUrl` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `travelDates` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `subscriptionTier` enum('basic','pro','elite') DEFAULT 'basic';--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `stripeSubscriptionId` varchar(255);--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `subscriptionStatus` enum('active','past_due','canceled','trialing') DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `stripeConnectAccountId` varchar(255);--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `stripeConnectOnboardingComplete` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `stripeConnectPayoutsEnabled` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `stripe_connect_account_type` enum('standard','express') DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `stripeConnectDetailsSubmitted` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `depositPercentage` int DEFAULT 25;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `allowUpfrontPayment` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `instantPayoutsEnabled` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `leads` ADD `stripeCheckoutSessionId` varchar(255);--> statement-breakpoint
ALTER TABLE `promotion_templates` ADD `fontFamily` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `country` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `gender` enum('male','female','other','prefer_not_to_say');--> statement-breakpoint
ALTER TABLE `payment_ledger` ADD CONSTRAINT `payment_ledger_bookingId_appointments_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `appointments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_ledger` ADD CONSTRAINT `payment_ledger_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_ledger` ADD CONSTRAINT `payment_ledger_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ledger_booking_idx` ON `payment_ledger` (`bookingId`);--> statement-breakpoint
CREATE INDEX `ledger_artist_idx` ON `payment_ledger` (`artistId`);--> statement-breakpoint
CREATE INDEX `ledger_type_idx` ON `payment_ledger` (`ledger_transaction_type`);--> statement-breakpoint
CREATE INDEX `ledger_stripe_idx` ON `payment_ledger` (`stripePaymentId`);