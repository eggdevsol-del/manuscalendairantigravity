-- Payment Requests table
-- Artist-initiated charge requests. Client pays via Stripe Checkout.
-- Status lifecycle: pending → paid | expired | cancelled

CREATE TABLE IF NOT EXISTS `payment_requests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `appointmentId` int NOT NULL,
  `artistId` varchar(64) NOT NULL,
  `clientId` varchar(64) NOT NULL,
  `amountCents` int NOT NULL,
  `status` enum('pending','paid','expired','cancelled') NOT NULL DEFAULT 'pending',
  `token` varchar(255) NOT NULL,
  `stripeCheckoutSessionId` varchar(255),
  `createdAt` timestamp DEFAULT (now()),
  `expiresAt` timestamp,
  `paidAt` timestamp,
  CONSTRAINT `payment_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pr_appointment_idx` ON `payment_requests` (`appointmentId`);
--> statement-breakpoint
CREATE INDEX `pr_artist_idx` ON `payment_requests` (`artistId`);
--> statement-breakpoint
CREATE INDEX `pr_client_idx` ON `payment_requests` (`clientId`);
--> statement-breakpoint
CREATE INDEX `pr_token_idx` ON `payment_requests` (`token`);
--> statement-breakpoint
CREATE INDEX `pr_status_idx` ON `payment_requests` (`status`);
--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_artistId_users_id_fk` FOREIGN KEY (`artistId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
