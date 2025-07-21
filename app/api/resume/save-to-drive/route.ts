import { drive_v3, google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";

// Initialize Google Drive API
function formatPrivateKey(key: string | undefined): string {
  if (!key) return "";
  if (key.includes("-----BEGIN PRIVATE KEY-----")) return key;
  return `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: formatPrivateKey(
      process.env.GOOGLE_SHEETS_PRIVATE_KEY
    )?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Convert Buffer to Readable Stream
function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

function getUsernameFromEmail(email: string): string {
  return email.split("@")[0];
}

async function findExistingFile(email: string): Promise<string | null> {
  try {
    const username = getUsernameFromEmail(email);
    const fileName = `${username}_resume.pdf`;
    const response = await drive.files.list({
      driveId: folderId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: "drive",
      q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
      fields: "files(id, name)",
    });

    const files = response.data.files;
    if (files && files.length > 0 && files[0].id) {
      return files[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error finding existing file:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const email = formData.get("email") as string;

    if (!file || !email) {
      return NextResponse.json(
        { error: "File and email are required" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!folderId) {
      throw new Error("Google Drive folder ID is not configured");
    }

    // Use a standardized filename format with just the username
    const username = getUsernameFromEmail(email);
    const fileName = `${username}_resume.pdf`;

    // Check if file already exists
    const existingFileId = await findExistingFile(email);

    let response;
    const queryParams = {
      supportsAllDrives: true,
      media: {
        mimeType: file.type,
        body: bufferToStream(buffer),
      },
      fields: "id,webViewLink",
    };
    if (existingFileId) {
      response = await drive.files.update({
        ...queryParams,
        fileId: existingFileId,
      });
    } else {
      const fileMetadata: drive_v3.Schema$File = {
        name: fileName,
        parents: [folderId],
      };

      response = await drive.files.create({
        ...queryParams,
        requestBody: fileMetadata,
      });
    }

    if (!response.data.id) {
      throw new Error("Failed to save file to Google Drive");
    }

    return NextResponse.json({
      success: true,
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
    });
  } catch (error) {
    console.error("Error saving file to Google Drive:", error);
    return NextResponse.json(
      { error: "Failed to save file to Google Drive" },
      { status: 500 }
    );
  }
}
