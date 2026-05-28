"use client";

import { BarChart2 } from "lucide-react";

export default function StudentAssessmentsPage() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <BarChart2 className="h-5 w-5 text-purple-500" />
        <h1 className="text-lg font-bold text-gray-900">My Assessments</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="h-16 w-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
          <BarChart2 className="h-8 w-8 text-purple-300" />
        </div>
        <h2 className="text-lg font-semibold text-gray-600">Assessments Coming Soon</h2>
        <p className="text-sm text-gray-400 mt-2 max-w-xs">
          Your exam results, scores, and performance reports will appear here once they are available.
        </p>
      </div>
    </div>
  );
}
