CREATE TABLE `channel_health` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`state` text NOT NULL,
	`detail` text,
	`last_synced_at` text,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_health_channel` ON `channel_health` (`channel_id`);--> statement-breakpoint
ALTER TABLE `channels` ADD `short_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `channels` ADD `accent` text DEFAULT 'tiktok' NOT NULL;