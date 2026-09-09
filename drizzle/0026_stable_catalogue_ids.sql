ALTER TABLE `products` ADD `externalId` varchar(255);
--> statement-breakpoint
ALTER TABLE `productVariants` ADD `externalId` varchar(255);
--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_external_unique` UNIQUE (`artistId`,`externalId`);
--> statement-breakpoint
ALTER TABLE `productVariants` ADD CONSTRAINT `productVariants_external_unique` UNIQUE (`productId`,`externalId`);
--> statement-breakpoint
ALTER TABLE `orderItems` ADD `productName` varchar(500);
--> statement-breakpoint
ALTER TABLE `studios` ADD `stripeCheckoutSessionId` varchar(255);
--> statement-breakpoint
ALTER TABLE `orders` ADD `currency` varchar(3) NOT NULL DEFAULT 'aud';
