import { ReactNode } from "react";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/backend/auth";

export const dynamic = "force-dynamic";

export default async function UsersLayout({ children }: { children: ReactNode }) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.role !== Role.OWNER) redirect("/dashboard");
  return children;
}
