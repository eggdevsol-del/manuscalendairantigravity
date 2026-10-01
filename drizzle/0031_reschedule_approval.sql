CREATE TABLE `reschedule_requests` (
 `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
 `appointmentId` int NOT NULL, `artistId` varchar(64) NOT NULL, `clientId` varchar(64) NOT NULL, `conversationId` int NOT NULL,
 `startsAt` datetime NOT NULL, `endsAt` datetime NOT NULL, `expiresAt` datetime NOT NULL,
 `status` enum('pending','accepted','declined','withdrawn','expired') NOT NULL DEFAULT 'pending',
 `termsJson` text NOT NULL, `createdAt` datetime NOT NULL, `resolvedAt` datetime,
 INDEX `reschedule_hold_artist` (`artistId`,`status`,`expiresAt`), INDEX `reschedule_booking` (`appointmentId`)
);
