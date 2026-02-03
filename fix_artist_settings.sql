-- Manual migration to add missing columns to artistSettings table
-- Run this in your MySQL client to fix the "Failed query" error

ALTER TABLE `artistSettings` ADD COLUMN IF NOT EXISTS `businessEmail` varchar(320);
ALTER TABLE `artistSettings` ADD COLUMN IF NOT EXISTS `autoSendDepositInfo` tinyint DEFAULT 0;
ALTER TABLE `artistSettings` ADD COLUMN IF NOT EXISTS `publicSlug` varchar(50);
ALTER TABLE `artistSettings` ADD COLUMN IF NOT EXISTS `funnelEnabled` tinyint DEFAULT 0;
ALTER TABLE `artistSettings` ADD COLUMN IF NOT EXISTS `funnelWelcomeMessage` text;
ALTER TABLE `artistSettings` ADD COLUMN IF NOT EXISTS `styleOptions` text;
ALTER TABLE `artistSettings` ADD COLUMN IF NOT EXISTS `placementOptions` text;
ALTER TABLE `artistSettings` ADD COLUMN IF NOT EXISTS `budgetRanges` text;

-- Add unique constraint on publicSlug if it doesn't exist
ALTER TABLE `artistSettings` ADD UNIQUE INDEX IF NOT EXISTS `artistSettings_publicSlug_unique` (`publicSlug`);
