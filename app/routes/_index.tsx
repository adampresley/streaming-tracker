import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ShowCard } from "~/components/ShowCard";
import { db } from "~/db.server";
import { showsToUsers } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "~/auth.server";

// Define the structure of our show data
interface ShowInfo {
   id: number;
   name: string;
   totalSeasons: number;
   currentSeason: number;
   platformName: string;
   watchers: string[];
}

// Define the structure for grouped shows
interface GroupedShows {
   [watcherGroup: string]: ShowInfo[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
   await requireAuth(request);
   // 1. Fetch all shows with their watchers and platform
   const allShowsWithWatchers = await db.query.showsToUsers.findMany({
      with: {
         show: {
            with: {
               platform: true,
            },
         },
         user: true,
      },
      where: inArray(showsToUsers.status, ["IN_PROGRESS", "WANT_TO_WATCH"]),
   });

   // 2. Process the data into a more useful map
   const showsMap = new Map<number, ShowInfo>();
   allShowsWithWatchers.forEach((stu) => {
      const { show, user } = stu;
      if (!showsMap.has(show.id)) {
         showsMap.set(show.id, {
            id: show.id,
            name: show.name,
            totalSeasons: show.totalSeasons,
            currentSeason: stu.currentSeason,
            platformName: show.platform.name,
            watchers: [],
         });
      }
      showsMap.get(show.id)!.watchers.push(user.name);
   });

   // 3. Group shows by status and then by watchers
   const currentlyWatching: GroupedShows = {};
   const wantToWatch: GroupedShows = {};

   allShowsWithWatchers.forEach((stu) => {
      const showInfo = showsMap.get(stu.showId)!;
      const watcherGroup = showInfo.watchers.sort().join(", ");

      if (stu.status === "IN_PROGRESS") {
         if (!currentlyWatching[watcherGroup]) {
            currentlyWatching[watcherGroup] = [];
         }
         // Avoid duplicates
         if (!currentlyWatching[watcherGroup].some((s) => s.id === showInfo.id)) {
            currentlyWatching[watcherGroup].push(showInfo);
         }
      } else if (stu.status === "WANT_TO_WATCH") {
         if (!wantToWatch[watcherGroup]) {
            wantToWatch[watcherGroup] = [];
         }
         // Avoid duplicates
         if (!wantToWatch[watcherGroup].some((s) => s.id === showInfo.id)) {
            wantToWatch[watcherGroup].push(showInfo);
         }
      }
   });

   Object.values(currentlyWatching).forEach((shows: ShowInfo[]) => shows.sort((a, b) => a.name.localeCompare(b.name)));
   Object.values(wantToWatch).forEach((shows: ShowInfo[]) => shows.sort((a, b) => a.name.localeCompare(b.name)));

   return { currentlyWatching, wantToWatch };
};

export const action = async ({ request }: ActionFunctionArgs) => {
   await requireAuth(request);
   const formData = await request.formData();
   const action = formData.get("_action");
   const showId = Number(formData.get("showId"));
   
   console.log("Action received:", action, "for showId:", showId);

   if (action === "completeSeason") {
      const currentSeason = Number(formData.get("currentSeason"));
      const totalSeasons = Number(formData.get("totalSeasons"));

      if (currentSeason < totalSeasons) {
         // Just increment the season
         await db
            .update(showsToUsers)
            .set({ currentSeason: currentSeason + 1 })
            .where(eq(showsToUsers.showId, showId));
      } else {
         // It's the last season, mark as finished
         await db
            .update(showsToUsers)
            .set({ status: "FINISHED", finishedAt: new Date() })
            .where(eq(showsToUsers.showId, showId));
      }
   }

   if (action === "startWatching") {
      await db
         .update(showsToUsers)
         .set({ status: "IN_PROGRESS", currentSeason: 1 })
         .where(eq(showsToUsers.showId, showId));
   }

   if (action === "setToWantToWatch") {
      await db
         .update(showsToUsers)
         .set({ status: "WANT_TO_WATCH" })
         .where(eq(showsToUsers.showId, showId));
   }

   return null;
};

export default function Index() {
   const { currentlyWatching, wantToWatch } = useLoaderData<typeof loader>();

   return (
      <div className="dashboard">
         <div className="dashboard-header">
            <h2>Currently Watching</h2>

            <Link
               to="/shows/manage"
               className="button secondary"
            >
               Manage Shows
            </Link>
         </div>

         <div>
            {Object.keys(currentlyWatching).length > 0 ? (
               <div className="show-group-container">
                  {Object.entries(currentlyWatching).map(([watcherGroup, shows]) => (
                     <div key={watcherGroup}>
                        <h3>
                           {watcherGroup}
                        </h3>
                        <div className="show-card-grid">
                           {shows.map((show) => (
                              <ShowCard key={show.id} show={show} status="IN_PROGRESS" />
                           ))}
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
               <p>No shows being watched right now.</p>
            )}
         </div>

         <div>
            <h2>
               Want To Watch
            </h2>
            {Object.keys(wantToWatch).length > 0 ? (
               <div className="show-group-container">
                  {Object.entries(wantToWatch).map(([watcherGroup, shows]) => (
                     <div key={watcherGroup}>
                        <h3>
                           {watcherGroup}
                        </h3>
                        <div className="show-card-grid">
                           {shows.map((show) => (
                              <ShowCard key={show.id} show={show} status="WANT_TO_WATCH" />
                           ))}
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
               <p>
                  Add some shows to your watch list!
               </p>
            )}
         </div>
      </div>
   );
}

