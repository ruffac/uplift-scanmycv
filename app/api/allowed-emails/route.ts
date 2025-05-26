import { getAllowedEmails } from "@/app/utils/googleSheets";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const emails = await getAllowedEmails();
    return NextResponse.json({ emails });
  } catch (error) {
    console.error("Error fetching allowed emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch allowed emails" },
      { status: 500 }
    );
  }
}
