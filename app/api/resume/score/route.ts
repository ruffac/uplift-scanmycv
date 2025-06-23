import { updateResumeReviewsScore } from "@/app/utils/googleSheets";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const { email, score } = await request.json();
    if (!email || typeof score !== "number") {
      return NextResponse.json(
        { error: "Email and score are required" },
        { status: 400 }
      );
    }
    const success = await updateResumeReviewsScore(email, score);
    if (!success) {
      throw new Error(
        `Failed to update score ${score} in Google Sheets for ${email}`
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating score in Google Sheets:", error);
    return NextResponse.json(
      { error: "Failed to update score" },
      { status: 500 }
    );
  }
}
