import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton rounded-md", className)}
      {...props}
    />
  )
}

/**
 * Skeleton component for cart items with shimmer animation
 */
function CartItemSkeleton() {
  return (
    <div className="bg-white border-2 border-stone-200 rounded-xl overflow-hidden animate-fade-in">
      <div className="flex gap-0 items-stretch">
        {/* Image skeleton */}
        <Skeleton className="w-24 min-h-[96px]" />

        {/* Content skeleton */}
        <div className="flex-1 p-3 flex flex-col justify-between">
          <div>
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <Skeleton className="h-11 w-11 rounded-lg" />
              <Skeleton className="h-5 w-8 mx-1" />
              <Skeleton className="h-11 w-11 rounded-lg" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton component for product search results
 */
function ProductSearchSkeleton() {
  return (
    <div className="p-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

export { Skeleton, CartItemSkeleton, ProductSearchSkeleton }
