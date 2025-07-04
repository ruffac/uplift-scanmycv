# ScanMyCV

A web application that helps review and validate resumes using AI.

## Features

- Resume format validation
- AI-powered resume review using Google's Gemini
- Google Sheets integration for tracking submissions
- Google Drive integration for storing resumes
- Discord notifications for important events
- LinkedIn profile URL tracking

## Environment Variables

The following environment variables are required:

### Google Sheets API

- `GOOGLE_SHEETS_ID`: The ID of your Google Sheets document
- `GOOGLE_SHEETS_CLIENT_EMAIL`: Service account email for Google Sheets API
- `GOOGLE_SHEETS_PRIVATE_KEY`: Service account private key for Google Sheets API

### Google Drive API

- `GOOGLE_DRIVE_FOLDER_ID`: The ID of the Google Drive folder where resumes will be stored

### Discord Integration

- `DISCORD_WEBHOOK_URL`: Discord webhook URL for notifications

### Gemini API

- `GEMINI_API_KEY`: API key for Google's Gemini AI

## Setup

1. Clone the repository
2. Install dependencies with `yarn install`
3. Create a `.env` file with the required environment variables
4. Run the development server with `yarn dev`

## Development

- Built with Next.js 15.3.2
- Uses TypeScript for type safety
- Tailwind CSS for styling
- Google APIs for Sheets and Drive integration
- Discord webhooks for notifications
- Gemini AI for resume review

## Prerequisites

- Node.js 18+ installed
- Yarn package manager
- Google Cloud API key with Gemini access
- Discord webhook URL (for notifications)
