import { drizzle } from "drizzle-orm/libsql";
import { Client, createClient } from "@libsql/client";
import "dotenv/config";
import * as schema from "../drizzle/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "fs";
import path from "path";
import { seed } from "../db/seed";

if (!process.env.DATABASE_URL) {
   throw new Error("DATABASE_URL is not set in .env file");
}

// This is a self-invoking async function that will run migrations
// on startup.
(async () => {
   const dbUrl: string = process.env.DATABASE_URL || "";

   if (!dbUrl) {
      throw new Error("DATABASE_URL is not set in .env file");
   }

   // We only want to run this for file-based databases.
   if (!dbUrl.startsWith("file:")) {
      return;
   }

   const dbFilePath: string = dbUrl.substring(5);
   const dbDir: string = path.dirname(dbFilePath);

   console.log("Running database migrations...");

   // We need to create a new client and db connection for migrations
   // because the main one is used by the application. We want to
   // close this one after migrations are done.
   const migrationClient: Client = createClient({
      url: dbUrl,
   });

   const migrationDb = drizzle(migrationClient);

   try {
      await migrate(migrationDb, { migrationsFolder: "drizzle/migrations" });
      console.log("Migrations completed successfully.");

      const seededFile: string = path.join(dbDir, ".seeded");
      if (fs.existsSync(seededFile)) {
         return;
      }

      console.log("Database has not been seeded. Seeding now...");
      await seed();
      fs.writeFileSync(seededFile, new Date().toISOString());
   } catch (err) {
      console.error("Error running migrations:", err);
      process.exit(1);
   } finally {
      migrationClient.close();
   }
})();

const client: Client = createClient({
   url: process.env.DATABASE_URL,
});

export const db = drizzle(client, { schema });
