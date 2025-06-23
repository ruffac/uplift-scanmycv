import { updateValidationStatus } from "@/app/utils/googleSheets";
import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

interface TextItem {
  str: string;
  dir: string;
}

interface TextContent {
  items: TextItem[];
}

interface PageData {
  getTextContent(): Promise<TextContent>;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const options = {
      pagerender: async function (pageData: PageData) {
        const textContent = await pageData.getTextContent();
        return textContent.items.map((item) => item.str).join(" ");
      },
    };

    const data = await pdfParse(buffer, options);

    return NextResponse.json({
      text: data.text,
      numPages: data.numpages,
    });
  } catch (error) {
    console.error("PDF parsing error:", error);
    return NextResponse.json(
      {
        error: "Failed to parse PDF",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { email, isValid } = await request.json();

    if (!email || typeof isValid !== "boolean") {
      return NextResponse.json(
        { error: "Email and isValid status are required" },
        { status: 400 }
      );
    }

    const success = await updateValidationStatus(email, isValid);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update validation status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in allowed-emails PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
