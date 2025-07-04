import { updateResumeDriveLink } from "@/app/utils/googleSheets";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const { email, resumeDriveLink } = await request.json();

    if (!email || !resumeDriveLink) {
      return NextResponse.json(
        { error: "Email and Resume Drive link are required" },
        { status: 400 }
      );
    }

    const success = await updateResumeDriveLink(email, resumeDriveLink);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update Resume Drive link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating Resume Drive link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
