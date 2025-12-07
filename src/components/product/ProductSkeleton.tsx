import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

export const ProductSkeleton = () => {
  return (
    <Card className="w-full max-w-lg mx-auto animate-in slide-in-from-bottom-5 duration-300 shadow-lg border-stone-200">
      <CardHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-3/4" /> {/* Product name */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20" /> {/* Category badge */}
              <Skeleton className="h-5 w-24" /> {/* Barcode */}
            </div>
          </div>
          <Skeleton className="h-10 w-10 rounded-full" /> {/* Status icon */}
        </div>
      </CardHeader>

      <CardContent className="px-6 py-6 space-y-6">
        {/* Product Image */}
        <div className="flex justify-center">
          <Skeleton className="h-48 w-48 rounded-2xl" />
        </div>

        {/* Product Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" /> {/* Label */}
            <Skeleton className="h-6 w-24" /> {/* Value */}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" /> {/* Label */}
            <Skeleton className="h-6 w-20" /> {/* Value */}
          </div>
        </div>

        {/* Current Stock */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" /> {/* Label */}
          <Skeleton className="h-8 w-full" /> {/* Stock value */}
        </div>

        {/* Stock Movement Controls */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" /> {/* Quantity input */}
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-12 rounded-lg" /> {/* Add button */}
            <Skeleton className="h-12 rounded-lg" /> {/* Remove button */}
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-gradient-to-br from-stone-50 to-stone-100/50 p-5 border-t-2 border-stone-200 flex gap-3">
        <Skeleton className="h-12 flex-1 rounded-lg" /> {/* History button */}
        <Skeleton className="h-12 flex-1 rounded-lg" /> {/* Close button */}
      </CardFooter>
    </Card>
  );
};

export default ProductSkeleton;
