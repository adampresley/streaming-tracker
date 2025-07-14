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
      <div className="bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col justify-between">
         <div className="flex justify-between items-start">
            <div>
               <h4 className="text-lg font-bold text-white">{show.name}</h4>
               <p className="text-sm text-gray-400">{show.platformName}</p>
               {status === "IN_PROGRESS" && (
                  <p className="text-sm text-gray-300 mt-2">
                     Season {show.currentSeason} of {show.totalSeasons}
                  </p>
               )}
               {status === "WANT_TO_WATCH" && (
                  <p className="text-sm text-gray-300 mt-2">
                     {show.currentSeason > 1 
                        ? `${show.currentSeason - 1} of ${show.totalSeasons} seasons watched`
                        : `${show.totalSeasons} season${show.totalSeasons > 1 ? 's' : ''}`
                     }
                  </p>
               )}
            </div>
            {status === "IN_PROGRESS" && (
               <div className="relative" ref={dropdownRef}>
                  <button
                     onClick={() => setShowDropdown(!showDropdown)}
                     className="text-gray-400 hover:text-white p-1 rounded"
                  >
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                     </svg>
                  </button>
                  {showDropdown && (
                     <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-10">
                        <Form method="post">
                           <input type="hidden" name="showId" value={show.id} />
                           <button
                              type="submit"
                              name="_action"
                              value="setToWantToWatch"
                              className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                           >
                              Set to 'Want to Watch'
                           </button>
                        </Form>
                     </div>
                  )}
               </div>
            )}
         </div>
         <div className="mt-4 flex gap-2">
            {status === "IN_PROGRESS" ? (
               <Form method="post">
                  <input type="hidden" name="showId" value={show.id} />
                  <input type="hidden" name="currentSeason" value={show.currentSeason} />
                  <input type="hidden" name="totalSeasons" value={show.totalSeasons} />
                  <button
                     type="submit"
                     name="_action"
                     value="completeSeason"
                     className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded text-sm"
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
                     className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-sm"
                  >
                     Start Watching
                  </button>
               </Form>
            )}
         </div>
      </div>
   );
}
