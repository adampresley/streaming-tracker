import { createCookieSessionStorage, redirect, Session, SessionData, SessionStorage } from "@remix-run/node";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
   throw new Error("SESSION_SECRET must be set");
}

const storage: SessionStorage<SessionData, SessionData> = createCookieSessionStorage({
   cookie: {
      name: "streaming_tracker_session",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 4, // 4 hours
      secrets: [sessionSecret],
   },
});

export async function createUserSession(request: Request) {
   const session: Session<SessionData, SessionData> = await storage.getSession();
   session.set("authenticated", true);
   session.set("loginTime", Date.now());

   return redirect("/", {
      headers: {
         "Set-Cookie": await storage.commitSession(session),
      },
   });
}

export async function getUserSession(request: Request) {
   const session: Session<SessionData, SessionData> = await storage.getSession(request.headers.get("Cookie"));
   return session;
}

export async function isAuthenticated(request: Request) {
   const session: Session<SessionData, SessionData> = await getUserSession(request);
   const isAuth: any = session.get("authenticated");
   const loginTime: number = session.get("loginTime");

   if (!isAuth || !loginTime) {
      return false;
   }

   // Check if session has expired (4 hours)
   const now: number = Date.now();
   const fourHoursInMs: number = 4 * 60 * 60 * 1000;

   if (now - loginTime > fourHoursInMs) {
      return false;
   }

   return true;
}

export async function requireAuth(request: Request) {
   const session: Session<SessionData, SessionData> = await getUserSession(request);
   const isAuthenticated: boolean | undefined = session.get("authenticated");
   const loginTime: number = session.get("loginTime");

   if (!isAuthenticated || !loginTime) {
      throw redirect("/login");
   }

   // Check if session has expired (4 hours)
   const now: number = Date.now();
   const fourHoursInMs: number = 4 * 60 * 60 * 1000;

   if (now - loginTime > fourHoursInMs) {
      throw redirect("/login");
   }

   return true;
}

export async function logout(request: Request) {
   const session: Session<SessionData, SessionData> = await getUserSession(request);

   return redirect("/login", {
      headers: {
         "Set-Cookie": await storage.destroySession(session),
      },
   });
}

export function verifyPassword(password: string) {
   const authPassword: string | undefined = process.env.AUTH_PASSWORD;

   if (!authPassword) {
      throw new Error("AUTH_PASSWORD must be set");
   }

   return password === authPassword;
}
