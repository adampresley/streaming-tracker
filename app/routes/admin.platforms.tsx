import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { db } from "~/db.server";
import { platforms, shows } from "../../drizzle/schema";
import { eq, asc, count } from "drizzle-orm";
import { useState, useRef, useEffect } from "react";
import ConfirmationPopup from "~/components/ConfirmationPopup";
import { requireAuth } from "~/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
   await requireAuth(request);
   const platformsWithShowCounts = await db
      .select({
         id: platforms.id,
         name: platforms.name,
         showCount: count(shows.id)
      })
      .from(platforms)
      .leftJoin(shows, eq(platforms.id, shows.platformId))
      .orderBy(asc(platforms.name))
      .groupBy(platforms.id, platforms.name);

   return { platforms: platformsWithShowCounts };
};

export const action = async ({ request }: ActionFunctionArgs) => {
   await requireAuth(request);
   const formData = await request.formData();
   const action = formData.get("_action");
   const platformId = Number(formData.get("platformId"));
   const platformName = formData.get("platformName") as string;

   switch (action) {
      case "createPlatform": {
         if (!platformName) return new Response(JSON.stringify({ error: "Platform name is required" }), { status: 400 });
         await db.insert(platforms).values({ name: platformName });
         break;
      }
      case "updatePlatform": {
         if (!platformName) return new Response(JSON.stringify({ error: "Platform name is required" }), { status: 400 });
         await db.update(platforms).set({ name: platformName }).where(eq(platforms.id, platformId));
         break;
      }
      case "deletePlatform": {
         // Check if platform is attached to any shows
         const platformShows = await db.query.shows.findMany({
            where: eq(shows.platformId, platformId)
         });

         if (platformShows.length > 0) {
            return new Response(JSON.stringify({ error: "Cannot delete platform attached to shows" }), { status: 400 });
         }

         await db.delete(platforms).where(eq(platforms.id, platformId));
         break;
      }
   }

   return redirect("/admin/platforms");
};

function DeletePlatformButton({ platform, showCount, onDelete, variant = "link" }: { platform: { id: number; name: string }, showCount: number, onDelete: () => void, variant?: "link" | "button" }) {
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
            className={variant === "button" ? "button danger small" : "danger-link"}
         >
            Delete
         </button>
         <ConfirmationPopup
            isOpen={showConfirmation}
            onConfirm={onDelete}
            onCancel={() => setShowConfirmation(false)}
            title="Delete Platform"
            message={`Are you sure you want to delete the platform "${platform.name}"? This action cannot be undone.`}
            confirmText="Yes, Delete"
            cancelText="Cancel"
         />
      </>
   );
}

export default function AdminPlatforms() {
   const { platforms } = useLoaderData<typeof loader>();
   const [editingPlatformId, setEditingPlatformId] = useState<number | null>(null);
   const formRef = useRef<HTMLFormElement>(null);
   const deleteFormRef = useRef<HTMLFormElement>(null);

   useEffect(() => {
      if (formRef.current) {
         formRef.current.reset();
      }
   }, [platforms]);

   const handleDeletePlatform = (platformId: number) => {
      if (deleteFormRef.current) {
         const platformIdInput = deleteFormRef.current.querySelector('input[name="platformId"]') as HTMLInputElement;
         if (platformIdInput) {
            platformIdInput.value = platformId.toString();
         }
         deleteFormRef.current.submit();
      }
   };

   return (
      <div className="admin-page">
         <h2>Manage Platforms</h2>

         <div className="card">
            <h3>Add New Platform</h3>
            <Form method="post" className="add-platform-form" ref={formRef}>
               <input
                  type="text"
                  name="platformName"
                  placeholder="Enter new platform name"
               />
               <button
                  type="submit"
                  name="_action"
                  value="createPlatform"
                  className="primary"
               >
                  Add Platform
               </button>
            </Form>
         </div>

         <Form method="post" ref={deleteFormRef} style={{ display: "none" }}>
            <input type="hidden" name="platformId" />
            <input type="hidden" name="_action" value="deletePlatform" />
         </Form>

         <div className="card table-view">
            <ul className="platform-list">
               {platforms.map((platform) => (
                  <li key={platform.id}>
                     {editingPlatformId === platform.id ? (
                        <Form method="post" className="edit-platform-form">
                           <input type="hidden" name="platformId" value={platform.id} />
                           <input
                              type="text"
                              name="platformName"
                              defaultValue={platform.name}
                           />
                           <button
                              type="submit"
                              name="_action"
                              value="updatePlatform"
                              className="primary"
                           >
                              Save
                           </button>
                           <button
                              type="button"
                              onClick={() => setEditingPlatformId(null)}
                              className="cancel"
                           >
                              Cancel
                           </button>
                        </Form>
                     ) : (
                        <>
                           <span>{platform.name}</span>
                           <div className="platform-actions">
                              <button
                                 onClick={() => setEditingPlatformId(platform.id)}
                                 className="edit-link"
                              >
                                 Edit
                              </button>
                              <DeletePlatformButton 
                                 platform={platform} 
                                 showCount={platform.showCount}
                                 onDelete={() => handleDeletePlatform(platform.id)} 
                              />
                           </div>
                        </>
                     )}
                  </li>
               ))}
            </ul>
         </div>

         <div className="card-view">
            {platforms.map((platform) => (
               <div key={platform.id} className="card platform-card">
                  {editingPlatformId === platform.id ? (
                     <Form method="post" className="edit-platform-form">
                        <input type="hidden" name="platformId" value={platform.id} />
                        <div className="platform-card-content">
                           <input
                              type="text"
                              name="platformName"
                              defaultValue={platform.name}
                           />
                           <div className="platform-card-actions">
                              <button
                                 type="submit"
                                 name="_action"
                                 value="updatePlatform"
                                 className="button primary small"
                              >
                                 Save
                              </button>
                              <button
                                 type="button"
                                 onClick={() => setEditingPlatformId(null)}
                                 className="button cancel small"
                              >
                                 Cancel
                              </button>
                           </div>
                        </div>
                     </Form>
                  ) : (
                     <div className="platform-card-content">
                        <div className="platform-card-info">
                           <h4>{platform.name}</h4>
                           <p className="platform-show-count">{platform.showCount} show{platform.showCount !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="platform-card-actions">
                           <button
                              onClick={() => setEditingPlatformId(platform.id)}
                              className="button secondary small"
                           >
                              Edit
                           </button>
                           <DeletePlatformButton 
                              platform={platform} 
                              showCount={platform.showCount}
                              onDelete={() => handleDeletePlatform(platform.id)} 
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
