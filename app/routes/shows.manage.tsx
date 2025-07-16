import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { db } from "~/db.server";
import { shows, showsToUsers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "@remix-run/node";
import { useState } from "react";
import { requireAuth } from "~/auth.server";
import { formatUserStatus } from "~/services/userStatus";

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

   const url: URL = new URL(request.url);
   const searchTerm: string = url.searchParams.get("search") || "";
   const page: number = Math.max(1, Number(url.searchParams.get("page")) || 1);
   const pageSize: number = Number(process.env.PAGE_SIZE) || 15;
   const offset: number = (page - 1) * pageSize;

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

   const filteredShows: ShowManageInfo[] = allShows
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
         const canDelete: boolean = !hasWatchedSeasons;

         // Can move to want-to-watch if currently watching but no one has watched seasons
         const hasInProgressWatchers: boolean = show.showsToUsers.some((stu) => stu.status === "IN_PROGRESS");
         const canMoveToWantToWatch: boolean = hasInProgressWatchers && !hasWatchedSeasons;

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

   const totalShows: number = filteredShows.length;
   const totalPages: number = Math.ceil(totalShows / pageSize);
   const showsInfo: ShowManageInfo[] = filteredShows.slice(offset, offset + pageSize);

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
   const formData: FormData = await request.formData();
   const action: FormDataEntryValue | null = formData.get("_action");
   const showId: number = Number(formData.get("showId"));

   if (action === "delete") {
      // Double-check that no one has watched seasons
      const showUsers = await db.query.showsToUsers.findMany({
         where: eq(showsToUsers.showId, showId),
      });

      const hasWatchedSeasons: boolean = showUsers.some((stu) =>
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

      const hasWatchedSeasons: boolean = showUsers.some((stu) =>
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
      const newName: string = formData.get("newName") as string;
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
         <div className="confirm-delete">
            <Form method="post" className="inline">
               <input type="hidden" name="showId" value={show.id} />
               <button
                  name="_action"
                  value="delete"
                  className="danger small"
               >
                  Yes, Delete
               </button>
            </Form>
            <button
               onClick={() => setShowConfirmation(false)}
               className="cancel small"
            >
               Cancel
            </button>
         </div>
      );
   }

   return (
      <button
         onClick={() => setShowConfirmation(true)}
         className="danger small full-width"
      >
         Delete Show
      </button>
   );
}

export default function ManageShows() {
   const { shows: showsData, searchTerm, currentPage, totalPages, totalShows } = useLoaderData<typeof loader>();
   const [searchParams, setSearchParams] = useSearchParams();

   return (
      <div className="manage-shows-page">
         <div className="page-header">
            <h1>Manage Shows</h1>
            <Link
               to="/"
               className="button secondary"
            >
               Back to Dashboard
            </Link>
         </div>

         <div className="card search-card">
            <div className="search-bar">
               <label htmlFor="search">Search Shows:</label>
               <input
                  id="search"
                  type="text"
                  defaultValue={searchTerm}
                  placeholder="Enter show name..."
                  onChange={(e) => {
                     const newSearchParams: URLSearchParams = new URLSearchParams(searchParams);

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
                        const newSearchParams: URLSearchParams = new URLSearchParams(searchParams);
                        newSearchParams.delete("search");
                        newSearchParams.delete("page");
                        setSearchParams(newSearchParams);
                     }}
                     className="danger"
                  >
                     Clear
                  </button>
               )}
            </div>
            <div className="pagination-summary">
               {searchTerm ? (
                  <p>
                     Showing {showsData.length} of {totalShows} show{totalShows !== 1 ? "s" : ""} matching "{searchTerm}"
                  </p>
               ) : (
                  <p>
                     Showing {showsData.length} of {totalShows} show{totalShows !== 1 ? "s" : ""}
                  </p>
               )}

               {totalPages > 1 && (
                  <div className="pagination-controls">
                     <button
                        onClick={() => {
                           const newSearchParams: URLSearchParams = new URLSearchParams(searchParams);
                           newSearchParams.set("page", String(currentPage - 1));
                           setSearchParams(newSearchParams);
                        }}
                        disabled={currentPage === 1}
                        className="primary small"
                     >
                        Previous
                     </button>

                     <span>
                        Page {currentPage} of {totalPages}
                     </span>

                     <button
                        onClick={() => {
                           const newSearchParams: URLSearchParams = new URLSearchParams(searchParams);
                           newSearchParams.set("page", String(currentPage + 1));
                           setSearchParams(newSearchParams);
                        }}
                        disabled={currentPage === totalPages}
                        className="primary small"
                     >
                        Next
                     </button>
                  </div>
               )}
            </div>
         </div>

         <div className="show-list">
            {showsData.map((show) => (
               <div key={show.id} className="card show-list-item">
                  <div className="show-details">
                     <h3>{show.name}</h3>
                     <p>{show.platformName}</p>
                     <p>{show.totalSeasons} seasons</p>

                     <div className="watchers-list">
                        <h4>Watchers:</h4>
                        <ul>
                           {show.watchers.map((watcher, index) => (
                              <li key={index}>
                                 {watcher.name} - {formatUserStatus(watcher.status)}
                                 {watcher.status === "IN_PROGRESS" && ` (Season ${watcher.currentSeason})`}
                              </li>
                           ))}
                        </ul>
                     </div>

                     {show.hasWatchedSeasons && (
                        <p className="warning-text">
                           ⚠️ Some users have watched seasons - limited actions available
                        </p>
                     )}
                  </div>

                  <div className="show-actions">
                     <Form method="post" className="rename-form">
                        <input type="hidden" name="showId" value={show.id} />
                        <input
                           type="text"
                           name="newName"
                           defaultValue={show.name}
                           required
                        />
                        <button
                           name="_action"
                           value="editName"
                           className="primary small"
                        >
                           Rename
                        </button>
                     </Form>

                     {show.canMoveToWantToWatch && (
                        <Form method="post">
                           <input type="hidden" name="showId" value={show.id} />
                           <button
                              name="_action"
                              value="moveToWantToWatch"
                              className="warning small full-width"
                           >
                              Move to Want to Watch
                           </button>
                        </Form>
                     )}

                     {show.canDelete && <DeleteShowButton show={show} />}

                     <Link
                        to={`/shows/${show.id}/edit`}
                        className="button secondary small full-width"
                     >
                        Edit Watchers
                     </Link>
                  </div>
               </div>
            ))}

            {showsData.length === 0 && (
               <p className="no-results">No shows found.</p>
            )}
         </div>
      </div>
   );
}
