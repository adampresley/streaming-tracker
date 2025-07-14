import { db } from "../app/db.server";
import { showsToUsers, shows, platforms, users } from "../drizzle/schema";

async function clearDb() {
	console.log("Clearing database...");

	await db.delete(showsToUsers);
	await db.delete(shows);
	await db.delete(platforms);
	await db.delete(users);

	console.log("Database cleared.");
}

clearDb().catch((err) => {
	console.error(err);
	process.exit(1);
});