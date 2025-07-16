import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { db } from "~/db.server";
import { showsToUsers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "@remix-run/node";
import { requireAuth } from "~/auth.server";
import { ShowStatus } from "~/types/db-types";
import { formatUserStatus } from "~/services/userStatus";

interface ShowEditInfo {
   id: number;
   name: string;
   totalSeasons: number;
   platformName: string;
   watchers: Array<{
      userId: number;
      userName: string;
      status: ShowStatus;
      currentSeason: number;
   }>;
   allUsers: Array<{
      id: number;
      name: string;
   }>;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
   await requireAuth(request);

   const showId: number = Number(params.showId);

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

   const showId: number = Number(params.showId);
   const formData: FormData = await request.formData();
   const action: FormDataEntryValue | null = formData.get("_action");

   if (action === "addWatcher") {
      const userId: number = Number(formData.get("userId"));
      const status: ShowStatus = formData.get("status") as ShowStatus;

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
            status: status || "WANT_TO_WATCH" as ShowStatus,
            currentSeason: 1,
         });
      }
   }

   if (action === "removeWatcher") {
      const userId: number = Number(formData.get("userId"));

      await db
         .delete(showsToUsers)
         .where(and(
            eq(showsToUsers.showId, showId),
            eq(showsToUsers.userId, userId)
         ));
   }

   if (action === "updateStatus") {
      const userId: number = Number(formData.get("userId"));
      const newStatus: ShowStatus = formData.get("newStatus") as ShowStatus;

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
      <div className="edit-show-page">
         <div className="page-header">
            <h1>Edit Show: {show.name}</h1>
            <Link
               to="/shows/manage"
               className="button secondary"
            >
               Back to Manage Shows
            </Link>
         </div>

         <div className="card show-details-card">
            <h2>Show Details</h2>
            <p>Platform: {show.platformName}</p>
            <p>Total Seasons: {show.totalSeasons}</p>
         </div>

         <div className="card watchers-card">
            <h2>Current Watchers</h2>

            {show.watchers.length > 0 ? (
               <div className="watcher-list">
                  {show.watchers.map((watcher) => (
                     <div key={watcher.userId} className="watcher-item">
                        <div className="watcher-info">
                           <h3>{watcher.userName}</h3>
                           <p>
                              Status: {formatUserStatus(watcher.status)}
                              {watcher.status === "IN_PROGRESS" && ` (Season ${watcher.currentSeason})`}
                           </p>
                        </div>

                        <div className="watcher-actions">
                           <Form method="post" className="update-status-form">
                              <input type="hidden" name="userId" value={watcher.userId} />
                              <select
                                 name="newStatus"
                                 defaultValue={watcher.status}
                              >
                                 <option value="WANT_TO_WATCH">Want to Watch</option>
                                 <option value="IN_PROGRESS">Watching</option>
                                 <option value="FINISHED">Finished</option>
                              </select>
                              <button
                                 name="_action"
                                 value="updateStatus"
                                 className="primary small"
                              >
                                 Update
                              </button>
                           </Form>

                           <Form method="post">
                              <input type="hidden" name="userId" value={watcher.userId} />
                              <button
                                 name="_action"
                                 value="removeWatcher"
                                 className="danger small"
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
               <p>No watchers for this show.</p>
            )}
         </div>

         {availableUsers.length > 0 && (
            <div className="card add-watcher-card">
               <h2>Add Watcher</h2>

               <Form method="post" className="add-watcher-form">
                  <div className="form-group">
                     <label htmlFor="userId">User</label>
                     <select
                        name="userId"
                        required
                     >
                        <option value="">Select a user...</option>
                        {availableUsers.map((user) => (
                           <option key={user.id} value={user.id}>
                              {user.name}
                           </option>
                        ))}
                     </select>
                  </div>

                  <div className="form-group">
                     <label htmlFor="status">Initial Status</label>
                     <select
                        name="status"
                        defaultValue="WANT_TO_WATCH"
                     >
                        <option value="WANT_TO_WATCH">Want to Watch</option>
                        <option value="IN_PROGRESS">Watching</option>
                        <option value="FINISHED">Finished</option>
                     </select>
                  </div>

                  <button
                     name="_action"
                     value="addWatcher"
                     className="secondary"
                  >
                     Add Watcher
                  </button>
               </Form>
            </div>
         )}
      </div>
   );
}
