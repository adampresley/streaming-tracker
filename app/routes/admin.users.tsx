import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { db } from "~/db.server";
import { users, showsToUsers } from "../../drizzle/schema";
import { eq, count, asc } from "drizzle-orm";
import { useState, useRef, useEffect } from "react";
import ConfirmationPopup from "~/components/ConfirmationPopup";
import { requireAuth } from "~/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
   await requireAuth(request);
   const usersWithShowCounts = await db
      .select({
         id: users.id,
         name: users.name,
         showCount: count(showsToUsers.showId)
      })
      .from(users)
      .leftJoin(showsToUsers, eq(users.id, showsToUsers.userId))
      .orderBy(asc(users.name))
      .groupBy(users.id, users.name);

   return { users: usersWithShowCounts };
};

export const action = async ({ request }: ActionFunctionArgs) => {
   await requireAuth(request);
   const formData = await request.formData();
   const action = formData.get("_action");
   const userId = Number(formData.get("userId"));
   const userName = formData.get("userName") as string;

   switch (action) {
      case "createUser": {
         if (!userName) return new Response(JSON.stringify({ error: "User name is required" }), { status: 400 });
         await db.insert(users).values({ name: userName });
         break;
      }
      case "updateUser": {
         if (!userName) return new Response(JSON.stringify({ error: "User name is required" }), { status: 400 });
         await db.update(users).set({ name: userName }).where(eq(users.id, userId));
         break;
      }
      case "deleteUser": {
         // Check if user is attached to any shows
         const userShows = await db.query.showsToUsers.findMany({
            where: eq(showsToUsers.userId, userId)
         });

         if (userShows.length > 0) {
            return new Response(JSON.stringify({ error: "Cannot delete user attached to shows" }), { status: 400 });
         }

         await db.delete(users).where(eq(users.id, userId));
         break;
      }
   }

   return redirect("/admin/users");
};

function DeleteUserButton({ user, showCount, onDelete }: { user: { id: number; name: string }, showCount: number, onDelete: () => void }) {
   const [showConfirmation, setShowConfirmation] = useState(false);

   if (showCount > 0) {
      return (
         <span className="text-gray-500 text-sm">
            Cannot delete (attached to {showCount} show{showCount !== 1 ? 's' : ''})
         </span>
      );
   }

   return (
      <>
         <button
            onClick={() => setShowConfirmation(true)}
            className="text-red-400 hover:text-red-200"
         >
            Delete
         </button>
         <ConfirmationPopup
            isOpen={showConfirmation}
            onConfirm={onDelete}
            onCancel={() => setShowConfirmation(false)}
            title="Delete User"
            message={`Are you sure you want to delete the user "${user.name}"? This action cannot be undone.`}
            confirmText="Yes, Delete"
            cancelText="Cancel"
         />
      </>
   );
}

export default function AdminUsers() {
   const { users } = useLoaderData<typeof loader>();
   const [editingUserId, setEditingUserId] = useState<number | null>(null);
   const formRef = useRef<HTMLFormElement>(null);
   const deleteFormRef = useRef<HTMLFormElement>(null);

   useEffect(() => {
      if (formRef.current) {
         formRef.current.reset();
      }
   }, [users]);

   const handleDeleteUser = (userId: number) => {
      if (deleteFormRef.current) {
         const userIdInput = deleteFormRef.current.querySelector('input[name="userId"]') as HTMLInputElement;
         if (userIdInput) {
            userIdInput.value = userId.toString();
         }
         deleteFormRef.current.submit();
      }
   };

   return (
      <div className="space-y-6">
         <h2 className="text-3xl font-bold text-teal-400">Manage Users</h2>

         <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-xl font-bold mb-2">Add New User</h3>
            <Form method="post" className="flex gap-4" ref={formRef}>
               <input
                  type="text"
                  name="userName"
                  placeholder="Enter new user name"
                  className="flex-grow bg-gray-700 border-gray-600 rounded-md shadow-sm text-white p-2"
               />
               <button
                  type="submit"
                  name="_action"
                  value="createUser"
                  className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded"
               >
                  Add User
               </button>
            </Form>
         </div>

         <Form method="post" ref={deleteFormRef} style={{ display: "none" }}>
            <input type="hidden" name="userId" />
            <input type="hidden" name="_action" value="deleteUser" />
         </Form>

         <div className="bg-gray-800 shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-gray-700">
               {users.map((user) => (
                  <li key={user.id} className="p-4 flex justify-between items-center">
                     {editingUserId === user.id ? (
                        <Form method="post" className="flex-grow flex gap-4">
                           <input type="hidden" name="userId" value={user.id} />
                           <input
                              type="text"
                              name="userName"
                              defaultValue={user.name}
                              className="flex-grow bg-gray-700 border-gray-600 rounded-md shadow-sm text-white p-2"
                           />
                           <button
                              type="submit"
                              name="_action"
                              value="updateUser"
                              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-2 rounded"
                           >
                              Save
                           </button>
                           <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-2 rounded"
                           >
                              Cancel
                           </button>
                        </Form>
                     ) : (
                        <>
                           <span className="text-white">{user.name}</span>
                           <div className="flex gap-4">
                              <button
                                 onClick={() => setEditingUserId(user.id)}
                                 className="text-blue-400 hover:text-blue-200"
                              >
                                 Edit
                              </button>
                              <DeleteUserButton 
                                 user={user} 
                                 showCount={user.showCount} 
                                 onDelete={() => handleDeleteUser(user.id)} 
                              />
                           </div>
                        </>
                     )}
                  </li>
               ))}
            </ul>
         </div>
      </div>
   );
}
