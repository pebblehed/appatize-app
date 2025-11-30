// src/app/api/waitlist/route.ts
import { NextResponse } from "next/server";

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;

export async function POST(req: Request) {
  try {
    if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
      console.error("[waitlist] Missing Beehiiv env vars");
      return NextResponse.json(
        { ok: false, error: "Server configuration error." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Invalid email address." },
        { status: 400 }
      );
    }

    console.log("[waitlist] Incoming email:", email);
    console.log("[waitlist] Beehiiv key present?", !!BEEHIIV_API_KEY);
    console.log("[waitlist] Beehiiv publication present?", !!BEEHIIV_PUBLICATION_ID);

    const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BEEHIIV_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        send_welcome_email: true,
        utm_source: "appatize-waitlist",
      }),
    });

    console.log("[waitlist] Beehiiv status code:", res.status);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[waitlist] Beehiiv error response:", text);

      return NextResponse.json(
        {
          ok: false,
          error: "Beehiiv API error.",
          status: res.status,
        },
        { status: 502 }
      );
    }

    // Optionally parse response for debugging
    // const data = await res.json();
    // console.log("[waitlist] Beehiiv response:", data);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[waitlist] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
