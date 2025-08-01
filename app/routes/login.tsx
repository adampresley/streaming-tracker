import { ActionFunctionArgs, LoaderFunctionArgs, Session, SessionData } from "@remix-run/node";
import { Form, useActionData, redirect, MetaFunction } from "@remix-run/react";
import { createUserSession, getUserSession, verifyPassword } from "~/auth.server";

export const meta: MetaFunction = () => {
   return [
      { title: "Login | Streaming Tracker" },
   ];
};

export async function loader({ request }: LoaderFunctionArgs) {
   const session: Session<SessionData, SessionData> = await getUserSession(request);
   const isAuthenticated: boolean = session.get("authenticated");
   const loginTime: number = session.get("loginTime");

   if (isAuthenticated && loginTime) {
      const now: number = Date.now();
      const fourHoursInMs: number = 4 * 60 * 60 * 1000;

      if (now - loginTime <= fourHoursInMs) {
         return redirect("/");
      }
   }

   return null;
}

export async function action({ request }: ActionFunctionArgs) {
   const formData: FormData = await request.formData();
   const password: FormDataEntryValue | null = formData.get("password");

   if (!password || typeof password !== "string") {
      return { error: "Password is required" };
   }

   if (!verifyPassword(password)) {
      return { error: "Invalid password" };
   }

   return await createUserSession(request);
}

export default function Login() {
   const actionData = useActionData<typeof action>();

   return (
      <div className="login-container">
         <div className="login-form">
            <div>
               <h2>
                  Sign in to Streaming Tracker
               </h2>
            </div>
            <Form method="post">
               <div>
                  <label htmlFor="password" className="sr-only">
                     Password
                  </label>
                  <input
                     id="password"
                     name="password"
                     type="password"
                     autoComplete="current-password"
                     required
                     placeholder="Password"
                  />
               </div>

               {actionData?.error && (
                  <div className="error-message">
                     {actionData.error}
                  </div>
               )}

               <div>
                  <button>
                     Sign in
                  </button>
               </div>
            </Form>
         </div>
      </div>
   );
}
