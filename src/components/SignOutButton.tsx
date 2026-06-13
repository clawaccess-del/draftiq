"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-900 bg-slate-900/40 hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
      title="Sign Out"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
