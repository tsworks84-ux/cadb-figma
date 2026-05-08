"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function Home() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/login"); return; }
    router.replace(user?.role === "EMPLOYEE" ? "/dashboard/home" : "/dashboard/employees");
  }, []);
  return null;
}
