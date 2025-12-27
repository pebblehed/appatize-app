// src/app/api/moment/anchor/route.ts
//
// Stage D.6.x — Anchor the selected momentId
// This removes the "go back to trends" friction.
// Never 500.

import { NextResponse } from "next/server";
import {
  setAnchoredMomentId,
  clearAnchoredMomentId,
  getAnchoredMomentId,
} from "@/lib/runtime/anchoredMoment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      { ok: true, anchored: getAnchoredMomentId() },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ANCHOR_READ_ERROR",
          message: e?.message ?? "Failed to read anchor",
        },
      },
      { status: 200 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const momentId =
      typeof body?.momentId === "string" && body.momentId.trim()
        ? body.momentId.trim()
        : null;

    if (!momentId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing momentId" } },
        { status: 200 }
      );
    }

    setAnchoredMomentId(momentId);

    return NextResponse.json(
      { ok: true, anchored: getAnchoredMomentId() },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ANCHOR_ERROR",
          message: e?.message ?? "Failed to anchor moment",
        },
      },
      { status: 200 }
    );
  }
}

export async function DELETE() {
  try {
    clearAnchoredMomentId();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ANCHOR_CLEAR_ERROR",
          message: e?.message ?? "Failed to clear anchor",
        },
      },
      { status: 200 }
    );
  }
}
