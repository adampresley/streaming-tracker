import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams, Link } from "@remix-run/react";
import { useState } from "react";
import ConfirmationPopup from "~/components/ConfirmationPopup";
import { db } from "~/db.server";
import { shows, showsToUsers } from "../../drizzle/schema";
import { eq, gt, and, desc } from "drizzle-orm";
import { config } from "dotenv";
import { requireAuth } from "~/auth.server";

interface FinishedShowInfo {
   id: number;
   name: string;
   totalSeasons: number;
   platformName: string;
   watchers: string[];
   cancelled: boolean;
   finishedAt: string | null;
}

export const action = async ({ request }: ActionFunctionArgs) => {
   await requireAuth(request);
   const formData = await request.formData();
   const intent = formData.get("intent");
   const showId = Number(formData.get("showId"));
   const totalSeasons = Number(formData.get("totalSeasons"));

   if (intent === "addSeason") {
      const newTotalSeasons = totalSeasons + 1;

      // Update the total seasons for the show
      await db
         .update(shows)
         .set({ totalSeasons: newTotalSeasons })
         .where(eq(shows.id, showId));

      // Update the status for the watchers
      await db
         .update(showsToUsers)
         .set({
            status: "IN_PROGRESS",
            currentSeason: newTotalSeasons,
         })
         .where(eq(showsToUsers.showId, showId));
   } else if (intent === "removeSeason") {
      if (totalSeasons <= 1) {
         // Can't remove the last season
         return redirect("/shows/finished");
      }

      const newTotalSeasons = totalSeasons - 1;

      // Update the total seasons for the show
      await db
         .update(shows)
         .set({ totalSeasons: newTotalSeasons })
         .where(eq(shows.id, showId));

      // Update watchers who are on a season that no longer exists
      // Move them to the last available season
      await db
         .update(showsToUsers)
         .set({
            currentSeason: newTotalSeasons,
         })
         .where(
            and(
               eq(showsToUsers.showId, showId),
               gt(showsToUsers.currentSeason, newTotalSeasons)
            )
         );
   }

   return redirect("/shows/finished");
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
   await requireAuth(request);
   config();

   const url = new URL(request.url);
   const showNameQuery = url.searchParams.get("showName") || "";
   const platformQuery = url.searchParams.get("platform") || "";
   const page = Number(url.searchParams.get("page") || "1");
   const pageSize = Number(process.env.PAGE_SIZE) || 15;

   const finishedShowsWithWatchers = await db.query.showsToUsers.findMany({
      where: eq(showsToUsers.status, "FINISHED"),
      with: {
         show: {
            with: {
               platform: true,
            },
         },
         user: true,
      },
   });

   const showsMap = new Map<number, FinishedShowInfo>();
   finishedShowsWithWatchers.forEach((stu) => {
      const { show, user } = stu;

      // Defensively check for a valid date
      let finishedAt: string | null = null;
      if (stu.finishedAt) {
         const date = new Date(stu.finishedAt);
         if (!isNaN(date.getTime())) {
            finishedAt = date.toISOString();
         }
      }

      if (!showsMap.has(show.id)) {
         showsMap.set(show.id, {
            id: show.id,
            name: show.name,
            totalSeasons: show.totalSeasons,
            platformName: show.platform.name,
            watchers: [],
            cancelled: show.cancelled,
            finishedAt: finishedAt,
         });
      }
      showsMap.get(show.id)!.watchers.push(user.name);
   });

   let filteredShows = Array.from(showsMap.values());

   if (showNameQuery) {
      filteredShows = filteredShows.filter((s) =>
         s.name.toLowerCase().includes(showNameQuery.toLowerCase())
      );
   }

   if (platformQuery) {
      filteredShows = filteredShows.filter((s) =>
         s.platformName.toLowerCase().includes(platformQuery.toLowerCase())
      );
   }

   // Sort by show name
   filteredShows.sort((a, b) => a.name.localeCompare(b.name));

   const totalShows = filteredShows.length;
   const totalPages = Math.ceil(totalShows / pageSize);
   const offset = (page - 1) * pageSize;

   const showsForPage = filteredShows.slice(offset, offset + pageSize);

   return { shows: showsForPage, page, totalPages };
};

