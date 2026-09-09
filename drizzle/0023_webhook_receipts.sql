CREATE TABLE IF NOT EXISTS `stripe_webhook_events` (
  `id` varchar(255) PRIMARY KEY,
  `eventId` varchar(255) NOT NULL,
  `eventType` varchar(100) NOT NULL,
  `processedAt` datetime NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP
);
