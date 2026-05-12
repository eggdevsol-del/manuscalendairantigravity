CREATE TABLE `error_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`message` varchar(2000) NOT NULL,
	`stack` text,
	`componentStack` text,
	`boundary` varchar(100),
	`url` varchar(500),
	`userId` int,
	`userRole` varchar(50),
	`userAgent` varchar(500),
	`appVersion` varchar(50),
	`metadata` text,
	`resolved` tinyint NOT NULL DEFAULT 0,
	CONSTRAINT `error_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`seminarId` int,
	`quantity` int NOT NULL DEFAULT 1,
	`priceAtPurchaseCents` int NOT NULL,
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`clientId` varchar(64),
	`totalAmountCents` int NOT NULL,
	`platformFeeCents` int NOT NULL,
	`artistFeeCents` int NOT NULL,
	`status` enum('pending','paid','fulfilled','cancelled') NOT NULL DEFAULT 'pending',
	`fulfillmentMethod` enum('pickup','delivery','digital') NOT NULL DEFAULT 'pickup',
	`shippingAddress` text,
	`shippingCostCents` int NOT NULL DEFAULT 0,
	`buyerName` varchar(255),
	`buyerEmail` varchar(255),
	`buyerPhone` varchar(255),
	`stripeCheckoutSessionId` varchar(255),
	`stripePaymentIntentId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`priceCents` int NOT NULL,
	`inventoryCount` int NOT NULL DEFAULT 0,
	`fulfillmentType` enum('pickup','delivery','both','digital') NOT NULL DEFAULT 'pickup',
	`shippingCents` int NOT NULL DEFAULT 0,
	`imageUrl` text,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seminars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`type` enum('in_person','virtual') NOT NULL DEFAULT 'in_person',
	`date` datetime NOT NULL,
	`locationUrl` text,
	`capacity` int NOT NULL,
	`priceCents` int NOT NULL,
	`ticketsSold` int NOT NULL DEFAULT 0,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seminars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `artistSettings` MODIFY COLUMN `stripe_connect_account_type` enum('standard','express','custom') DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE `payment_ledger` MODIFY COLUMN `ledger_transaction_type` enum('deposit','balance','refund','dispute','payout','store_order') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `googleSub` varchar(255);--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_seminarId_seminars_id_fk` FOREIGN KEY (`seminarId`) REFERENCES `seminars`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seminars` ADD CONSTRAINT `seminars_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;