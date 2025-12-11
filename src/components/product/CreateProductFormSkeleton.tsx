import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

export const CreateProductFormSkeleton = () => {
  return (
    <Card className="w-full max-w-lg mx-auto animate-in slide-in-from-bottom-5 duration-300 shadow-lg border-2 border-stone-200">
      <CardHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" /> {/* Title */}
          <Skeleton className="h-6 w-24 rounded-full" /> {/* AI Badge */}
        </div>
      </CardHeader>

      <CardContent className="px-6 py-6 space-y-6">
        {/* Image Preview Skeleton */}
        <div className="flex flex-col items-center gap-2 pb-4 border-b border-stone-200">
          <Skeleton className="w-40 h-40 rounded-2xl" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Product Identification Section */}
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-16 mb-2" /> {/* Label */}
            <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
          </div>
          <div>
            <Skeleton className="h-4 w-20 mb-2" /> {/* Label */}
            <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
          </div>
        </div>

        {/* Product Details Section */}
        <div className="space-y-4 pt-4 border-t border-stone-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-4 w-20 mb-2" /> {/* Label */}
              <Skeleton className="h-10 w-full rounded-md" /> {/* Select */}
            </div>
            <div>
              <Skeleton className="h-4 w-16 mb-2" /> {/* Label */}
              <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
            </div>
          </div>
        </div>

        {/* Stock & Expiry Section */}
        <div className="space-y-4 pt-4 border-t border-stone-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-4 w-24 mb-2" /> {/* Label */}
              <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-2" /> {/* Label */}
              <Skeleton className="h-10 w-full rounded-md" /> {/* Input */}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-gradient-to-br from-stone-50 to-stone-100/50 p-6 border-t-2 border-stone-200 flex gap-3">
        <Skeleton className="h-12 flex-1 rounded-md" /> {/* Cancel button */}
        <Skeleton className="h-12 flex-1 rounded-md" /> {/* Submit button */}
      </CardFooter>
    </Card>
  );
};

export default CreateProductFormSkeleton;
