import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserType } from "@/types/database";

export function AccountTypeBadge({
  userType,
  isVerified,
}: {
  userType: UserType;
  isVerified: boolean;
}) {
  if (isVerified) {
    return <BadgeCheck className="h-4 w-4 text-foreground" aria-label="Verified" />;
  }
  if (userType === "creator") {
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
        Creator
      </span>
    );
  }
  if (userType === "professional") {
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
        Pro
      </span>
    );
  }
  return null;
}
