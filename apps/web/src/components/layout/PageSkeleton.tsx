export function PageSkeleton({ rows = 6, hasHeader = true }: { rows?: number; hasHeader?: boolean }) {
  return (
    <div className="animate-pulse space-y-4">
      {hasHeader && (
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div className="h-6 w-40 bg-gray-200 rounded-lg" />
            <div className="h-4 w-64 bg-gray-100 rounded-lg" />
          </div>
          <div className="h-9 w-28 bg-gray-200 rounded-lg" />
        </div>
      )}
      <div className="h-10 w-full bg-gray-100 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100">
            <div className="h-9 w-9 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
            <div className="h-6 w-16 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
