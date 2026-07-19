import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

export function LogoutButton() {
  const logout = useAuthStore((s) => s.logout);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void logout()}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" /> Log out
    </Button>
  );
}
