CREATE TABLE `ad_spend_daily` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`day` text NOT NULL,
	`spend_satang` integer NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_spend_daily_key` ON `ad_spend_daily` (`shop_id`,`channel_id`,`day`);