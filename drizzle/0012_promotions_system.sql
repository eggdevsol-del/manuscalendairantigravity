-- Promotions System Migration
-- Creates tables for vouchers, discounts, and credits

-- Promotion Templates (artist-created)
CREATE TABLE IF NOT EXISTS `promotion_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
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
  `backgroundScale` decimal(3,2) DEFAULT 1.00,
  `backgroundPositionX` int DEFAULT 50,
  `backgroundPositionY` int DEFAULT 50,
  `isActive` tinyint DEFAULT 1,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_artist_templates` (`artistId`, `type`),
  CONSTRAINT `promotion_templates_artistId_fk` FOREIGN KEY (`artistId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Issued Promotions (instances sent to clients)
CREATE TABLE IF NOT EXISTS `issued_promotions` (
  `id` int NOT NULL AUTO_INCREMENT,
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
  `redeemedAt` timestamp NULL,
  `redeemedOnAppointmentId` int,
  `expiresAt` datetime,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `issued_promotions_code` (`code`),
  KEY `idx_client_promotions` (`clientId`, `status`),
  KEY `idx_artist_promotions` (`artistId`, `status`),
  KEY `idx_auto_apply` (`isAutoApply`, `autoApplyStartDate`, `autoApplyEndDate`),
  CONSTRAINT `issued_promotions_templateId_fk` FOREIGN KEY (`templateId`) REFERENCES `promotion_templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `issued_promotions_artistId_fk` FOREIGN KEY (`artistId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `issued_promotions_clientId_fk` FOREIGN KEY (`clientId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Promotion Redemptions (tracking usage)
CREATE TABLE IF NOT EXISTS `promotion_redemptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `promotionId` int NOT NULL,
  `appointmentId` int NOT NULL,
  `amountRedeemed` int NOT NULL,
  `originalBookingAmount` int NOT NULL,
  `finalBookingAmount` int NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_promotion_redemptions` (`promotionId`),
  KEY `idx_appointment_redemptions` (`appointmentId`),
  CONSTRAINT `promotion_redemptions_promotionId_fk` FOREIGN KEY (`promotionId`) REFERENCES `issued_promotions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promotion_redemptions_appointmentId_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
