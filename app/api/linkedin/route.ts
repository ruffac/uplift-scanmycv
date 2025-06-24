import { updateLinkedInUrl } from "@/app/utils/googleSheets";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const { email, linkedinUrl } = await request.json();

    if (!email || !linkedinUrl) {
      return NextResponse.json(
        { error: "Email and LinkedIn URL are required" },
        { status: 400 }
      );
    }

    const success = await updateLinkedInUrl(email, linkedinUrl);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update LinkedIn URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating LinkedIn URL:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
