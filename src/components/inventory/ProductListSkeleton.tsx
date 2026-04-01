import { Card } from '@/components/ui/card';

export function ProductListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card
          key={i}
          className="p-4 border-2 border-stone-200 bg-white"
        >
          <div className="flex items-center gap-4">
            {/* Image skeleton */}
            <div className="w-16 h-16 rounded-lg bg-stone-100 skeleton flex-shrink-0" />

            {/* Content skeleton */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-5 bg-stone-100 skeleton rounded w-3/4" />
              <div className="h-4 bg-stone-100 skeleton rounded w-1/2" />
            </div>

            {/* Stock skeleton */}
            <div className="text-right">
              <div className="h-6 bg-stone-100 skeleton rounded w-12" />
              <div className="h-3 bg-stone-100 skeleton rounded w-16 mt-1" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="h-12 bg-stone-50 border-b-2 border-stone-200 flex items-center px-4">
        <div className="h-4 bg-stone-200 skeleton rounded w-24" />
      </div>

      {/* Rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-16 border-b border-stone-100 flex items-center px-4 gap-4"
        >
          <div className="w-5 h-5 bg-stone-100 skeleton rounded" />
          <div className="w-12 h-12 bg-stone-100 skeleton rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-stone-100 skeleton rounded w-32" />
            <div className="h-3 bg-stone-100 skeleton rounded w-24" />
          </div>
          <div className="h-5 bg-stone-100 skeleton rounded w-8" />
          <div className="h-5 bg-stone-100 skeleton rounded w-16" />
          <div className="h-8 bg-stone-100 skeleton rounded w-24" />
        </div>
      ))}
    </div>
  );
}
