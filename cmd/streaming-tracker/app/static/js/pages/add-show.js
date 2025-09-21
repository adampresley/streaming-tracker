document.addEventListener("DOMContentLoaded", () => {
   const showNameEl = document.querySelector("#showName");
   const totalSeasonsEl = document.querySelector("#totalSeasons");
   const platformEl = document.querySelector("#platform");
   const watchersCheckboxes = document.querySelectorAll('input[name="watchers"]');
   const form = document.querySelector("#addShowForm");
   const searchResults = document.querySelector("#searchResults");
   const searchResultsList = document.querySelector("#searchResultsList");
   const searchLoading = document.querySelector("#searchLoading");
   const clearSearchBtn = document.querySelector("#clearSearch");

   let searchTimeout;
   let currentSelectedShow = null;

   /*
    * Define fields and their validation functions
    */
   const fields = [
      {
         field: showNameEl,
         validityFunc: validateShowName,
         events: {
            "input": (e) => {
               validateShowName(e.target);
               handleShowNameInput(e.target.value);
            },
            "focus": () => {
               if (searchResultsList.children.length > 0) {
                  searchResults.style.display = "block";
               }
            },
            "keydown": (e) => handleShowNameKeydown(e),
         },
      },
      { 
         field: totalSeasonsEl, 
         validityFunc: validateTotalSeasons,
         events: {
            "input": (e) => validateTotalSeasons(e.target),
         },
      },
      { 
         field: platformEl, 
         validityFunc: validatePlatform,
         events: {
            "change": (e) => validatePlatform(e.target),
         },
      },
   ];

   /*
    * Attach event listeners to fields
    */
   fields.forEach((f) => {
      Object.entries(f.events).forEach(([event, handler]) => {
         f.field.addEventListener(event, handler);
      });
   });

   /*
    * Attach event listeners to watcher checkboxes
    */
   watchersCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", validateWatchers);
   });

   /*
    * Setup form for custom validation
    */
   form.noValidate = true;
   form.addEventListener("submit", (e) => validateForm(e, fields));

   /*
    * Setup clear search button
    */
   clearSearchBtn.addEventListener("click", clearSearch);

   /*
    * Hide search results when clicking outside
    */
   document.addEventListener("click", (e) => {
      if (!searchResults.contains(e.target) && e.target !== showNameEl) {
         searchResults.style.display = "none";
      }
   });

   /*
    * Search functionality
    */
   function handleShowNameInput(value) {
      clearTimeout(searchTimeout);

      if (value.trim().length < 3) {
         clearSearch();
         return;
      }

      searchTimeout = setTimeout(() => {
         performSearch(value.trim());
      }, 500);
   }

   function handleShowNameKeydown(e) {
      const resultItems = searchResultsList.querySelectorAll(".search-result-item");

      if (e.key === "Escape") {
         clearSearch();
         return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
         e.preventDefault();
         navigateResults(resultItems, e.key === "ArrowDown");
      }

      if (e.key === "Enter" && currentSelectedShow) {
         e.preventDefault();
         selectShow(currentSelectedShow);
      }
   }

   function navigateResults(items, down) {
      const current = searchResultsList.querySelector(".search-result-item.selected");
      let newIndex = 0;

      if (current) {
         current.classList.remove("selected");
         const currentIndex = Array.from(items).indexOf(current);
         newIndex = down
            ? Math.min(currentIndex + 1, items.length - 1)
            : Math.max(currentIndex - 1, 0);
      }

      if (items[newIndex]) {
         items[newIndex].classList.add("selected");
         items[newIndex].scrollIntoView({ block: "nearest" });
      }
   }

   async function performSearch(searchTerm) {
      try {
         searchLoading.style.display = "block";
         searchResults.style.display = "block";

         const response = await fetch(`/shows/search?term=${encodeURIComponent(searchTerm)}`);

         if (!response.ok) {
            throw new Error("Search failed");
         }

         const results = await response.json();
         displaySearchResults(results);

      } catch (error) {
         console.error("Search error:", error);
         searchResultsList.innerHTML = '<div class="search-error">Search failed. Please try again.</div>';
      } finally {
         searchLoading.style.display = "none";
      }
   }

   function displaySearchResults(results) {
      searchResultsList.innerHTML = "";

      if (results.length === 0) {
         searchResultsList.innerHTML = '<div class="search-no-results">No shows found</div>';
         return;
      }

      results.forEach((show, index) => {
         const resultItem = document.createElement("div");
         resultItem.className = "search-result-item";
         resultItem.dataset.showData = JSON.stringify(show);

         const platformsText = show.platforms && show.platforms.length > 0
            ? show.platforms.map(p => p.name).join(", ")
            : show.rawPlatformNames.join(", ");

         resultItem.innerHTML = `
            <div class="search-result-title">${escapeHtml(show.name)}</div>
            <div class="search-result-platforms">${escapeHtml(platformsText)}</div>
            ${show.imageUrls.length > 0
               ? `<img src="${escapeHtml(show.imageUrls[0])}" alt="${escapeHtml(show.name)}" class="search-result-image" loading="lazy">`
               : ""
            }
         `;

         resultItem.addEventListener("click", () => selectShow(show));
         resultItem.addEventListener("mouseenter", () => {
            searchResultsList.querySelectorAll(".search-result-item").forEach(item =>
               item.classList.remove("selected")
            );
            resultItem.classList.add("selected");
         });

         searchResultsList.appendChild(resultItem);
      });
   }

   function selectShow(show) {
      console.log(show);

      showNameEl.value = show.name;
      currentSelectedShow = show;

      totalSeasonsEl.value = show.numSeasons;

      // Auto-select platform if we have a match
      if (show.platforms && show.platforms.length > 0) {
         const firstPlatform = show.platforms[0];
         platformEl.value = firstPlatform.id;
         validatePlatform(platformEl);
      }

      clearSearch();
      totalSeasonsEl.focus();
   }

   function clearSearch() {
      searchResults.style.display = "none";
      searchResultsList.innerHTML = "";
      currentSelectedShow = null;
      clearTimeout(searchTimeout);
   }

   function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
   }
});

