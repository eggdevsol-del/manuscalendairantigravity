CREATE TABLE `design_briefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversation_id` int NOT NULL,
	`artist_id` varchar(64) NOT NULL,
	`brief_text` text NOT NULL,
	`message_count` int NOT NULL,
	`last_tagged_at` timestamp,
	`generated_at` timestamp DEFAULT (now()),
	CONSTRAINT `design_briefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `favourite_artists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`artistId` varchar(64) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `favourite_artists_id` PRIMARY KEY(`id`),
	CONSTRAINT `fav_client_artist` UNIQUE(`clientId`,`artistId`)
);
--> statement-breakpoint
CREATE TABLE `merchantAccountingLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantId` int NOT NULL,
	`orderId` int,
	`poId` int,
	`xeroInvoiceId` varchar(100),
	`xeroBillId` varchar(100),
	`status` enum('success','failed','pending'),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merchantAccountingLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`country` varchar(2) NOT NULL DEFAULT 'AU',
	`abn` varchar(20),
	`nzbn` varchar(20),
	`contactName` varchar(255),
	`phone` varchar(50),
	`address` text,
	`integrationType` enum('shopify','native') DEFAULT 'native',
	`shopifyDomain` varchar(255),
	`shopifyToken` text,
	`shopifyShopId` varchar(100),
	`stripeAccountId` varchar(100),
	`xeroTenantId` varchar(100),
	`xeroAccessToken` text,
	`xeroRefreshToken` text,
	`xeroTokenExpiry` timestamp,
	`lowStockThreshold` int NOT NULL DEFAULT 5,
	`myobAccessToken` text,
	`shippitApiKey` varchar(255),
	`status` enum('pending','active','suspended') DEFAULT 'pending',
	`verified` tinyint DEFAULT 0,
	`claimed` tinyint DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merchants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`message_id` int NOT NULL,
	`conversation_id` int NOT NULL,
	`artist_id` varchar(64) NOT NULL,
	`tag` varchar(30) NOT NULL DEFAULT 'design',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `message_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`sortOrder` int DEFAULT 0,
	`isPrimary` tinyint DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productVariants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`priceCents` int NOT NULL,
	`inventoryCount` int NOT NULL DEFAULT 0,
	`sku` varchar(100),
	`imageUrl` text,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productVariants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`poId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`sku` varchar(100),
	`quantityOrdered` int NOT NULL,
	`quantityReceived` int DEFAULT 0,
	`unitCostCents` int NOT NULL,
	`lineTotalCents` int NOT NULL,
	CONSTRAINT `purchaseOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantId` int NOT NULL,
	`poNumber` varchar(50) NOT NULL,
	`supplierName` varchar(255) NOT NULL,
	`supplierEmail` varchar(255),
	`poDate` datetime NOT NULL,
	`expectedDelivery` datetime,
	`status` enum('draft','sent','confirmed','partially_received','received','cancelled') DEFAULT 'draft',
	`notes` text,
	`totalValueCents` int,
	`xeroBillId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockAdjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`adjustment` int NOT NULL,
	`reason` varchar(255),
	`referenceType` enum('sale','po_receive','manual','correction'),
	`referenceId` int,
	`adjustedBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockAdjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplierProductVariants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierProductId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`priceCents` int NOT NULL,
	`sku` varchar(100),
	`inventoryCount` int NOT NULL DEFAULT 0,
	`shopifyVariantId` varchar(255),
	CONSTRAINT `supplierProductVariants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplierProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`priceCents` int,
	`imageUrl` text,
	`shopifyProductId` varchar(255),
	`category` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplierProducts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`websiteUrl` text,
	`logoUrl` text,
	`contactEmail` varchar(255),
	`claimed` tinyint NOT NULL DEFAULT 0,
	`merchantId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `keywords` text;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `lat` decimal(10,7);--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `lng` decimal(10,7);--> statement-breakpoint
ALTER TABLE `orderItems` ADD `variantId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `trackingNumber` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `carrier` varchar(100);--> statement-breakpoint
ALTER TABLE `orders` ADD `dispatchedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `xeroInvoiceId` varchar(100);--> statement-breakpoint
ALTER TABLE `orders` ADD `shopifyOrderId` varchar(100);--> statement-breakpoint
ALTER TABLE `products` ADD `ownerType` enum('artist','merchant') DEFAULT 'artist' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `hasVariants` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `basePriceCents` int;--> statement-breakpoint
ALTER TABLE `design_briefs` ADD CONSTRAINT `design_briefs_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `design_briefs` ADD CONSTRAINT `design_briefs_artist_id_users_id_fk` FOREIGN KEY (`artist_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favourite_artists` ADD CONSTRAINT `favourite_artists_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favourite_artists` ADD CONSTRAINT `favourite_artists_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `merchantAccountingLog` ADD CONSTRAINT `merchantAccountingLog_merchantId_merchants_id_fk` FOREIGN KEY (`merchantId`) REFERENCES `merchants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `merchantAccountingLog` ADD CONSTRAINT `merchantAccountingLog_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `merchantAccountingLog` ADD CONSTRAINT `merchantAccountingLog_poId_purchaseOrders_id_fk` FOREIGN KEY (`poId`) REFERENCES `purchaseOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `merchants` ADD CONSTRAINT `merchants_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_tags` ADD CONSTRAINT `message_tags_message_id_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_tags` ADD CONSTRAINT `message_tags_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_tags` ADD CONSTRAINT `message_tags_artist_id_users_id_fk` FOREIGN KEY (`artist_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productImages` ADD CONSTRAINT `productImages_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productVariants` ADD CONSTRAINT `productVariants_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrderItems` ADD CONSTRAINT `purchaseOrderItems_poId_purchaseOrders_id_fk` FOREIGN KEY (`poId`) REFERENCES `purchaseOrders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD CONSTRAINT `purchaseOrders_merchantId_merchants_id_fk` FOREIGN KEY (`merchantId`) REFERENCES `merchants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockAdjustments` ADD CONSTRAINT `stockAdjustments_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stockAdjustments` ADD CONSTRAINT `stockAdjustments_variantId_productVariants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `productVariants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierProductVariants` ADD CONSTRAINT `supplierProductVariants_supplierProductId_supplierProducts_id_fk` FOREIGN KEY (`supplierProductId`) REFERENCES `supplierProducts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierProducts` ADD CONSTRAINT `supplierProducts_supplierId_suppliers_id_fk` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_brief_conv_artist` ON `design_briefs` (`conversation_id`,`artist_id`);--> statement-breakpoint
CREATE INDEX `idx_conv_artist` ON `message_tags` (`conversation_id`,`artist_id`);--> statement-breakpoint
CREATE INDEX `idx_message` ON `message_tags` (`message_id`);