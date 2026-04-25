-- Add googleSub column to users table for stable Google OAuth identity matching
-- This prevents email alias mismatches with Google Workspace accounts
ALTER TABLE `users` ADD COLUMN `googleSub` varchar(255);
