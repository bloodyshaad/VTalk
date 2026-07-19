import { useLocation } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { Construction } from "lucide-react";

export function PlaceholderPage({ title }: { title?: string }) {
  const location = useLocation();
  const label = title ?? location.pathname;
  return (
    <div className="p-8">
      <EmptyState
        icon={<Construction className="h-10 w-10" />}
        title={`${label} — Coming soon`}
        description="This section is part of a later build phase."
      />
    </div>
  );
}
