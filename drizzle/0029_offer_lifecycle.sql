CREATE TABLE `offer_balance_checkouts` (`id` int AUTO_INCREMENT PRIMARY KEY, `bookingId` int NOT NULL, `requestId` int NULL, `offerId` int NULL, `activeKey` varchar(64) NULL, `clientId` varchar(64) NOT NULL, `artistId` varchar(64) NOT NULL, `quoteJson` text NOT NULL, `originalJson` text NOT NULL, `paymentId` varchar(255) NULL, `status` enum('reserved','paid','cancelled') NOT NULL DEFAULT 'reserved', `createdAt` datetime NOT NULL, UNIQUE KEY `offer_balance_active` (`activeKey`), UNIQUE KEY `offer_balance_payment` (`paymentId`));
--> statement-breakpoint
CREATE TABLE `offer_credit_restorations` (`id` int AUTO_INCREMENT PRIMARY KEY, `sourceKey` varchar(100) NOT NULL, `bookingId` int NOT NULL, `offerId` int NOT NULL, `restoredOfferId` int NOT NULL, `clientId` varchar(64) NOT NULL, `amountCents` int NOT NULL, `createdAt` datetime NOT NULL, UNIQUE KEY `offer_restore_source` (`sourceKey`));
--> statement-breakpoint
CREATE TABLE `offer_preferences` (`userId` varchar(64) PRIMARY KEY, `push` tinyint NOT NULL DEFAULT 0, `sms` tinyint NOT NULL DEFAULT 0, `verifiedPhone` varchar(20) NULL, `updatedAt` datetime NOT NULL);
--> statement-breakpoint
CREATE TABLE `offer_deliveries` (`id` int AUTO_INCREMENT PRIMARY KEY, `offerId` int NOT NULL, `clientId` varchar(64) NOT NULL, `channel` enum('sms','push') NOT NULL, `status` enum('pending','sending','accepted','delivered','failed','unknown','skipped') NOT NULL DEFAULT 'pending', `providerId` varchar(255) NULL, `error` text NULL, `attempts` int NOT NULL DEFAULT 0, `updatedAt` datetime NOT NULL, UNIQUE KEY `offer_delivery_once` (`offerId`,`channel`));
--> statement-breakpoint
CREATE TABLE `offer_sms_challenges` (`userId` varchar(64) PRIMARY KEY, `phone` varchar(20) NOT NULL, `codeHash` varchar(64) NOT NULL, `attempts` int NOT NULL DEFAULT 0, `sendCount` int NOT NULL DEFAULT 0, `windowStart` datetime NOT NULL, `createdAt` datetime NOT NULL, `expiresAt` datetime NOT NULL);
--> statement-breakpoint
ALTER TABLE `payment_ledger` MODIFY COLUMN `ledger_transaction_type` enum('deposit','balance','refund','dispute','payout','store_order','voucher_sale') NOT NULL;
--> statement-breakpoint
CREATE TABLE `offer_plan_checkout_versions` (`planId` int PRIMARY KEY, `version` int NOT NULL DEFAULT 0);
