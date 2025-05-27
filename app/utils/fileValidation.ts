interface ValidationError {
  field: string;
  message: string;
}

export const validateFile = (file: File): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Check file type - only PDF allowed
  if (file.type !== "application/pdf") {
    errors.push({
      field: "file",
      message: "Only PDF files are allowed",
    });
  }

  // Check file size (1MB limit)
  const maxSize = 1 * 1024 * 1024; // 1MB in bytes
  if (file.size > maxSize) {
    errors.push({
      field: "file",
      message: "File size must be less than 1MB",
    });
  }

  // Check file name format: Name_Title_Specialization_YYYY and validate year
  const currentYear = new Date().getFullYear();
  const fileNameRegex = new RegExp(
    `^[A-Za-z]+_[A-Za-z]+_${currentYear}\\.pdf$`,
    "i"
  );

  if (!fileNameRegex.test(file.name)) {
    errors.push({
      field: "file",
      message: `File name must be in the format: Name_Title_${currentYear}.pdf (e.g., AlexCruz_FullStackDeveloper_${currentYear}.pdf)`,
    });
  }

  return errors;
};
