import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams, Link } from "@remix-run/react";
import { useState } from "react";
import ConfirmationPopup from "~/components/ConfirmationPopup";
import { db } from "~/db.server";
import { shows, showsToUsers } from "../../drizzle/schema";
import { eq, gt, and, desc } from "drizzle-orm";
import { config } from "dotenv";
import {
   XCircleIcon,
   CheckCircleIcon,
   PlusCircleIcon,
   MinusCircleIcon,
} from "@heroicons/react/24/solid";
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
            className="text-red-400 hover:text-red-200"
            aria-label="Remove season"
            title="Remove season"
         >
            <MinusCircleIcon className="h-6 w-6" />
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
      <div className="space-y-6">
         <h2 className="text-3xl font-bold text-teal-400">Finished Shows</h2>

         <Form method="post" ref={setRemoveSeasonFormRef} style={{ display: "none" }}>
            <input type="hidden" name="intent" />
            <input type="hidden" name="showId" />
            <input type="hidden" name="totalSeasons" />
         </Form>

         <Form method="get" className="flex gap-4 p-4 bg-gray-800 rounded-lg">
            <div className="flex-grow">
               <label
                  htmlFor="showName"
                  className="block text-sm font-medium text-gray-300"
               >
                  Show Name
               </label>
               <input
                  type="text"
                  name="showName"
                  id="showName"
                  defaultValue={searchParams.get("showName") ?? ""}
                  className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 sm:text-sm text-white p-2"
               />
            </div>
            <div className="flex-grow">
               <label
                  htmlFor="platform"
                  className="block text-sm font-medium text-gray-300"
               >
                  Platform
               </label>
               <input
                  type="text"
                  name="platform"
                  id="platform"
                  defaultValue={searchParams.get("platform") ?? ""}
                  className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 sm:text-sm text-white p-2"
               />
            </div>
            <div className="self-end flex gap-2">
               <button
                  type="submit"
                  className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"
               >
                  Search
               </button>
               <Form method="get" className="inline">
                  <button
                     type="submit"
                     className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                  >
                     Clear
                  </button>
               </Form>
            </div>
         </Form>

         <div className="bg-gray-800 shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-700">
               <thead className="bg-gray-700">
                  <tr>
                     <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                     >
                        Show
                     </th>
                     <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                     >
                        Platform
                     </th>
                     <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                     >
                        Seasons
                     </th>
                     <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                     >
                        Watched By
                     </th>
                     <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                     >
                        Finished Date
                     </th>
                     <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                     </th>
                  </tr>
               </thead>

               <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {shows.map((show) => (
                     <tr key={show.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                           <div className="flex items-center gap-2">
                              {show.name}
                              {show.cancelled && (
                                 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-800 text-red-100">
                                    Cancelled
                                 </span>
                              )}
                           </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                           {show.platformName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                           {show.totalSeasons}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                           {show.watchers.join(", ")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                           {show.finishedAt
                              ? new Date(show.finishedAt).toLocaleDateString()
                              : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                           <div className="flex gap-4 justify-end items-start">
                              <Form method="post" className="inline">
                                 <input type="hidden" name="intent" value="addSeason" />
                                 <input type="hidden" name="showId" value={show.id} />
                                 <input
                                    type="hidden"
                                    name="totalSeasons"
                                    value={show.totalSeasons}
                                 />
                                 <button
                                    type="submit"
                                    className="text-teal-400 hover:text-teal-200"
                                    aria-label="Add season"
                                    title="Add a season to the show"
                                 >
                                    <PlusCircleIcon className="h-6 w-6" />
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
                                    type="submit"
                                    className="text-yellow-400 hover:text-yellow-200"
                                    aria-label={
                                       show.cancelled ? "Un-cancel show" : "Cancel show"
                                    }
                                    title={show.cancelled ? "Un-cancel show" : "Cancel show"}
                                 >
                                    <XCircleIcon className="h-6 w-6" />
                                 </button>
                              </Form>

                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         <div className="flex justify-between items-center mt-4">
            <Link
               to={getPageLink(page - 1)}
               className={`bg-teal-500 text-white font-bold py-2 px-4 rounded ${page <= 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-teal-600"
                  }`}
               aria-disabled={page <= 1}
               onClick={(e) => page <= 1 && e.preventDefault()}
            >
               Previous
            </Link>
            <span className="text-white">
               Page {page} of {totalPages}
            </span>
            <Link
               to={getPageLink(page + 1)}
               className={`bg-teal-500 text-white font-bold py-2 px-4 rounded ${page >= totalPages
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-teal-600"
                  }`}
               aria-disabled={page >= totalPages}
               onClick={(e) => page >= totalPages && e.preventDefault()}
            >
               Next
            </Link>
         </div>
      </div>
   );
}