function validateForm(e, fields) {
   const form = e.target;

   fields.forEach((f) => {
      f.validityFunc(f.field);
   });

   validateWatchers();

   if (!form.checkValidity()) {
      e.preventDefault();
      e.stopImmediatePropagation();

      return false;
   }

   return true;
}

function validateShowName(el) {
   el.setCustomValidity("");
   document.querySelector(`#${el.id} ~ small`).textContent = "Enter the name of the show you want to track";
   el.setAttribute("aria-invalid", "false");

   if (!el.checkValidity()) {
      el.setCustomValidity("Please enter a show name");
      document.querySelector(`#${el.id} ~ small`).textContent = "Please enter a show name";
      el.setAttribute("aria-invalid", "true");
   }
}

function validateTotalSeasons(el) {
   el.setCustomValidity("");
   document.querySelector(`#${el.id} ~ small`).textContent = "Enter the total number of seasons for this show";
   el.setAttribute("aria-invalid", "false");

   if (!el.checkValidity()) {
      el.setCustomValidity("Please enter the total number of seasons (1-255)");
      document.querySelector(`#${el.id} ~ small`).textContent = "Please enter the total number of seasons (1-255)";
      el.setAttribute("aria-invalid", "true");
   }
}

function validatePlatform(el) {
   el.setCustomValidity("");
   document.querySelector(`#${el.id} ~ small`).textContent = "Choose the streaming platform where this show is available";
   el.setAttribute("aria-invalid", "false");

   if (!el.checkValidity() || el.value === "") {
      el.setCustomValidity("Please select a streaming platform");
      document.querySelector(`#${el.id} ~ small`).textContent = "Please select a streaming platform";
      el.setAttribute("aria-invalid", "true");
   }
}

function validateWatchers() {
   const watchersCheckboxes = document.querySelectorAll('input[name="watchers"]');
   const helpText = document.querySelector("#watchersHelp");
   const fieldset = document.querySelector("#watchersFieldset");
   
   const hasCheckedWatcher = Array.from(watchersCheckboxes).some(checkbox => checkbox.checked);
   
   if (!hasCheckedWatcher) {
      watchersCheckboxes[0].setCustomValidity("Please select at least one person who wants to watch this show");
      helpText.textContent = "Please select at least one person who wants to watch this show";
      fieldset.setAttribute("aria-invalid", "true");
   } else {
      watchersCheckboxes.forEach(checkbox => checkbox.setCustomValidity(""));
      helpText.textContent = "Select at least one person who wants to watch this show";
      fieldset.setAttribute("aria-invalid", "false");
   }
}
