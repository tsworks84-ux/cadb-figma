"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { GraduationCap, Clock, Users, CheckCircle } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  ENROLLED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function TrainingPage() {
  const queryClient = useQueryClient();

  const { data: programs } = useQuery({
    queryKey: ["training-programs"],
    queryFn: () => api.get("/api/v1/training/programs").then((r) => r.data.data),
  });

  const { data: myEnrollments } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => api.get("/api/v1/training/my-enrollments").then((r) => r.data.data),
  });

  const enrollMutation = useMutation({
    mutationFn: (programId: string) => api.post(`/api/v1/training/programs/${programId}/enroll`),
    onSuccess: () => {
      toast.success("Enrolled successfully");
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/training/enrollments/${id}/complete`),
    onSuccess: () => {
      toast.success("Marked as complete");
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
  });

  const enrolledProgramIds = new Set(myEnrollments?.map((e: any) => e.programId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Training</h1>
        <p className="text-sm text-gray-500 mt-0.5">Programs and certifications</p>
      </div>

      {/* My Enrollments */}
      {myEnrollments?.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">My Enrollments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myEnrollments.map((enrollment: any) => (
              <div key={enrollment.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">{enrollment.program.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{enrollment.program.provider ?? "Internal"}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[enrollment.status]}`}>
                    {enrollment.status}
                  </span>
                </div>
                {enrollment.status !== "COMPLETED" && (
                  <button
                    onClick={() => completeMutation.mutate(enrollment.id)}
                    className="mt-3 inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-1 hover:bg-green-100"
                  >
                    <CheckCircle className="h-3 w-3" /> Mark Complete
                  </button>
                )}
                {enrollment.completedAt && (
                  <p className="text-xs text-green-600 mt-2">Completed on {formatDate(enrollment.completedAt)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Programs */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Available Programs</h2>
        {!programs?.length ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
            <GraduationCap className="mx-auto h-10 w-10 mb-2 opacity-40" />
            <p>No training programs available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((program: any) => {
              const isEnrolled = enrolledProgramIds.has(program.id);
              return (
                <div key={program.id} className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                  {program.isMandatory && (
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 mb-2">Mandatory</span>
                  )}
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{program.title}</h3>
                  {program.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{program.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-4">
                    {program.durationHours && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{program.durationHours}h</span>
                    )}
                    {program._count && (
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{program._count.enrollments} enrolled</span>
                    )}
                    <span className="uppercase">{program.mode}</span>
                  </div>
                  <button
                    onClick={() => !isEnrolled && enrollMutation.mutate(program.id)}
                    disabled={isEnrolled || enrollMutation.isPending}
                    className={`w-full rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      isEnrolled
                        ? "bg-gray-100 text-gray-500 cursor-default"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isEnrolled ? "Enrolled" : "Enroll Now"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
