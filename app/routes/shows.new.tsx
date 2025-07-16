import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { db } from "~/db.server";
import { shows, showsToUsers } from "../../drizzle/schema";
import { requireAuth } from "~/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
   await requireAuth(request);
   const [allUsers, allPlatforms] = await Promise.all([
      db.query.users.findMany(),
      db.query.platforms.findMany(),
   ]);
   return { users: allUsers, platforms: allPlatforms };
};

export const action = async ({ request }: ActionFunctionArgs) => {
   await requireAuth(request);
   const formData = await request.formData();
   const name = formData.get("name") as string;
   const totalSeasons = Number(formData.get("totalSeasons"));
   const platformId = Number(formData.get("platformId"));
   const userIds = formData.getAll("userIds").map(Number);

   if (!name || !totalSeasons || !platformId || userIds.length === 0) {
      return new Response(JSON.stringify({ error: "All fields are required" }), { status: 400 });
   }

   // Create the show
   const [newShow] = await db
      .insert(shows)
      .values({ name, totalSeasons, platformId })
      .returning();

   // Link to users
   await db.insert(showsToUsers).values(
      userIds.map((userId) => ({
         showId: newShow.id,
         userId: userId,
         status: "WANT_TO_WATCH",
      }))
   );

   return redirect("/");
};

export default function NewShow() {
   const { users, platforms } = useLoaderData<typeof loader>();

   return (
      <div className="new-show-page">
         <h2>Add a New Show</h2>
         <Form method="post" className="card new-show-form">
            <div className="form-group">
               <label htmlFor="name">Show Name</label>
               <input
                  type="text"
                  name="name"
                  id="name"
                  required
               />
            </div>

            <div className="form-group">
               <label htmlFor="totalSeasons">Total Seasons</label>
               <input
                  type="number"
                  name="totalSeasons"
                  id="totalSeasons"
                  required
                  min="1"
               />
            </div>

            <div className="form-group">
               <label htmlFor="platformId">Platform</label>
               <select
                  name="platformId"
                  id="platformId"
                  required
               >
                  <option value="">Select a platform</option>
                  {platforms.map((p) => (
                     <option key={p.id} value={p.id}>
                        {p.name}
                     </option>
                  ))}
               </select>
            </div>

            <div className="form-group">
               <span>Who wants to watch?</span>
               <div className="checkbox-group">
                  {users.map((user) => (
                     <div key={user.id} className="checkbox-item">
                        <input
                           id={`user-${user.id}`}
                           name="userIds"
                           type="checkbox"
                           value={user.id}
                        />
                        <label htmlFor={`user-${user.id}`}>{user.name}</label>
                     </div>
                  ))}
               </div>
            </div>

            <div>
               <button className="primary full-width">Add Show</button>
            </div>
         </Form>
      </div>
   );
}
