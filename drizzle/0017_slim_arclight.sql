ALTER TABLE `messages` MODIFY COLUMN `messageType` enum('text','system','appointment_request','appointment_confirmed','image','video','studio_invite') NOT NULL DEFAULT 'text';--> statement-breakpoint
ALTER TABLE `studio_members` MODIFY COLUMN `status` enum('active','inactive','pending_invite','declined') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `studios` ADD `publicSlug` varchar(50);--> statement-breakpoint
ALTER TABLE `studios` ADD `funnelEnabled` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `studios` ADD `logoUrl` text;--> statement-breakpoint
ALTER TABLE `studios` ADD `description` text;--> statement-breakpoint
ALTER TABLE `studios` ADD CONSTRAINT `studios_publicSlug_unique` UNIQUE(`publicSlug`);