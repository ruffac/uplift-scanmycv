import ResumeUploadForm from "./components/ResumeUploadForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Resume Review</h1>
          <p className="mt-2 text-sm text-gray-600">
            This app is in beta version. Please help us improve it by sharing
            your suggestions to{" "}
            <a
              href="mailto:contact@upliftcodecamp.com"
              className="text-blue-600 hover:text-blue-800"
            >
              contact@upliftcodecamp.com
            </a>
          </p>
        </div>

        <ResumeUploadForm />
      </div>
    </div>
  );
}
