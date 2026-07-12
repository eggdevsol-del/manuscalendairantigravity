ALTER TABLE `artistSettings` ADD `showEmail` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `showPhone` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `showCity` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `showWebsite` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `artistSettings` ADD `websiteUrl` text;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `sortOrder` int DEFAULT 0;