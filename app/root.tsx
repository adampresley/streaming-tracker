import { useState } from "react";
import { NavLink, Outlet, Scripts, ScrollRestoration, useLoaderData, Meta, Links } from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { isAuthenticated } from "./auth.server";
import { version } from "../package.json";

import stylesheet from "./styles/app.css?url";

export const links: LinksFunction = () => [
   { rel: "stylesheet", href: stylesheet },
];

export async function loader({ request }: LoaderFunctionArgs) {
   const isAuth = await isAuthenticated(request);
   return { isAuthenticated: isAuth, appVersion: version };
}

export function Layout({ children }: { children: React.ReactNode }) {
   return (
      <html lang="en">
         <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <Meta />
            <Links />
         </head>
         <body>
            {children}
            <ScrollRestoration />
            <Scripts />
         </body>
      </html>
   );
}

export default function App() {
   const { isAuthenticated: isAuth, appVersion } = useLoaderData<typeof loader>();
   const [isMenuOpen, setIsMenuOpen] = useState(false);

   return (
      <>
         {isAuth && (
            <header>
               <h1>
                  Streaming Tracker
               </h1>
               <button className="hamburger-menu" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                  &#9776;
               </button>
               <nav className={isMenuOpen ? "mobile-menu open" : "mobile-menu"}>
                  <ul>
                     <li>
                        <NavLink
                           to="/"
                           className={({ isActive }) =>
                              isActive ? "active" : ""
                           }
                           onClick={() => setIsMenuOpen(false)}
                        >
                           Dashboard
                        </NavLink>
                     </li>
                     <li>
                        <NavLink
                           to="/shows/finished"
                           className={({ isActive }) =>
                              isActive ? "active" : ""
                           }
                           onClick={() => setIsMenuOpen(false)}
                        >
                           Finished Shows
                        </NavLink>
                     </li>
                     <li>
                        <NavLink
                           to="/admin/users"
                           className={({ isActive }) =>
                              isActive ? "active" : ""
                           }
                           onClick={() => setIsMenuOpen(false)}
                        >
                           Users
                        </NavLink>
                     </li>
                     <li>
                        <NavLink
                           to="/admin/platforms"
                           className={({ isActive }) =>
                              isActive ? "active" : ""
                           }
                           onClick={() => setIsMenuOpen(false)}
                        >
                           Platforms
                        </NavLink>
                     </li>
                     <li>
                        <NavLink
                           to="/shows/new"
                           className={({ isActive }) =>
                              isActive ? "active" : ""
                           }
                           onClick={() => setIsMenuOpen(false)}
                        >
                           Add Show
                        </NavLink>
                     </li>
                     <li>
                        <NavLink
                           to="/logout"
                           className="logout"
                           onClick={() => setIsMenuOpen(false)}
                        >
                           Logout
                        </NavLink>
                     </li>
                  </ul>
               </nav>
            </header>
         )}
         <main className={isAuth ? "" : "logged-out"}>
            <div className="container">
               <Outlet />
            </div>
         </main>
         <footer>
            <div className="container">
               <p>Version: {appVersion}</p>
            </div>
         </footer>
      </>
   );
}
