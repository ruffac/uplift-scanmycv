export interface ResumeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ResumeValidationOptions {
  requireSummary: boolean;
  requireHighlights: boolean;
  requireExperience: boolean;
  requireEducation: boolean;
  requireContact: boolean;
  requireAchievements: boolean;
  requireOnePage: boolean;
}

const DEFAULT_OPTIONS: ResumeValidationOptions = {
  requireSummary: true,
  requireHighlights: true,
  requireExperience: true,
  requireEducation: true,
  requireContact: true,
  requireAchievements: false,
  requireOnePage: true,
};

// Common section headers and their variations
const SECTION_PATTERNS = {
  summary:
    /(summary|about me|about|profile|professional summary|career summary)/i,
  highlights:
    /(highlights|key skills|core competencies|skills|technical skills|professional skills)/i,
  experience:
    /(experience|work experience|professional experience|employment history|work history)/i,
  education: /(education|academic background|academic history|qualifications)/i,
  achievements: /(achievements|accomplishments|awards|recognition|honors)/i,
  contact: /(contact|contact information|contact details|get in touch)/i,
};

// Contact information patterns
const CONTACT_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  linkedin: /(?:linkedin\.com\/in\/|linkedin\.com\/profile\/)[a-zA-Z0-9-]+/g,
  portfolio:
    /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[a-zA-Z0-9-]+)*/g,
  github: /(?:github\.com\/|gitlab\.com\/)[a-zA-Z0-9-]+/g,
};

export async function validateResume(
  file: File,
  options: ResumeValidationOptions = DEFAULT_OPTIONS
): Promise<ResumeValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Create form data
    const formData = new FormData();
    formData.append("file", file);

    // Call the API endpoint
    const response = await fetch("/api/validate-resume", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to parse PDF");
    }

    const { text, numPages } = await response.json();
    const textLower = text.toLowerCase();
    // Check if file is one page
    if (options.requireOnePage && numPages > 1) {
      errors.push("Resume must be one page");
    }

    // Check for required sections
    const foundSections = new Set<string>();
    const lines = textLower.split("\n");

    // Detect sections
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        for (const [section, pattern] of Object.entries(SECTION_PATTERNS)) {
          const freshPattern = new RegExp(pattern.source, "i");
          const matches = freshPattern.test(trimmedLine);

          if (matches) {
            foundSections.add(section);
          }
        }
      }
    }

    // Validate required sections
    if (options.requireSummary && !foundSections.has("summary")) {
      errors.push("Missing required section: Summary/About Me");
    }
    if (options.requireHighlights && !foundSections.has("highlights")) {
      errors.push("Missing required section: Highlights/Skills");
    }
    if (options.requireExperience && !foundSections.has("experience")) {
      errors.push("Missing required section: Experience");
    }
    if (options.requireEducation && !foundSections.has("education")) {
      errors.push("Missing required section: Education");
    }
    if (options.requireAchievements && !foundSections.has("achievements")) {
      warnings.push("Missing recommended section: Achievements");
    }

    // Validate contact information
    if (options.requireContact) {
      const foundContactInfo = new Set<string>();

      // Check for email
      const emails = textLower.match(CONTACT_PATTERNS.email);
      if (emails && emails.length > 0) {
        foundContactInfo.add("email");
      }

      // Check for LinkedIn
      const linkedin = textLower.match(CONTACT_PATTERNS.linkedin);
      if (linkedin && linkedin.length > 0) {
        foundContactInfo.add("linkedin");
      }

      // Check for portfolio
      const portfolio = textLower.match(CONTACT_PATTERNS.portfolio);
      if (portfolio && portfolio.length > 0) {
        foundContactInfo.add("portfolio");
      }

      // Check for GitHub/GitLab
      const github = textLower.match(CONTACT_PATTERNS.github);
      if (github && github.length > 0) {
        foundContactInfo.add("github");
      }

      // Report missing required contact information
      if (!foundContactInfo.has("email")) {
        errors.push("Missing required contact information: Email address");
      }
      if (!foundContactInfo.has("linkedin")) {
        errors.push("Missing required contact information: LinkedIn profile");
      }
      if (!foundContactInfo.has("portfolio")) {
        errors.push("Missing required contact information: Portfolio link");
      }
      if (!foundContactInfo.has("github")) {
        warnings.push(
          "Missing recommended contact information: GitHub/GitLab profile"
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    console.error("PDF parsing error:", error);
    return {
      isValid: false,
      errors: [
        "Failed to validate resume. Please ensure the PDF is not corrupted and try again.",
      ],
      warnings: [],
    };
  }
}
