import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { db } from "~/db.server";
import { shows } from "drizzle/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/auth.server";

export const action = async ({ request, params }: ActionFunctionArgs) => {
   await requireAuth(request);

   const showId: number = Number(params.showId);
   const formData: FormData = await request.formData();
   const cancelled: boolean = formData.get("cancelled") === "true";

   await db
      .update(shows)
      .set({ cancelled: !cancelled })
      .where(eq(shows.id, showId));

   return redirect("/shows/finished");
};
