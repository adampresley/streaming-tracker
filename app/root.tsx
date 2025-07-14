import {
   Links,
   Meta,
   Outlet,
   Scripts,
   ScrollRestoration,
   NavLink,
   useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { isAuthenticated } from "./auth.server";
import { version } from "../package.json";

import stylesheet from "./tailwind.css?url";

export const links: LinksFunction = () => [
   { rel: "stylesheet", href: stylesheet },
];

export async function loader({ request }: LoaderFunctionArgs) {
   const isAuth = await isAuthenticated(request);
   return { isAuthenticated: isAuth, appVersion: version };
}

export function Layout({ children }: { children: React.ReactNode }) {
   return (
      <html lang="en" className="bg-gray-900 text-white">
         <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <Meta />
            <Links />
         </head>
         <body className="font-sans">
            {children}
            <ScrollRestoration />
            <Scripts />
         </body>
      </html>
   );
}

export default function App() {
   const { isAuthenticated: isAuth, appVersion } = useLoaderData<typeof loader>();

   return (
      <>
         {isAuth && (
            <header className="bg-gray-800 p-4 shadow-md">
               <div className="container mx-auto flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-teal-400">
                     Streaming Tracker
                  </h1>
                  <nav>
                     <ul className="flex space-x-4">
                        <li>
                           <NavLink
                              to="/"
                              className={({ isActive }) =>
                                 `hover:text-teal-300 ${isActive ? "text-teal-400 font-bold" : ""
                                 }`
                              }
                           >
                              Dashboard
                           </NavLink>
                        </li>
                        <li>
                           <NavLink
                              to="/shows/finished"
                              className={({ isActive }) =>
                                 `hover:text-teal-300 ${isActive ? "text-teal-400 font-bold" : ""
                                 }`
                              }
                           >
                              Finished Shows
                           </NavLink>
                        </li>
                        <li>
                           <NavLink
                              to="/admin/users"
                              className={({ isActive }) =>
                                 `hover:text-teal-300 ${isActive ? "text-teal-400 font-bold" : ""
                                 }`
                              }
                           >
                              Users
                           </NavLink>
                        </li>
                        <li>
                           <NavLink
                              to="/admin/platforms"
                              className={({ isActive }) =>
                                 `hover:text-teal-300 ${isActive ? "text-teal-400 font-bold" : ""
                                 }`
                              }
                           >
                              Platforms
                           </NavLink>
                        </li>
                        <li>
                           <NavLink
                              to="/shows/new"
                              className={({ isActive }) =>
                                 `hover:text-teal-300 ${isActive ? "text-teal-400 font-bold" : ""
                                 }`
                              }
                           >
                              Add Show
                           </NavLink>
                        </li>
                        <li>
                           <NavLink
                              to="/logout"
                              className="hover:text-red-300 text-red-400"
                           >
                              Logout
                           </NavLink>
                        </li>
                     </ul>
                  </nav>
               </div>
            </header>
         )}
         <main className={`container mx-auto p-4 ${isAuth ? "" : "min-h-screen"}`}>
            <Outlet />
         </main>
         <footer className="bg-gray-800 p-4 text-center text-gray-400">
            <p>Version: {appVersion}</p>
         </footer>
      </>
   );
}
