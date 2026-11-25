CREATE TABLE `team` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_team_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `team_userId_idx` ON `team` (`user_id`);