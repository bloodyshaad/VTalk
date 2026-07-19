import { cn } from "@/lib/utils";

export function StoryRing({
  children,
  seen = false,
  className,
}: {
  children: React.ReactNode;
  seen?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-full p-[2px]",
        seen
          ? "bg-border"
          : "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500",
        className,
      )}
    >
      <div className="rounded-full bg-background p-[2px]">{children}</div>
    </div>
  );
}
