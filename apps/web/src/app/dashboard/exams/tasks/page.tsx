"use client";

import { CheckCircle2 } from "lucide-react";
import { ExamsHeader } from "@/components/exams/shared";
import { ExamTaskGroups, useMyExamTasks } from "@/components/exams/ExamTaskList";

export default function MyExamTasksPage() {
  const { data: tasks = [], isLoading } = useMyExamTasks();

  return (
    <div className="space-y-6">
      <ExamsHeader
        title="My Exam Tasks"
        subtitle="Every exam stage you own, earliest deadline first. Marking a stage done records the date and lets the next step begin. These also appear at the top of My To-Do."
      />

      {isLoading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
          <p className="mt-2 text-sm font-medium text-gray-700">No exam tasks assigned to you</p>
          <p className="text-xs text-gray-400 mt-1">When the exam team assigns you a stage, it appears here and you get an email.</p>
        </div>
      ) : (
        <ExamTaskGroups tasks={tasks} />
      )}
    </div>
  );
}
