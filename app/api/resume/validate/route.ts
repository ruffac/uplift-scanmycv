import {
  incrementSubmissionCount,
  updateValidationStatus,
} from "@/app/utils/googleSheets";
import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

interface PDFItem {
  str: string;
  transform: number[];
}

interface LineItem {
  x: number;
  str: string;
}

interface Lines {
  [key: string]: LineItem[];
}

function groupCharactersByLineAndWord(charItems: PDFItem[]): string[] {
  const lines: Lines = {};
  const lineThreshold = 0.5; // adjust based on height

  for (const item of charItems) {
    const [, , , , x, y] = item.transform; // extract position
    const yKey = Object.keys(lines).find(
      (k) => Math.abs(parseFloat(k) - y) < lineThreshold
    );
    const key = yKey !== undefined ? yKey : y.toString();

    if (!lines[key]) lines[key] = [];
    lines[key].push({ x, str: item.str });
  }

  const sortedLines = Object.values(lines).map((line) =>
    line
      .sort((a: LineItem, b: LineItem) => a.x - b.x)
      .map((c: LineItem) => c.str)
      .join("")
  );

  return sortedLines;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pagerender: async function (pageData: any) {
        const textContent = await pageData.getTextContent();
        const groupedLines = groupCharactersByLineAndWord(textContent.items);
        const combinedText = groupedLines.join(" ");
        return combinedText;
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

    // Update validation status and increment submission count
    const [validationSuccess, submissionCountSuccess] = await Promise.all([
      updateValidationStatus(email, isValid),
      incrementSubmissionCount(email),
    ]);

    if (!validationSuccess || !submissionCountSuccess) {
      return NextResponse.json(
        { error: "Failed to update validation status or submission count" },
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
