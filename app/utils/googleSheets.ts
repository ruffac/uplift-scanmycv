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
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const findRowIndexByeEmail = async (email: string) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "'Sheet1'!A:A",
  });

  const rows = response.data.values;
  if (!rows) {
    console.error("No data found in the Google Sheet for email", email);
    return -1;
  }

  // Find the row index (1-based) where the email matches
  const rowIndex = rows.findIndex(
    (row) => row[0]?.toLowerCase().trim() === email.toLowerCase().trim()
  );

  if (rowIndex === -1) {
    console.error(`Email ${email} not found in the Google Sheet`);
    return -1;
  }
  return rowIndex + 1;
};

const updateDate = async (rowIndex: number) => {
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `'Sheet1'!E${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })],
      ],
    },
  });
};

export async function getAllowedEmails(): Promise<string[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "'Sheet1'!A:A",
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

export async function updateValidationStatus(
  email: string,
  isValid: boolean
): Promise<boolean> {
  try {
    const rowIndex = await findRowIndexByeEmail(email);
    if (rowIndex === -1) {
      throw new Error(`Email ${email} not found in the Google Sheet`);
    }

    // Update the validation status in column C
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `'Sheet1'!C${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[isValid ? "First scan ok" : "Fixes required"]],
      },
    });

    // Update the score in column D
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `'Sheet1'!D${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[10]],
      },
    });

    await updateDate(rowIndex);
    return true;
  } catch (error) {
    console.error("Error updating validation status in Google Sheets:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    return false;
  }
}
export async function updateResumeReviewsScore(email: string, score: number) {
  try {
    const rowIndex = await findRowIndexByeEmail(email);
    if (rowIndex === -1) {
      throw new Error(`Email ${email} not found in the Google Sheet`);
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `'Sheet1'!D${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[score]],
      },
    });
    await updateDate(rowIndex);
    return true;
  } catch (error) {
    console.error("Error updating validation status in Google Sheets:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    return false;
  }
}

export async function updateLinkedInUrl(
  email: string,
  linkedinUrl: string
): Promise<boolean> {
  try {
    const rowIndex = await findRowIndexByeEmail(email);
    if (rowIndex === -1) {
      throw new Error(`Email ${email} not found in the Google Sheet`);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `'Sheet1'!F${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[linkedinUrl]],
      },
    });

    return true;
  } catch (error) {
    console.error("Error updating LinkedIn URL in Google Sheets:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    return false;
  }
}

export async function incrementSubmissionCount(
  email: string
): Promise<boolean> {
  try {
    const rowIndex = await findRowIndexByeEmail(email);
    if (rowIndex === -1) {
      throw new Error(`Email ${email} not found in the Google Sheet`);
    }

    // Get current submission count
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `'Sheet1'!G${rowIndex}`,
    });

    // Get current count or default to 0 if no value exists
    const currentCount = response.data.values?.[0]?.[0]
      ? parseInt(response.data.values[0][0], 10)
      : 0;

    // Increment the count
    const newCount = currentCount + 1;

    // Update the submission count in column G
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `'Sheet1'!G${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newCount]],
      },
    });

    return true;
  } catch (error) {
    console.error("Error updating submission count in Google Sheets:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    return false;
  }
}
