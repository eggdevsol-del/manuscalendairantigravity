CREATE TABLE IF NOT EXISTS `artist_practice_sessions` (
  `artist_id` varchar(64) NOT NULL,
  `revision` int NOT NULL DEFAULT 0,
  `state` longtext NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`artist_id`),
  CONSTRAINT `artist_practice_sessions_artist_fk` FOREIGN KEY (`artist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
