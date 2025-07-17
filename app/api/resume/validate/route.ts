import { incrementSubmissionCount } from "@/app/utils/googleSheets";
import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

interface TextItem {
  str: string;
  transform: number[];
  width?: number;
}

interface LineItem {
  x: number;
  str: string;
  width?: number;
}

interface Lines {
  [key: string]: LineItem[];
}

// Helper function to fix pre-spaced text
function fixPreSpacedText(text: string): string {
  if (/^[A-Z](\s+[A-Z])+$/.test(text)) {
    return text.replace(/\s+/g, "");
  }
  return text;
}

function groupCharactersByLineAndWord(charItems: TextItem[]): string[] {
  const lines: Lines = {};
  const lineThreshold = 0.5;
  const wordSpacingThreshold = 10;

  for (const item of charItems) {
    const fixedStr = fixPreSpacedText(item.str);
    const [, , , , x, y] = item.transform;

    const roundedY = Math.round(y * 100) / 100;
    const yKey =
      Object.keys(lines).find(
        (k) => Math.abs(parseFloat(k) - roundedY) < lineThreshold
      ) || roundedY.toString();

    if (!lines[yKey]) {
      lines[yKey] = [];
    }

    const currentLine = lines[yKey];

    if (currentLine.length > 0) {
      const lastItem = currentLine[currentLine.length - 1];
      const xDiff = x - (lastItem.x + (lastItem.width || 0));

      if (xDiff > wordSpacingThreshold) {
        currentLine.push({
          x: lastItem.x + (lastItem.width || 0),
          str: " ",
          width: wordSpacingThreshold / 2,
        });
      }
    }

    currentLine.push({
      x,
      str: fixedStr,
      width: item.width,
    });
  }

  const sortedYKeys = Object.keys(lines).sort(
    (a, b) => parseFloat(b) - parseFloat(a)
  );

  const sortedLines = sortedYKeys.map((key) =>
    lines[key]
      .sort((a, b) => a.x - b.x)
      .map((c) => c.str)
      .join("")
      .trim()
  );

  return sortedLines.filter((line) => line.length > 0);
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
        const combinedText = groupedLines.join("\n");
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

    await incrementSubmissionCount(email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in resume/validate PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
