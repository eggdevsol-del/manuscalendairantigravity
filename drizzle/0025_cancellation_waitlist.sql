CREATE TABLE `waitlist_entries` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `artistId` varchar(64) NOT NULL,
  `clientId` varchar(64) NOT NULL,
  `conversationId` int NOT NULL,
  `note` varchar(500) NOT NULL DEFAULT '',
  `status` enum('waiting','offered','accepted','declined','cancelled') NOT NULL DEFAULT 'waiting',
  `startsAt` datetime,
  `durationMinutes` int,
  `estimateCents` int,
  `depositCents` int,
  `expiresAt` datetime,
  `sessionPlanId` int,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  INDEX `waitlist_artist_status_idx` (`artistId`,`status`),
  INDEX `waitlist_client_idx` (`clientId`)
);
