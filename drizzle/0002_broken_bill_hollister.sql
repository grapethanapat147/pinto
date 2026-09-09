CREATE TABLE `recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`scope` text NOT NULL,
	`kicker` text NOT NULL,
	`title_template` text NOT NULL,
	`title_amount_satang` integer,
	`body_template` text NOT NULL,
	`body_amount_satang` integer,
	`figure_label` text,
	`figure_satang` integer,
	`figure_prefix` text,
	`figure_suffix` text,
	`cta_label` text NOT NULL,
	`secondary_cta_label` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendations_shop_scope` ON `recommendations` (`shop_id`,`scope`);