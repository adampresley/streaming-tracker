import { db } from "../app/db.server";
import {
  users,
  platforms,
  shows,
  showsToUsers,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Clear existing data
  await db.delete(showsToUsers);
  await db.delete(shows);
  await db.delete(platforms);
  await db.delete(users);

  // Create Users
  const [adam, maryanne] = await db
    .insert(users)
    .values([{ name: "Adam" }, { name: "Maryanne" }])
    .returning();

  console.log(`Created users:`, adam, maryanne);

  // Create Platforms
  const [hulu, max, apple] = await db
    .insert(platforms)
    .values([{ name: "Hulu" }, { name: "Max" }, { name: "Apple TV+" }])
    .returning();

  console.log(`Created platforms:`, hulu, max, apple);

  // Create Shows
  const [archer, lazarus, thisIsUs, palmRoyale, severance, silo, got] =
    await db
      .insert(shows)
      .values([
        { name: "Archer", totalSeasons: 14, platformId: hulu.id },
        { name: "Lazarus", totalSeasons: 1, platformId: max.id },
        { name: "This is Us", totalSeasons: 6, platformId: hulu.id },
        { name: "Palm Royale", totalSeasons: 1, platformId: apple.id },
        { name: "Severance", totalSeasons: 1, platformId: apple.id },
        { name: "Silo", totalSeasons: 1, platformId: apple.id },
        { name: "Game of Thrones", totalSeasons: 8, platformId: max.id },
      ])
      .returning();

  console.log("Created shows");

  // Link shows to users
  // Currently Watching
  await db.insert(showsToUsers).values([
    // Adam watching Archer
    {
      userId: adam.id,
      showId: archer.id,
      status: "IN_PROGRESS",
      currentSeason: 14,
    },
    // Adam watching Lazarus
    {
      userId: adam.id,
      showId: lazarus.id,
      status: "IN_PROGRESS",
      currentSeason: 1,
    },
    // Maryanne watching This is Us
    {
      userId: maryanne.id,
      showId: thisIsUs.id,
      status: "IN_PROGRESS",
      currentSeason: 3, // Just an example
    },
    // Both watching Palm Royale
    {
      userId: adam.id,
      showId: palmRoyale.id,
      status: "IN_PROGRESS",
      currentSeason: 1,
    },
    {
      userId: maryanne.id,
      showId: palmRoyale.id,
      status: "IN_PROGRESS",
      currentSeason: 1,
    },
  ]);

  // Want to Watch
  await db.insert(showsToUsers).values([
    // Both want to watch Severance
    {
      userId: adam.id,
      showId: severance.id,
      status: "WANT_TO_WATCH",
    },
    {
      userId: maryanne.id,
      showId: severance.id,
      status: "WANT_TO_WATCH",
    },
    // Adam wants to watch Silo
    {
      userId: adam.id,
      showId: silo.id,
      status: "WANT_TO_WATCH",
    },
  ]);

  // Finished
  await db.insert(showsToUsers).values([
    // Both finished Game of Thrones
    {
      userId: adam.id,
      showId: got.id,
      status: "FINISHED",
      currentSeason: 8,
      finishedAt: new Date(),
    },
    {
      userId: maryanne.id,
      showId: got.id,
      status: "FINISHED",
      currentSeason: 8,
      finishedAt: new Date(),
    },
  ]);

  console.log("Database seeded successfully!");
}

seed().catch((error) => {
  console.error("Error seeding database:", error);
  process.exit(1);
});
