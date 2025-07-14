import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, redirect } from "@remix-run/react";
import { createUserSession, getUserSession, verifyPassword } from "~/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getUserSession(request);
  const isAuthenticated = session.get("authenticated");
  const loginTime = session.get("loginTime");
  
  if (isAuthenticated && loginTime) {
    const now = Date.now();
    const fourHoursInMs = 4 * 60 * 60 * 1000;
    
    if (now - loginTime <= fourHoursInMs) {
      return redirect("/");
    }
  }
  
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const password = formData.get("password");
  
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
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to Streaming Tracker
          </h2>
        </div>
        <Form className="mt-8 space-y-6" method="post">
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
              className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
              placeholder="Password"
            />
          </div>
          
          {actionData?.error && (
            <div className="text-red-500 text-sm text-center">
              {actionData.error}
            </div>
          )}
          
          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              Sign in
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}