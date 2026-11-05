-- The Google connection keeps one status instead of `broken_at`. A connection Google hasn't refused is healthy; one
-- it refused (or that never got an answer, which was stored the same way and shows the same "reconnect") is
-- refused. Its dynacal calendar and every other column carry over as they were.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_google_connection` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`refresh_token` text NOT NULL,
	`access_token` text,
	`access_token_expires_at` integer,
	`connected_at` integer NOT NULL,
	`status` text NOT NULL,
	`dynacal_calendar_id` text,
	`busy_calendars_chosen_at` integer,
	CONSTRAINT "google_connection_status" CHECK("status" IN ('unverified', 'healthy', 'refused')),
	CONSTRAINT "google_connection_unverified_has_no_calendar" CHECK("status" <> 'unverified' OR "dynacal_calendar_id" IS NULL)
);
--> statement-breakpoint
INSERT INTO `__new_google_connection`("id", "email", "refresh_token", "access_token", "access_token_expires_at", "connected_at", "status", "dynacal_calendar_id", "busy_calendars_chosen_at") SELECT "id", "email", "refresh_token", "access_token", "access_token_expires_at", "connected_at", CASE WHEN "broken_at" IS NULL THEN 'healthy' ELSE 'refused' END, "dynacal_calendar_id", "busy_calendars_chosen_at" FROM `google_connection`;--> statement-breakpoint
DROP TABLE `google_connection`;--> statement-breakpoint
ALTER TABLE `__new_google_connection` RENAME TO `google_connection`;--> statement-breakpoint
PRAGMA foreign_keys=ON;