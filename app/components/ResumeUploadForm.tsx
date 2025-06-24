"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendDiscordNotification } from "../utils/discordNotifications";
import { validateFile } from "../utils/fileValidation";
import {
  ResumeValidationResult,
  validateResume,
} from "../utils/resumeValidation";

interface ValidationError {
  field: string;
  message: string;
}

export default function ResumeUploadForm() {
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ResumeValidationResult | null>(null);
  const [geminiFeedback, setGeminiFeedback] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const updateGoogleSheetsValidationStatus = async (
    email: string,
    isValid: boolean
  ) => {
    try {
      const updateResponse = await fetch("/api/resume/validate", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          isValid,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error(
          `Failed to update validation status in Google Sheets for ${email}`
        );
      } else {
        await sendDiscordNotification({
          type: "RESUME_REVIEW_STARTED",
          email,
        });
      }
    } catch (error) {
      await sendDiscordNotification({
        type: "ERROR",
        message: `Failed to update validation status in Google Sheets: ${error}`,
      });
    }
    return;
  };

  const updateGoogleSheetsScore = async (email: string, score: number) => {
    try {
      const updateScore = await fetch("api/resume/score", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, score }),
      });
      if (!updateScore.ok) {
        throw new Error(
          `Failed to update score ${score} in Google Sheets for ${email}`
        );
      } else {
        await sendDiscordNotification({
          type: "RESUME_AI_FEEDBACK",
          message: `Resume review score for ${email} is ${score}`,
        });
      }
    } catch (error) {
      await sendDiscordNotification({
        type: "ERROR",
        message: `Failed to update score in Google Sheets: ${error}`,
      });
    }
    return;
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrors([]);
      setValidationResult(null);
      setGeminiFeedback(null);
    }
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setErrors(errors.filter((error) => error.field !== "email"));
  };

  const handleLinkedinChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLinkedinUrl(e.target.value);
    setErrors(errors.filter((error) => error.field !== "linkedin"));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors([]);
    setGeminiFeedback(null);

    // Basic email format validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors((prev) => [
        ...prev,
        {
          field: "email",
          message: "Please enter a valid email address",
        },
      ]);
      setIsSubmitting(false);
      return;
    }

    // LinkedIn URL validation
    if (!linkedinUrl || !linkedinUrl.includes("linkedin.com/")) {
      setErrors((prev) => [
        ...prev,
        {
          field: "linkedin",
          message: "Please enter a valid LinkedIn URL",
        },
      ]);
      setIsSubmitting(false);
      return;
    }

    // Validate file
    if (!file) {
      setErrors((prev) => [
        ...prev,
        {
          field: "file",
          message: "Please select a file to upload",
        },
      ]);
      setIsSubmitting(false);
      return;
    }

    // Validate file format and size
    const fileErrors = validateFile(file);
    if (fileErrors.length > 0) {
      setErrors((prev) => [...prev, ...fileErrors]);
      setIsSubmitting(false);
      return;
    }

    // Validate email access first
    const emailResponse = await fetch("/api/allowed-emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      setErrors((prev) => [
        ...prev,
        {
          field: "email",
          message:
            errorData.error || "Email validation failed. Please try again.",
        },
      ]);
      setIsSubmitting(false);
      return;
    }

    // Run resume validation
    setIsValidating(true);
    const result = await validateResume(file);
    setValidationResult(result);
    await updateGoogleSheetsValidationStatus(email, result.isValid);
    setIsValidating(false);

    // Check if resume validation passed
    if (!result.isValid) {
      setIsSubmitting(false);
      return;
    }

    try {
      // Get the resume text from validation result
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/resume/validate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to get resume text");
      }

      const { text } = await response.json();

      // Send to Gemini for review
      const geminiResponse = await fetch("/api/gemini-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!geminiResponse.ok) {
        const errorData = await geminiResponse.json();
        if (geminiResponse.status === 429) {
          // Rate limit error
          setErrors((prev) => [
            ...prev,
            {
              field: "rateLimit",
              message: errorData.error,
            },
          ]);
          return;
        }
        throw new Error(errorData.error || "Failed to get Gemini feedback");
      }

      const { feedback } = await geminiResponse.json();
      setGeminiFeedback(feedback);

      const scoreMatch =
        feedback.match(/Resume Review score: (\d{1,2}|100)/) || 0;

      const score = parseInt(scoreMatch[1], 10);
      await updateGoogleSheetsScore(email, score);

      // Update LinkedIn URL
      const linkedinResponse = await fetch("/api/linkedin", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, linkedinUrl }),
      });

      if (!linkedinResponse.ok) {
        throw new Error("Failed to update LinkedIn URL");
      }
    } catch (error) {
      console.error("Error during submission:", error);
      setErrors((prev) => [
        ...prev,
        {
          field: "submission",
          message: "Failed to process resume. Please try again.",
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyFeedback = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (geminiFeedback) {
      navigator.clipboard
        .writeText(geminiFeedback)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
        });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Email address
        </label>
        <div className="mt-1">
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            autoComplete="email"
            required
            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 text-black focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="you@example.com"
          />
          {errors.find((e) => e.field === "email") && (
            <p className="mt-2 text-sm text-red-600">
              {errors.find((e) => e.field === "email")?.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="linkedin"
          className="block text-sm font-medium text-gray-700"
        >
          LinkedIn Profile URL
        </label>
        <div className="mt-1">
          <input
            id="linkedin"
            name="linkedin"
            type="url"
            value={linkedinUrl}
            onChange={handleLinkedinChange}
            required
            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 text-black focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="https://linkedin.com/in/your-profile"
          />
          {errors.find((e) => e.field === "linkedin") && (
            <p className="mt-2 text-sm text-red-600">
              {errors.find((e) => e.field === "linkedin")?.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="resume"
          className="block text-sm font-medium text-gray-700"
        >
          Resume
        </label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex flex-col items-center text-sm text-gray-600">
              <label
                htmlFor="resume-upload"
                className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
              >
                <span>Upload a file</span>
                <input
                  id="resume-upload"
                  name="resume-upload"
                  type="file"
                  onChange={handleFileChange}
                  className="sr-only"
                  accept=".pdf"
                />
              </label>
              <p className="mt-1 text-xs text-gray-500">PDF up to 1MB</p>
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected file: {file.name}
                </p>
              )}
              {errors.find((e) => e.field === "file") && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.find((e) => e.field === "file")?.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {validationResult && (
        <div className="mt-4 space-y-4">
          {validationResult.errors.length > 0 && (
            <div className="bg-red-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-red-800">
                Required Fixes: (Please work on the below first before
                submitting)
              </h3>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                {validationResult.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {validationResult.warnings.length > 0 && (
            <div className="bg-yellow-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-yellow-800">
                Recommendations:
              </h3>
              <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                {validationResult.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {geminiFeedback && (
        <div className="mt-4 bg-white p-4 rounded-md border border-gray-200 text-gray-900">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">AI Resume Review Feedback</h3>
            <button
              onClick={handleCopyFeedback}
              type="button"
              className="inline-flex items-center px-2 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
              title="Copy feedback to clipboard"
            >
              {copySuccess ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
              )}
            </button>
          </div>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Customize heading styles
                h2: ({ ...props }) => (
                  <h2
                    className="text-lg font-semibold mt-6 mb-3 text-gray-900"
                    {...props}
                  />
                ),
                h3: ({ ...props }) => (
                  <h3
                    className="text-md font-medium mt-4 mb-2 text-gray-800"
                    {...props}
                  />
                ),
                // Style lists
                ul: ({ ...props }) => (
                  <ul className="list-disc list-inside mb-4" {...props} />
                ),
                li: ({ ...props }) => <li className="ml-4 mb-2" {...props} />,
                // Style paragraphs
                p: ({ ...props }) => (
                  <p className="mb-4 text-gray-700" {...props} />
                ),
                // Style bold text
                strong: ({ ...props }) => (
                  <strong className="font-semibold text-gray-900" {...props} />
                ),
                // Style emphasis
                em: ({ ...props }) => (
                  <em className="text-gray-800 italic" {...props} />
                ),
              }}
            >
              {geminiFeedback}
            </ReactMarkdown>
            <p>
              If you have any questions or concerns, please message the Student
              Success Team :)
            </p>
          </div>
        </div>
      )}

      {errors.find((e) => e.field === "submission") && (
        <p className="mt-2 text-sm text-red-600">
          {errors.find((e) => e.field === "submission")?.message}
        </p>
      )}

      {errors.find((e) => e.field === "rateLimit") && (
        <div className="mt-4 bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Rate Limit Exceeded
              </h3>
              <p className="mt-2 text-sm text-red-700">
                {errors.find((e) => e.field === "rateLimit")?.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {!geminiFeedback && (
        <div>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              isValidating ||
              validationResult?.isValid === false
            }
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? "Submitting..."
              : isValidating
              ? "Checking..."
              : "Submit for Review"}
          </button>
        </div>
      )}
    </form>
  );
}
