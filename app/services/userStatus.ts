export function formatUserStatus(status: string): string {
   switch (status) {
      case "WANT_TO_WATCH":
         return "Want to Watch";
      case "IN_PROGRESS":
         return "Watching";
      case "FINISHED":
         return "Finished";
      default:
         return status;
   }
}