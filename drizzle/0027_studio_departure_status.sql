ALTER TABLE `studio_members` MODIFY COLUMN `status` enum('active','inactive','pending_invite','declined','removed') NOT NULL DEFAULT 'active';
