document.addEventListener("DOMContentLoaded", () => {
   document.querySelector("#btnReset").addEventListener("click", () => {
      document.querySelector("#searchForm").reset();
      document.querySelector("#showName").value = "";
      document.querySelector("#platform").selectedIndex = 0;
   });
});
