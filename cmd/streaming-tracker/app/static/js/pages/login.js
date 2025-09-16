document.addEventListener("DOMContentLoaded", () => {
   const emailEl = document.querySelector("#email");
   const passwordEl = document.querySelector("#password");
   const form = document.querySelector("#loginForm");

   /*
    * Define fields and their validation functions
    */
   const fields = [
      { 
         field: emailEl, 
         validityFunc: validateEmail,
         events: {
            "input": (e) => validateEmail(e.target),
         },
      },
      { 
         field: passwordEl, 
         validityFunc: validatePassword,
         events: {
            "input": (e) => validatePassword(e.target),
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
    * Setup form for custom validation
    */
   form.noValidate = true;
   form.addEventListener("submit", (e) => validateForm(e, fields));
});

function validateForm(e, fields) {
   const form = e.target;

   fields.forEach((f) => {
      f.validityFunc(f.field);
   });

   if (!form.checkValidity()) {
      e.preventDefault();
      e.stopImmediatePropagation();

      return false;
   }

   return true;
}

function validateEmail(el) {
   el.setCustomValidity("");
   document.querySelector(`#${el.id} ~ small`).textContent = "The email address for your account";
   el.setAttribute("aria-invalid", "false");

   if (!el.checkValidity(el.value)) {
      el.setCustomValidity("Please enter a valid email address");
      document.querySelector(`#${el.id} ~ small`).textContent = "Please enter a valid email address";
      el.setAttribute("aria-invalid", "true");
   }
}

function validatePassword(el) {
   el.setCustomValidity("");
   document.querySelector(`#${el.id} ~ small`).textContent = "Your account password";
   el.setAttribute("aria-invalid", "false");

   if (!el.checkValidity(el.value)) {
      el.setCustomValidity("Please enter your password. Must be between 5 and 50 characters");
      document.querySelector(`#${el.id} ~ small`).textContent = "Please enter your password. Must be between 5 and 50 characters";
      el.setAttribute("aria-invalid", "true");
   }
}
