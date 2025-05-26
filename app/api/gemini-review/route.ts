import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

// Rate limit configuration
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false"; // Enabled by default
const RATE_LIMIT_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

const RESUME_REVIEW_PROMPT = `Please review this resume and provide feedback based on the following criteria:

Summary (2-3 sentences):
- Evaluate if it effectively communicates passion
- Check if it clearly states desired work/role
- Assess if it highlights relevant strengths
- Look for unique personal touches reflecting career shift (if they are shifting) and passion

Highlights/Proficiencies:
- Evaluate relevance of skills to target role
- Check for transferable skills from non-tech experience
- Assess clarity and organization of skills presentation

Work Experience:
- Check if bullet points start with strong action verbs
- Evaluate quantification of achievements
- Assess impact demonstration
- Look for clarity and relevance of experience

Education:
- Verify highest education level is clearly stated
- Check for School/Course/Year format
- Evaluate if key learnings are effectively summarized

Please provide specific recommendations for improvement in each area.
And general recommendations for the resume.
Do not add any other text to the response.
Do not include recommendations for visual appeal.

Resume text to review:
`;

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    if (RATE_LIMIT_ENABLED) {
      const lastReviewTime = request.cookies.get("lastResumeReviewTime")?.value;
      const currentTime = Date.now();

      if (
        lastReviewTime &&
        currentTime - parseInt(lastReviewTime) < RATE_LIMIT_DURATION
      ) {
        const timeLeft = Math.ceil(
          (RATE_LIMIT_DURATION - (currentTime - parseInt(lastReviewTime))) /
            (60 * 1000)
        );
        return NextResponse.json(
          {
            error: `Rate limit exceeded. Please wait ${timeLeft} minutes before requesting another review.`,
          },
          { status: 429 }
        );
      }
    }

    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "No resume text provided" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(RESUME_REVIEW_PROMPT + text);
    const response = await result.response;
    const feedback = response.text();

    // Create response with feedback and set cookie
    const finalResponse = NextResponse.json({ feedback });

    if (RATE_LIMIT_ENABLED) {
      finalResponse.cookies.set("lastResumeReviewTime", Date.now().toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: RATE_LIMIT_DURATION / 1000,
      });
    }

    return finalResponse;
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze resume" },
      { status: 500 }
    );
  }
}
