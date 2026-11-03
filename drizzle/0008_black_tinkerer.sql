CREATE TABLE `action_snoozes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`card_key` text NOT NULL,
	`until` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `action_snoozes_key` ON `action_snoozes` (`shop_id`,`card_key`);--> statement-breakpoint
ALTER TABLE `shops` ADD `pack_window_hours` integer DEFAULT 24 NOT NULL;