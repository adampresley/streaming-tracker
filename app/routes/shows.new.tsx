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
      <div className="space-y-6">
         <h2 className="text-3xl font-bold text-teal-400">Add a New Show</h2>
         <Form method="post" className="bg-gray-800 p-6 rounded-lg space-y-4 max-w-lg mx-auto">
            <div>
               <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                  Show Name
               </label>
               <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white p-2"
               />
            </div>

            <div>
               <label htmlFor="totalSeasons" className="block text-sm font-medium text-gray-300">
                  Total Seasons
               </label>
               <input
                  type="number"
                  name="totalSeasons"
                  id="totalSeasons"
                  required
                  min="1"
                  className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white p-2"
               />
            </div>

            <div>
               <label htmlFor="platformId" className="block text-sm font-medium text-gray-300">
                  Platform
               </label>
               <select
                  name="platformId"
                  id="platformId"
                  required
                  className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white p-2"
               >
                  <option value="">Select a platform</option>
                  {platforms.map((p) => (
                     <option key={p.id} value={p.id}>
                        {p.name}
                     </option>
                  ))}
               </select>
            </div>

            <div>
               <span className="block text-sm font-medium text-gray-300">Who wants to watch?</span>
               <div className="mt-2 space-y-2">
                  {users.map((user) => (
                     <div key={user.id} className="flex items-center">
                        <input
                           id={`user-${user.id}`}
                           name="userIds"
                           type="checkbox"
                           value={user.id}
                           className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <label htmlFor={`user-${user.id}`} className="ml-3 text-sm text-gray-300">
                           {user.name}
                        </label>
                     </div>
                  ))}
               </div>
            </div>

            <div>
               <button
                  type="submit"
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"
               >
                  Add Show
               </button>
            </div>
         </Form>
      </div>
   );
}
