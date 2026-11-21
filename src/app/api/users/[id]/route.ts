import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/backend/auth";
import { AccountValidationError, updateEmployeeAccount, deleteEmployeeAccount } from "@/backend/users/user-service";

type Context = { params: Promise<{ id: string }> };

async function authorize() {
  const current = await getCurrentUser();
  if (!current) return { denied: NextResponse.json({ error: "Silakan login terlebih dahulu" }, { status: 401 }) };
  if (current.role !== Role.OWNER) return { denied: NextResponse.json({ error: "Hanya Owner yang dapat mengelola akun" }, { status: 403 }) };
  return { current };
}

export async function PATCH(req: NextRequest, context: Context) {
  const auth = await authorize();
  if (auth.denied) return auth.denied;
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "ID akun tidak valid" }, { status: 400 });
  try {
    const user = await updateEmployeeAccount(id, auth.current!.userId, await req.json());
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AccountValidationError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Format JSON tidak valid" }, { status: 400 });
    console.error("Update user error:", err);
    return NextResponse.json({ error: "Gagal mengubah akun" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: Context) {
  const auth = await authorize();
  if (auth.denied) return auth.denied;
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "ID akun tidak valid" }, { status: 400 });
  try {
    const result = await deleteEmployeeAccount(id, auth.current!.userId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AccountValidationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Delete user error:", err);
    return NextResponse.json({ error: "Gagal menghapus akun" }, { status: 500 });
  }
}
