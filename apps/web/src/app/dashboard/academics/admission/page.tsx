"use client";

import { ClipboardList, Construction } from "lucide-react";

export default function AdmissionPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="h-5 w-5 text-indigo-500" />
        <h1 className="text-xl font-bold text-gray-900">Admission</h1>
      </div>
      <p className="text-sm text-gray-400 mb-8">Manage admissions, documents, and enrolment status.</p>
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
        <Construction className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-500">Coming Soon</p>
        <p className="text-sm text-gray-400 mt-1">Admission management is being built.</p>
      </div>
    </div>
  );
}
