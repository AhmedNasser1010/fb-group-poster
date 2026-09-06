export const runtime = "nodejs";

import {
  isContextRunning,
  isLoggedIn,
  loginComplete,
  logoutFromFacebook,
  openLoginWindow,
} from "@/lib/playwright";
import { readSession } from "@/lib/session";

export async function GET() {
  try {
    // If the browser is already running, do a real cookie check.
    // Otherwise fall back to the persisted session status WITHOUT launching
    // the browser window (so page loads don't pop up a blank tab).
    const loggedIn = isContextRunning()
      ? await loginComplete()
      : Boolean((await readSession()).valid);
    return Response.json({ loggedIn });
  } catch {
    return Response.json({ loggedIn: false });
  }
}

export async function DELETE() {
  try {
    await logoutFromFacebook();
    return Response.json({ message: "Logged out" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to log out";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const loggedIn = await isLoggedIn();
    if (loggedIn) {
      return Response.json({ message: "Already logged in" });
    }

    await openLoginWindow();

    return new Response(
      JSON.stringify({
        message:
          "Browser window opened. Please log in to Facebook manually. The session will be saved automatically.",
      }),
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to open browser";
    return Response.json({ error: message }, { status: 500 });
  }
}