function RemoveSeasonButton({ show, onRemoveSeason }: { show: FinishedShowInfo, onRemoveSeason: () => void }) {
   const [showConfirmation, setShowConfirmation] = useState(false);

   if (show.totalSeasons <= 1) {
      return null;
   }

   return (
      <>
         <button
            onClick={() => setShowConfirmation(true)}
            className="icon-button danger"
            aria-label="Remove season"
            title="Remove season"
         >
            -
         </button>
         <ConfirmationPopup
            isOpen={showConfirmation}
            onConfirm={onRemoveSeason}
            onCancel={() => setShowConfirmation(false)}
            title="Remove Season"
            message={`Are you sure you want to remove a season from "${show.name}"? This will reduce the total seasons from ${show.totalSeasons} to ${show.totalSeasons - 1}.`}
            confirmText="Yes, Remove"
            cancelText="Cancel"
         />
      </>
   );
}

export default function FinishedShows() {
   const { shows, page, totalPages } = useLoaderData<typeof loader>();
   const [searchParams] = useSearchParams();
   const [removeSeasonFormRef, setRemoveSeasonFormRef] = useState<HTMLFormElement | null>(null);

   const getPageLink = (p: number) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("page", p.toString());
      return `/shows/finished?${newParams.toString()}`;
   };

   const handleRemoveSeason = (showId: number, totalSeasons: number) => {
      if (removeSeasonFormRef) {
         const intentInput = removeSeasonFormRef.querySelector('input[name="intent"]') as HTMLInputElement;
         const showIdInput = removeSeasonFormRef.querySelector('input[name="showId"]') as HTMLInputElement;
         const totalSeasonsInput = removeSeasonFormRef.querySelector('input[name="totalSeasons"]') as HTMLInputElement;

         if (intentInput) intentInput.value = "removeSeason";
         if (showIdInput) showIdInput.value = showId.toString();
         if (totalSeasonsInput) totalSeasonsInput.value = totalSeasons.toString();

         removeSeasonFormRef.submit();
      }
   };

   return (
      <div className="finished-shows-page">
         <h2>Finished Shows</h2>

         <Form method="post" ref={setRemoveSeasonFormRef} style={{ display: "none" }}>
            <input type="hidden" name="intent" />
            <input type="hidden" name="showId" />
            <input type="hidden" name="totalSeasons" />
         </Form>

         <Form method="get" className="filter-form card horizontal-form">
            <div className="form-group">
               <label htmlFor="showName">
                  Show Name
               </label>
               <input
                  type="text"
                  name="showName"
                  id="showName"
                  defaultValue={searchParams.get("showName") ?? ""}
               />
            </div>
            <div className="form-group">
               <label htmlFor="platform">
                  Platform
               </label>
               <input
                  type="text"
                  name="platform"
                  id="platform"
                  defaultValue={searchParams.get("platform") ?? ""}
               />
            </div>
            <div className="form-actions">
               <button className="primary">Search</button>
               <Form method="get" className="inline">
                  <button className="cancel">Clear</button>
               </Form>
            </div>
         </Form>

         <div className="card table-view">
            <table className="finished-shows-table">
               <thead>
                  <tr>
                     <th>Show</th>
                     <th>Platform</th>
                     <th>Seasons</th>
                     <th>Watched By</th>
                     <th>Finished Date</th>
                     <th>Actions</th>
                  </tr>
               </thead>

               <tbody>
                  {shows.map((show) => (
                     <tr key={show.id}>
                        <td>
                           <div className="show-name-cell">
                              {show.name}
                              {show.cancelled && (
                                 <span className="cancelled-tag">
                                    Cancelled
                                 </span>
                              )}
                           </div>
                        </td>
                        <td>{show.platformName}</td>
                        <td>{show.totalSeasons}</td>
                        <td>{show.watchers.join(", ")}</td>
                        <td>
                           {show.finishedAt
                              ? new Date(show.finishedAt).toLocaleDateString()
                              : "N/A"}
                        </td>
                        <td>
                           <div className="action-cell">
                              <Form method="post" className="inline">
                                 <input type="hidden" name="intent" value="addSeason" />
                                 <input type="hidden" name="showId" value={show.id} />
                                 <input
                                    type="hidden"
                                    name="totalSeasons"
                                    value={show.totalSeasons}
                                 />
                                 <button
                                    className="icon-button primary"
                                    aria-label="Add season"
                                    title="Add a season to the show"
                                 >
                                    +
                                 </button>
                              </Form>

                              <RemoveSeasonButton
                                 show={show}
                                 onRemoveSeason={() => handleRemoveSeason(show.id, show.totalSeasons)}
                              />

                              <Form
                                 method="post"
                                 action={`/shows/${show.id}/cancel`}
                                 className="inline"
                              >
                                 <input
                                    type="hidden"
                                    name="cancelled"
                                    value={show.cancelled.toString()}
                                 />
                                 <button
                                    className="icon-button warning"
                                    aria-label={
                                       show.cancelled ? "Un-cancel show" : "Cancel show"
                                    }
                                    title={show.cancelled ? "Un-cancel show" : "Cancel show"}
                                 >
                                    X
                                 </button>
                              </Form>

                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         <div className="card-view">
            {shows.map((show) => (
               <div key={show.id} className="card finished-show-card">
                  <div className="finished-show-header">
                     <h3>
                        {show.name}
                        {show.cancelled && (
                           <span className="cancelled-tag">
                              Cancelled
                           </span>
                        )}
                     </h3>
                  </div>

                  <div className="finished-show-details">
                     <p><strong>Platform:</strong> {show.platformName}</p>
                     <p><strong>Seasons:</strong> {show.totalSeasons}</p>
                     <p><strong>Watched By:</strong> {show.watchers.join(", ")}</p>
                     <p><strong>Finished Date:</strong> {show.finishedAt
                        ? new Date(show.finishedAt).toLocaleDateString()
                        : "N/A"}</p>
                  </div>

                  <div className="finished-show-actions">
                     <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="addSeason" />
                        <input type="hidden" name="showId" value={show.id} />
                        <input
                           type="hidden"
                           name="totalSeasons"
                           value={show.totalSeasons}
                        />
                        <button
                           className="button primary small"
                           aria-label="Add season"
                           title="Add a season to the show"
                        >
                           Add Season
                        </button>
                     </Form>

                     <RemoveSeasonButton
                        show={show}
                        onRemoveSeason={() => handleRemoveSeason(show.id, show.totalSeasons)}
                     />

                     <Form
                        method="post"
                        action={`/shows/${show.id}/cancel`}
                        className="inline"
                     >
                        <input
                           type="hidden"
                           name="cancelled"
                           value={show.cancelled.toString()}
                        />
                        <button
                           className="warning small"
                           aria-label={
                              show.cancelled ? "Un-cancel show" : "Cancel show"
                           }
                           title={show.cancelled ? "Un-cancel show" : "Cancel show"}
                        >
                           {show.cancelled ? "Un-cancel" : "Cancel"}
                        </button>
                     </Form>
                  </div>
               </div>
            ))}
         </div>

         <div className="pagination">
            <Link
               to={getPageLink(page - 1)}
               className={`button primary ${page <= 1 ? "disabled" : ""}`}
               aria-disabled={page <= 1}
               onClick={(e) => page <= 1 && e.preventDefault()}
            >
               Previous
            </Link>
            <span>
               Page {page} of {totalPages}
            </span>
            <Link
               to={getPageLink(page + 1)}
               className={`button primary ${page >= totalPages ? "disabled" : ""}`}
               aria-disabled={page >= totalPages}
               onClick={(e) => page >= totalPages && e.preventDefault()}
            >
               Next
            </Link>
         </div>
      </div>
   );
}
