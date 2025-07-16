import { LoaderFunctionArgs } from "@remix-run/node";
import { logout } from "~/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
   return logout(request);
}

export default function Logout() {
   return null;
}
