import { google } from "googleapis";

// Function to properly format the private key
function formatPrivateKey(key: string | undefined): string {
  if (!key) return "";
  // If the key is already properly formatted, return as is
  if (key.includes("-----BEGIN PRIVATE KEY-----")) return key;

  // Add proper formatting if it's a single line key
  return `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
}

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: formatPrivateKey(
      process.env.GOOGLE_SHEETS_PRIVATE_KEY
    )?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

export async function getAllowedEmails(): Promise<string[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "'Form Responses 1'!F:F",
    });

    const rows = response.data.values;
    if (!rows) {
      console.error("No data found in the Google Sheet");
      return [];
    }

    // Flatten the 2D array and filter out any empty values
    return rows
      .flat()
      .filter((email) => email && typeof email === "string")
      .map((email) => email.toLowerCase().trim());
  } catch (error) {
    console.error("Error fetching emails from Google Sheets:", error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    return [];
  }
}
