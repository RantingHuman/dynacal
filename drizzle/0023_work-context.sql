-- Working Hours become the first Context, "Work", which is the Default Context (ADR 0007). Every Task, complete or
-- not, goes in it. An install that hasn't saved its hours yet and has no Tasks gets no Context: setup creates Work
-- when the owner first saves their hours. Tasks is rebuilt for its new non-null column; `openDatabase` migrates
-- with foreign keys off, so dropping the old table doesn't cascade to Blocks.
CREATE TABLE `contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`windows` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contexts_one_default` ON `contexts` (`is_default`) WHERE "contexts"."is_default" = 1;--> statement-breakpoint
INSERT INTO `contexts` (`id`, `name`, `windows`, `is_default`)
SELECT lower(hex(randomblob(16))), 'Work', COALESCE(
  (SELECT `working_hours` FROM `settings` WHERE `id` = 1),
  '{"mon":[{"start":540,"end":1020}],"tue":[{"start":540,"end":1020}],"wed":[{"start":540,"end":1020}],"thu":[{"start":540,"end":1020}],"fri":[{"start":540,"end":1020}],"sat":[],"sun":[]}'
), 1
WHERE EXISTS (SELECT 1 FROM `settings`) OR EXISTS (SELECT 1 FROM `tasks`);
--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text NOT NULL,
	`estimated_minutes` integer NOT NULL,
	`deadline_date` text,
	`deadline_time` text,
	`earliest_start_date` text,
	`earliest_start_time` text,
	`priority` text NOT NULL,
	`splittable` integer NOT NULL,
	`created_at` integer NOT NULL,
	`schedule_flag` text,
	`completed_at` integer,
	`context_id` text NOT NULL,
	FOREIGN KEY (`context_id`) REFERENCES `contexts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "title", "notes", "estimated_minutes", "deadline_date", "deadline_time", "earliest_start_date", "earliest_start_time", "priority", "splittable", "created_at", "schedule_flag", "completed_at", "context_id")
SELECT "id", "title", "notes", "estimated_minutes", "deadline_date", "deadline_time", "earliest_start_date", "earliest_start_time", "priority", "splittable", "created_at", "schedule_flag", "completed_at",
  (SELECT `id` FROM `contexts` WHERE `is_default` = 1)
FROM `tasks` ORDER BY rowid;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `working_hours`;
