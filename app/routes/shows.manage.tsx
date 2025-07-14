import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { db } from "~/db.server";
import { shows, showsToUsers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "@remix-run/node";
import { useState } from "react";
import { requireAuth } from "~/auth.server";

interface ShowManageInfo {
   id: number;
   name: string;
   totalSeasons: number;
   platformName: string;
   watchers: Array<{
      name: string;
      status: string;
      currentSeason: number;
   }>;
   hasWatchedSeasons: boolean;
   canDelete: boolean;
   canMoveToWantToWatch: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
   await requireAuth(request);
   const url = new URL(request.url);
   const searchTerm = url.searchParams.get("search") || "";
   const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
   const pageSize = Number(process.env.PAGE_SIZE) || 15;
   const offset = (page - 1) * pageSize;

   const allShows = await db.query.shows.findMany({
      with: {
         platform: true,
         showsToUsers: {
            with: {
               user: true,
            },
         },
      },
   });

   const filteredShows = allShows
      .filter((show) =>
         searchTerm === "" ||
         show.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .map((show) => {
         const watchers = show.showsToUsers.map((stu) => ({
            name: stu.user.name,
            status: stu.status,
            currentSeason: stu.currentSeason,
         }));

         // Check if any watcher has progressed beyond season 1 or is finished
         const hasWatchedSeasons = show.showsToUsers.some((stu) =>
            stu.currentSeason > 1 || stu.status === "FINISHED"
         );

         // Can delete if no one has watched any seasons
         const canDelete = !hasWatchedSeasons;

         // Can move to want-to-watch if currently watching but no one has watched seasons
         const hasInProgressWatchers = show.showsToUsers.some((stu) => stu.status === "IN_PROGRESS");
         const canMoveToWantToWatch = hasInProgressWatchers && !hasWatchedSeasons;

         return {
            id: show.id,
            name: show.name,
            totalSeasons: show.totalSeasons,
            platformName: show.platform.name,
            watchers,
            hasWatchedSeasons,
            canDelete,
            canMoveToWantToWatch,
         };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

   const totalShows = filteredShows.length;
   const totalPages = Math.ceil(totalShows / pageSize);
   const showsInfo = filteredShows.slice(offset, offset + pageSize);

   return { 
      shows: showsInfo, 
      searchTerm, 
      currentPage: page,
      totalPages,
      totalShows,
      pageSize
   };
};

export const action = async ({ request }: ActionFunctionArgs) => {
   await requireAuth(request);
   const formData = await request.formData();
   const action = formData.get("_action");
   const showId = Number(formData.get("showId"));

   if (action === "delete") {
      // Double-check that no one has watched seasons
      const showUsers = await db.query.showsToUsers.findMany({
         where: eq(showsToUsers.showId, showId),
      });

      const hasWatchedSeasons = showUsers.some((stu) =>
         stu.currentSeason > 1 || stu.status === "FINISHED"
      );

      if (!hasWatchedSeasons) {
         // Delete showsToUsers entries first (foreign key constraint)
         await db.delete(showsToUsers).where(eq(showsToUsers.showId, showId));
         // Then delete the show
         await db.delete(shows).where(eq(shows.id, showId));
      }
   }

   if (action === "moveToWantToWatch") {
      // Double-check that no one has watched seasons
      const showUsers = await db.query.showsToUsers.findMany({
         where: eq(showsToUsers.showId, showId),
      });

      const hasWatchedSeasons = showUsers.some((stu) =>
         stu.currentSeason > 1 || stu.status === "FINISHED"
      );

      if (!hasWatchedSeasons) {
         // Move all IN_PROGRESS users to WANT_TO_WATCH
         await db
            .update(showsToUsers)
            .set({ status: "WANT_TO_WATCH", currentSeason: 1 })
            .where(and(
               eq(showsToUsers.showId, showId),
               eq(showsToUsers.status, "IN_PROGRESS")
            ));
      }
   }

   if (action === "editName") {
      const newName = formData.get("newName") as string;
      if (newName && newName.trim()) {
         await db
            .update(shows)
            .set({ name: newName.trim() })
            .where(eq(shows.id, showId));
      }
   }

   return redirect("/shows/manage");
};

function DeleteShowButton({ show }: { show: ShowManageInfo }) {
   const [showConfirmation, setShowConfirmation] = useState(false);

   if (showConfirmation) {
      return (
         <div className="flex gap-2 items-center">
            <Form method="post" className="inline">
               <input type="hidden" name="showId" value={show.id} />
               <button
                  type="submit"
                  name="_action"
                  value="delete"
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-sm"
               >
                  Yes, Delete
               </button>
            </Form>
            <button
               onClick={() => setShowConfirmation(false)}
               className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-2 rounded text-sm"
            >
               Cancel
            </button>
         </div>
      );
   }

   return (
      <button
         onClick={() => setShowConfirmation(true)}
         className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-sm w-full"
      >
         Delete Show
      </button>
   );
}

export default function ManageShows() {
   const { shows: showsData, searchTerm, currentPage, totalPages, totalShows } = useLoaderData<typeof loader>();
   const [searchParams, setSearchParams] = useSearchParams();

   return (
      <div className="space-y-8">
         <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-teal-400">Manage Shows</h1>
            <Link
               to="/"
               className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
               Back to Dashboard
            </Link>
         </div>

         <div className="bg-gray-800 rounded-lg shadow-lg p-4">
            <div className="flex gap-4 items-center">
               <label htmlFor="search" className="text-white font-medium">
                  Search Shows:
               </label>
               <input
                  id="search"
                  type="text"
                  defaultValue={searchTerm}
                  placeholder="Enter show name..."
                  className="bg-gray-700 text-white px-3 py-2 rounded flex-1"
                  onChange={(e) => {
                     const newSearchParams = new URLSearchParams(searchParams);
                     if (e.target.value) {
                        newSearchParams.set("search", e.target.value);
                     } else {
                        newSearchParams.delete("search");
                     }
                     newSearchParams.delete("page");
                     setSearchParams(newSearchParams);
                  }}
               />
               {searchTerm && (
                  <button
                     onClick={() => {
                        const newSearchParams = new URLSearchParams(searchParams);
                        newSearchParams.delete("search");
                        newSearchParams.delete("page");
                        setSearchParams(newSearchParams);
                     }}
                     className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded"
                  >
                     Clear
                  </button>
               )}
            </div>
            <div className="flex justify-between items-center mt-2">
               {searchTerm ? (
                  <p className="text-gray-400 text-sm">
                     Showing {showsData.length} of {totalShows} show{totalShows !== 1 ? "s" : ""} matching "{searchTerm}"
                  </p>
               ) : (
                  <p className="text-gray-400 text-sm">
                     Showing {showsData.length} of {totalShows} show{totalShows !== 1 ? "s" : ""}
                  </p>
               )}
               
               {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                     <button
                        onClick={() => {
                           const newSearchParams = new URLSearchParams(searchParams);
                           newSearchParams.set("page", String(currentPage - 1));
                           setSearchParams(newSearchParams);
                        }}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 rounded text-sm ${
                           currentPage === 1
                              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                              : "bg-blue-500 hover:bg-blue-600 text-white"
                        }`}
                     >
                        Previous
                     </button>
                     
                     <span className="text-gray-400 text-sm">
                        Page {currentPage} of {totalPages}
                     </span>
                     
                     <button
                        onClick={() => {
                           const newSearchParams = new URLSearchParams(searchParams);
                           newSearchParams.set("page", String(currentPage + 1));
                           setSearchParams(newSearchParams);
                        }}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1 rounded text-sm ${
                           currentPage === totalPages
                              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                              : "bg-blue-500 hover:bg-blue-600 text-white"
                        }`}
                     >
                        Next
                     </button>
                  </div>
               )}
            </div>
         </div>

         <div className="space-y-4">
            {showsData.map((show) => (
               <div key={show.id} className="bg-gray-800 rounded-lg shadow-lg p-6">
                  <div className="flex justify-between items-start">
                     <div className="flex-1">
                        <h3 className="text-xl font-bold text-white">{show.name}</h3>
                        <p className="text-sm text-gray-400">{show.platformName}</p>
                        <p className="text-sm text-gray-400">{show.totalSeasons} seasons</p>

                        <div className="mt-2">
                           <h4 className="text-sm font-semibold text-gray-300">Watchers:</h4>
                           <ul className="text-sm text-gray-400">
                              {show.watchers.map((watcher, index) => (
                                 <li key={index}>
                                    {watcher.name} - {watcher.status}
                                    {watcher.status === "IN_PROGRESS" && ` (Season ${watcher.currentSeason})`}
                                 </li>
                              ))}
                           </ul>
                        </div>

                        {show.hasWatchedSeasons && (
                           <p className="text-xs text-yellow-400 mt-2">
                              ⚠️ Some users have watched seasons - limited actions available
                           </p>
                        )}
                     </div>

                     <div className="flex flex-col gap-2 ml-4">
                        {/* Edit Name */}
                        <Form method="post" className="flex gap-2">
                           <input type="hidden" name="showId" value={show.id} />
                           <input
                              type="text"
                              name="newName"
                              defaultValue={show.name}
                              className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                              required
                           />
                           <button
                              type="submit"
                              name="_action"
                              value="editName"
                              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-sm"
                           >
                              Rename
                           </button>
                        </Form>

                        {/* Move to Want to Watch */}
                        {show.canMoveToWantToWatch && (
                           <Form method="post">
                              <input type="hidden" name="showId" value={show.id} />
                              <button
                                 type="submit"
                                 name="_action"
                                 value="moveToWantToWatch"
                                 className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-2 rounded text-sm w-full"
                              >
                                 Move to Want to Watch
                              </button>
                           </Form>
                        )}

                        {/* Delete Show */}
                        {show.canDelete && <DeleteShowButton show={show} />}

                        {/* Edit Watchers Link */}
                        <Link
                           to={`/shows/${show.id}/edit`}
                           className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-2 rounded text-sm text-center"
                        >
                           Edit Watchers
                        </Link>
                     </div>
                  </div>
               </div>
            ))}

            {showsData.length === 0 && (
               <p className="text-gray-400 text-center">No shows found.</p>
            )}
         </div>
      </div>
   );
}
