import { useCallback } from "react";

import { useAuthStore } from "@/store/authStore";


export function useAuthBootstrap() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  return useCallback(() => bootstrap(), [bootstrap]);
}
