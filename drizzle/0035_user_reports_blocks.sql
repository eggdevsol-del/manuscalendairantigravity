CREATE TABLE IF NOT EXISTS `user_reports` (
  `id` int AUTO_INCREMENT NOT NULL,
  `reporterId` varchar(64),
  `reportedUserId` varchar(64),
  `conversationId` int,
  `messageId` int,
  `artistSlug` varchar(100),
  `reason` enum('harassment','sexual_content','hate','scam','underage','other') NOT NULL,
  `details` text,
  `status` enum('open','reviewed','actioned') NOT NULL DEFAULT 'open',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  INDEX `user_reports_reporter` (`reporterId`,`createdAt`),
  INDEX `user_reports_status` (`status`,`createdAt`),
  CONSTRAINT `user_reports_reporter_fk` FOREIGN KEY (`reporterId`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `user_reports_reported_fk` FOREIGN KEY (`reportedUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_blocks` (
  `blockerId` varchar(64) NOT NULL,
  `blockedId` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`blockerId`,`blockedId`),
  INDEX `user_blocks_blocked` (`blockedId`),
  CONSTRAINT `user_blocks_blocker_fk` FOREIGN KEY (`blockerId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_blocks_blocked_fk` FOREIGN KEY (`blockedId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
