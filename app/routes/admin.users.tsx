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

function DeleteUserButton({ user, showCount, onDelete, variant = "link" }: { user: { id: number; name: string }, showCount: number, onDelete: () => void, variant?: "link" | "button" }) {
   const [showConfirmation, setShowConfirmation] = useState(false);

   if (showCount > 0) {
      return (
         <span className="disabled-reason">
            Cannot delete (attached to {showCount} show{showCount !== 1 ? 's' : ''})
         </span>
      );
   }

   return (
      <>
         <button
            onClick={() => setShowConfirmation(true)}
            className={variant === "button" ? "danger small" : "danger-link"}
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
      <div className="admin-page">
         <h2>Manage Users</h2>

         <div className="card">
            <h3>Add New User</h3>
            <Form method="post" className="add-user-form" ref={formRef}>
               <input
                  type="text"
                  name="userName"
                  placeholder="Enter new user name"
               />
               <button
                  name="_action"
                  value="createUser"
                  className="primary"
               >
                  Add User
               </button>
            </Form>
         </div>

         <Form method="post" ref={deleteFormRef} style={{ display: "none" }}>
            <input type="hidden" name="userId" />
            <input type="hidden" name="_action" value="deleteUser" />
         </Form>

         <div className="card table-view">
            <ul className="user-list">
               {users.map((user) => (
                  <li key={user.id}>
                     {editingUserId === user.id ? (
                        <Form method="post" className="edit-user-form">
                           <input type="hidden" name="userId" value={user.id} />
                           <input
                              type="text"
                              name="userName"
                              defaultValue={user.name}
                           />
                           <button
                              name="_action"
                              value="updateUser"
                              className="primary"
                           >
                              Save
                           </button>
                           <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="cancel"
                           >
                              Cancel
                           </button>
                        </Form>
                     ) : (
                        <>
                           <span>{user.name}</span>
                           <div className="user-actions">
                              <button
                                 onClick={() => setEditingUserId(user.id)}
                                 className="edit-link"
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

         <div className="card-view">
            {users.map((user) => (
               <div key={user.id} className="card user-card">
                  {editingUserId === user.id ? (
                     <Form method="post" className="edit-user-form">
                        <input type="hidden" name="userId" value={user.id} />
                        <div className="user-card-content">
                           <input
                              type="text"
                              name="userName"
                              defaultValue={user.name}
                           />
                           <div className="user-card-actions">
                              <button
                                 name="_action"
                                 value="updateUser"
                                 className="primary small"
                              >
                                 Save
                              </button>
                              <button
                                 type="button"
                                 onClick={() => setEditingUserId(null)}
                                 className="cancel small"
                              >
                                 Cancel
                              </button>
                           </div>
                        </div>
                     </Form>
                  ) : (
                     <div className="user-card-content">
                        <div className="user-card-info">
                           <h4>{user.name}</h4>
                           <p className="user-show-count">{user.showCount} show{user.showCount !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="user-card-actions">
                           <button
                              onClick={() => setEditingUserId(user.id)}
                              className="secondary small"
                           >
                              Edit
                           </button>
                           <DeleteUserButton
                              user={user}
                              showCount={user.showCount}
                              onDelete={() => handleDeleteUser(user.id)}
                              variant="button"
                           />
                        </div>
                     </div>
                  )}
               </div>
            ))}
         </div>
      </div>
   );
}
