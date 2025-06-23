import { getAllowedEmails } from "@/app/utils/googleSheets";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const allowedEmails = await getAllowedEmails();
    const isAllowed = allowedEmails.includes(email.toLowerCase().trim());

    if (!isAllowed) {
      return NextResponse.json(
        {
          error:
            "Email not authorized. For now, this is only available to Uplift Code Camp students. Please contact us if you are a student and want to use this service.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in allowed-emails POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
