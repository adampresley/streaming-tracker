document.addEventListener("DOMContentLoaded", () => {
   const showNameEl = document.querySelector("#showName");
   const totalSeasonsEl = document.querySelector("#totalSeasons");
   const platformEl = document.querySelector("#platform");
   const watchersCheckboxes = document.querySelectorAll('input[name="watchers"]');
   const form = document.querySelector("#editShowForm");
   const cancelBtn = document.querySelector("#btnCancel");

   /*
    * Define fields and their validation functions
    */
   const fields = [
      { 
         field: showNameEl, 
         validityFunc: validateShowName,
         events: {
            "input": (e) => validateShowName(e.target),
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
    * Attach event listeners to watcher checkboxes (only if not disabled)
    */
   watchersCheckboxes.forEach((checkbox) => {
      if (!checkbox.disabled) {
         checkbox.addEventListener("change", validateWatchers);
      }
   });

   /*
    * Setup form for custom validation
    */
   form.noValidate = true;
   form.addEventListener("submit", (e) => validateForm(e, fields));

   cancelBtn.addEventListener("click", () => {
      const urlParams = new URLSearchParams(document.referrer.split("?")[1] || "");
      let targetUrl = "/shows/manage";
      
      // If we came from the manage shows page, preserve the search parameters
      if (document.referrer.includes("/shows/manage")) {
         if (urlParams.toString()) {
            targetUrl = `/shows/manage?${urlParams.toString()}`;
         }
      }
      
      window.location.href = targetUrl;
   });
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
   
   // Check if any watchers are disabled (show is finished or cancelled)
   const hasDisabledWatchers = Array.from(watchersCheckboxes).some(checkbox => checkbox.disabled);
   
   // If watchers are disabled, skip validation
   if (hasDisabledWatchers) {
      watchersCheckboxes.forEach(checkbox => checkbox.setCustomValidity(""));
      helpText.textContent = "Watchers cannot be changed for finished or cancelled shows";
      fieldset.setAttribute("aria-invalid", "false");
      return;
   }
   
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
