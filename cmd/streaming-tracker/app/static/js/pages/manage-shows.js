document.addEventListener("DOMContentLoaded", () => {
   document.querySelector("#btnReset").addEventListener("click", () => {
      document.querySelector("#searchForm").reset();
      document.querySelector("#showName").value = "";
      document.querySelector("#platform").selectedIndex = 0;
      document.querySelector("#watcher").selectedIndex = 0;
   });

   // Modal configuration 
   const isOpenClass = "modal-is-open";
   const openingClass = "modal-is-opening";
   const closingClass = "modal-is-closing";
   const animationDuration = 400; // ms
   let visibleModal = null;
   let pendingAction = null;

   // Modal functions
   const openModal = (modal) => {
      const { documentElement: html } = document;
      html.classList.add(isOpenClass, openingClass);

      setTimeout(() => {
         visibleModal = modal;
         html.classList.remove(openingClass);
      }, animationDuration);

      modal.showModal();
   };

   const closeModal = (modal) => {
      visibleModal = null;
      pendingAction = null;

      const { documentElement: html } = document;
      html.classList.add(closingClass);

      setTimeout(() => {
         html.classList.remove(closingClass, isOpenClass);
         modal.close();
      }, animationDuration);
   };

   // Get modal elements
   const confirmationModal = document.getElementById("confirmationModal");
   const confirmationMessage = document.getElementById("confirmationMessage");
   const confirmOk = document.getElementById("confirmOk");
   const confirmCancel = document.getElementById("confirmCancel");
   const closeModalBtn = document.getElementById("closeModalBtn");

   // Handle confirmation requests
   const showConfirmation = (message, actionCallback) => {
      confirmationMessage.textContent = message;
      pendingAction = actionCallback;
      openModal(confirmationModal);
   };

   // Modal event listeners
   confirmOk.addEventListener("click", () => {
      const actionToPerform = pendingAction;
      closeModal(confirmationModal);
      if (actionToPerform) {
         actionToPerform();
      }
   });

   confirmCancel.addEventListener("click", () => {
      closeModal(confirmationModal);
   });

   closeModalBtn.addEventListener("click", () => {
      closeModal(confirmationModal);
   });

   // Close modal when clicking outside
   confirmationModal.addEventListener("click", (event) => {
      if (event.target === confirmationModal) {
         closeModal(confirmationModal);
      }
   });

   // Use HTMX confirm event pattern for custom confirmations
   document.body.addEventListener('htmx:confirm', function(evt) {
      if (evt.target.matches("[data-custom-confirm='true']")) {
         evt.preventDefault();
         const message = evt.target.dataset.confirmMessage || "Are you sure?";

         showConfirmation(message, () => {
            evt.detail.issueRequest();
         });
      }
   });
});
