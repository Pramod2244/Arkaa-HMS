import { Skeleton } from '../../components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/10 z-50">
      <div className="flex flex-col gap-6 items-center">
        <div className="flex gap-4">
          <Skeleton className="h-32 w-64" />
          <Skeleton className="h-32 w-64" />
          <Skeleton className="h-32 w-64" />
        </div>
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64 w-[700px]" />
      </div>
    </div>
  );
}
