import { Form } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";

interface ShowInfo {
   id: number;
   name: string;
   totalSeasons: number;
   currentSeason: number;
   platformName: string;
   watchers: string[];
}

export function ShowCard({
   show,
   status,
}: {
   show: ShowInfo;
   status: "IN_PROGRESS" | "WANT_TO_WATCH";
}) {
   const [showDropdown, setShowDropdown] = useState(false);
   const dropdownRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
         if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setShowDropdown(false);
         }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
         document.removeEventListener("mousedown", handleClickOutside);
      };
   }, []);

   return (
      <div className="show-card">
         <div className="show-card-header">
            <div>
               <h4>{show.name}</h4>
               <p>{show.platformName}</p>
               {status === "IN_PROGRESS" && (
                  <p>
                     Season {show.currentSeason} of {show.totalSeasons}
                  </p>
               )}
               {status === "WANT_TO_WATCH" && (
                  <p>
                     {show.currentSeason > 1
                        ? `${show.currentSeason - 1} of ${show.totalSeasons} seasons watched`
                        : `${show.totalSeasons} season${show.totalSeasons > 1 ? 's' : ''}`
                     }
                  </p>
               )}
            </div>
            {status === "IN_PROGRESS" && (
               <div className="dropdown-container" ref={dropdownRef}>
                  <button
                     onClick={() => setShowDropdown(!showDropdown)}
                     className="dropdown-trigger"
                     title="Actions"
                     aria-label="Actions"
                     aria-haspopup="true"
                  >
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                     </svg>
                  </button>
                  {showDropdown && (
                     <div className="dropdown-menu">
                        <Form method="post">
                           <input type="hidden" name="showId" value={show.id} />
                           <button
                              type="submit"
                              name="_action"
                              value="setToWantToWatch"
                           >
                              Set to 'Want to Watch'
                           </button>
                        </Form>
                     </div>
                  )}
               </div>
            )}
         </div>
         <div className="show-card-actions">
            {status === "IN_PROGRESS" ? (
               <Form method="post">
                  <input type="hidden" name="showId" value={show.id} />
                  <input type="hidden" name="currentSeason" value={show.currentSeason} />
                  <input type="hidden" name="totalSeasons" value={show.totalSeasons} />
                  <button
                     type="submit"
                     name="_action"
                     value="completeSeason"
                     className="primary"
                  >
                     ✓ Finish Season {show.currentSeason}
                  </button>
               </Form>
            ) : (
               <Form method="post">
                  <input type="hidden" name="showId" value={show.id} />
                  <button
                     type="submit"
                     name="_action"
                     value="startWatching"
                     className="secondary"
                  >
                     Start Watching
                  </button>
               </Form>
            )}
         </div>
      </div>
   );
}
