import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
   id: integer("id").primaryKey(),
   name: text("name").notNull().unique(),
});

export const platforms = sqliteTable("platforms", {
   id: integer("id").primaryKey(),
   name: text("name").notNull().unique(),
});

export const shows = sqliteTable("shows", {
   id: integer("id").primaryKey(),
   name: text("name").notNull(),
   totalSeasons: integer("total_seasons").notNull(),
   platformId: integer("platform_id")
      .notNull()
      .references(() => platforms.id),
   cancelled: integer("cancelled", { mode: "boolean" }).notNull().default(false),
});

export const showsToUsers = sqliteTable("shows_to_users", {
   showId: integer("show_id")
      .notNull()
      .references(() => shows.id),
   userId: integer("user_id")
      .notNull()
      .references(() => users.id),
   status: text("status", {
      enum: ["WANT_TO_WATCH", "IN_PROGRESS", "FINISHED"],
   })
      .notNull()
      .default("WANT_TO_WATCH"),
   currentSeason: integer("current_season").notNull().default(1),
   finishedAt: integer("finished_at", { mode: "timestamp" }),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
   showsToUsers: many(showsToUsers),
}));

export const platformsRelations = relations(platforms, ({ many }) => ({
   shows: many(shows),
}));

export const showsRelations = relations(shows, ({ one, many }) => ({
   platform: one(platforms, {
      fields: [shows.platformId],
      references: [platforms.id],
   }),
   showsToUsers: many(showsToUsers),
}));

export const showsToUsersRelations = relations(showsToUsers, ({ one }) => ({
   show: one(shows, {
      fields: [showsToUsers.showId],
      references: [shows.id],
   }),
   user: one(users, {
      fields: [showsToUsers.userId],
      references: [users.id],
   }),
}));
