import { db } from "../app/db.server";
import { platforms } from "../drizzle/schema";

const platformList: string[] = [
   "Netflix",
   "Prime Video",
   "HBO Max",
   "Hulu",
   "Disney+",
   "Peacock",
   "Apple TV+",
   "Crunchyroll",
   "Paramount+",
   "Tubi",
   "Acorn TV",
   "AMC+",
   "BritBox",
   "Fubo",
];

export async function seed() {
   console.log("Seeding platforms...");

   await db
      .insert(platforms)
      .values(platformList.map((name) => ({ name })))
      .onConflictDoNothing();

   console.log("Platforms seeded successfully!");
}
