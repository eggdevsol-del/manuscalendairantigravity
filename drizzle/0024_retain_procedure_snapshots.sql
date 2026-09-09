-- Keep immutable snapshots independently of deletable live accounts and appointments.
ALTER TABLE `procedure_logs` DROP FOREIGN KEY `procedure_logs_appointmentId_appointments_id_fk`;
--> statement-breakpoint
ALTER TABLE `procedure_logs` DROP FOREIGN KEY `procedure_logs_artistId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `procedure_logs` DROP FOREIGN KEY `procedure_logs_clientId_users_id_fk`;
