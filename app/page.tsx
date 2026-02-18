"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const timeoutMs = 5000;
    try {
      const user = await Promise.race([
        getCurrentUser(),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), timeoutMs)
        ),
      ]);
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    } catch (error) {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Aone</h1>
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  return null;
}

