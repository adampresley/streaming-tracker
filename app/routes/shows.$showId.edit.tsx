import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { db } from "~/db.server";
import { showsToUsers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "@remix-run/node";
import { requireAuth } from "~/auth.server";

interface ShowEditInfo {
   id: number;
   name: string;
   totalSeasons: number;
   platformName: string;
   watchers: Array<{
      userId: number;
      userName: string;
      status: string;
      currentSeason: number;
   }>;
   allUsers: Array<{
      id: number;
      name: string;
   }>;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
   await requireAuth(request);
   const showId = Number(params.showId);

   const show = await db.query.shows.findFirst({
      where: (shows, { eq }) => eq(shows.id, showId),
      with: {
         platform: true,
         showsToUsers: {
            with: {
               user: true,
            },
         },
      },
   });

   if (!show) {
      throw new Response("Show not found", { status: 404 });
   }

   const allUsers = await db.query.users.findMany();

   const watchers = show.showsToUsers.map((stu) => ({
      userId: stu.userId,
      userName: stu.user.name,
      status: stu.status,
      currentSeason: stu.currentSeason,
   }));

   const showInfo: ShowEditInfo = {
      id: show.id,
      name: show.name,
      totalSeasons: show.totalSeasons,
      platformName: show.platform.name,
      watchers,
      allUsers,
   };

   return { show: showInfo };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
   await requireAuth(request);
   const showId = Number(params.showId);
   const formData = await request.formData();
   const action = formData.get("_action");

   if (action === "addWatcher") {
      const userId = Number(formData.get("userId"));
      const status = formData.get("status") as string;

      // Check if user is already watching this show
      const existingWatcher = await db.query.showsToUsers.findFirst({
         where: and(
            eq(showsToUsers.showId, showId),
            eq(showsToUsers.userId, userId)
         ),
      });

      if (!existingWatcher) {
         await db.insert(showsToUsers).values({
            showId,
            userId,
            status: status || "WANT_TO_WATCH",
            currentSeason: 1,
         });
      }
   }

   if (action === "removeWatcher") {
      const userId = Number(formData.get("userId"));

      await db
         .delete(showsToUsers)
         .where(and(
            eq(showsToUsers.showId, showId),
            eq(showsToUsers.userId, userId)
         ));
   }

   if (action === "updateStatus") {
      const userId = Number(formData.get("userId"));
      const newStatus = formData.get("newStatus") as string;

      await db
         .update(showsToUsers)
         .set({
            status: newStatus,
            currentSeason: newStatus === "WANT_TO_WATCH" ? 1 : undefined
         })
         .where(and(
            eq(showsToUsers.showId, showId),
            eq(showsToUsers.userId, userId)
         ));
   }

   return redirect(`/shows/${showId}/edit`);
};

export default function EditShow() {
   const { show } = useLoaderData<typeof loader>();

   const availableUsers = show.allUsers.filter(
      (user) => !show.watchers.some((watcher) => watcher.userId === user.id)
   );

   return (
      <div className="space-y-8">
         <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-teal-400">Edit Show: {show.name}</h1>
            <Link
               to="/shows/manage"
               className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
               Back to Manage Shows
            </Link>
         </div>

         <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Show Details</h2>
            <p className="text-gray-400">Platform: {show.platformName}</p>
            <p className="text-gray-400">Total Seasons: {show.totalSeasons}</p>
         </div>

         <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Current Watchers</h2>

            {show.watchers.length > 0 ? (
               <div className="space-y-4">
                  {show.watchers.map((watcher) => (
                     <div key={watcher.userId} className="flex items-center justify-between bg-gray-700 p-4 rounded">
                        <div>
                           <h3 className="font-semibold text-white">{watcher.userName}</h3>
                           <p className="text-sm text-gray-400">
                              Status: {watcher.status}
                              {watcher.status === "IN_PROGRESS" && ` (Season ${watcher.currentSeason})`}
                           </p>
                        </div>

                        <div className="flex gap-2">
                           {/* Update Status */}
                           <Form method="post" className="flex gap-2">
                              <input type="hidden" name="userId" value={watcher.userId} />
                              <select
                                 name="newStatus"
                                 defaultValue={watcher.status}
                                 className="bg-gray-600 text-white px-2 py-1 rounded text-sm"
                              >
                                 <option value="WANT_TO_WATCH">Want to Watch</option>
                                 <option value="IN_PROGRESS">In Progress</option>
                                 <option value="FINISHED">Finished</option>
                              </select>
                              <button
                                 type="submit"
                                 name="_action"
                                 value="updateStatus"
                                 className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-sm"
                              >
                                 Update
                              </button>
                           </Form>

                           {/* Remove Watcher */}
                           <Form method="post">
                              <input type="hidden" name="userId" value={watcher.userId} />
                              <button
                                 type="submit"
                                 name="_action"
                                 value="removeWatcher"
                                 className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-sm"
                                 onClick={(e) => {
                                    if (!confirm(`Remove ${watcher.userName} from this show?`)) {
                                       e.preventDefault();
                                    }
                                 }}
                              >
                                 Remove
                              </button>
                           </Form>
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
               <p className="text-gray-400">No watchers for this show.</p>
            )}
         </div>

         {availableUsers.length > 0 && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
               <h2 className="text-xl font-bold text-white mb-4">Add Watcher</h2>

               <Form method="post" className="flex gap-4 items-end">
                  <div>
                     <label htmlFor="userId" className="block text-sm font-medium text-gray-300 mb-2">
                        User
                     </label>
                     <select
                        name="userId"
                        required
                        className="bg-gray-700 text-white px-3 py-2 rounded"
                     >
                        <option value="">Select a user...</option>
                        {availableUsers.map((user) => (
                           <option key={user.id} value={user.id}>
                              {user.name}
                           </option>
                        ))}
                     </select>
                  </div>

                  <div>
                     <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-2">
                        Initial Status
                     </label>
                     <select
                        name="status"
                        defaultValue="WANT_TO_WATCH"
                        className="bg-gray-700 text-white px-3 py-2 rounded"
                     >
                        <option value="WANT_TO_WATCH">Want to Watch</option>
                        <option value="IN_PROGRESS">In Progress</option>
                     </select>
                  </div>

                  <button
                     type="submit"
                     name="_action"
                     value="addWatcher"
                     className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
                  >
                     Add Watcher
                  </button>
               </Form>
            </div>
         )}
      </div>
   );
}
