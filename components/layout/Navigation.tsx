"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ChartColumn, BookX, Star, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: "/", label: "홈", icon: House },
  { href: "/stats", label: "통계", icon: ChartColumn },
  { href: "/notes", label: "오답노트", icon: BookX },
  { href: "/favorites", label: "즐겨찾기", icon: Star },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 주요 내비게이션 링크. Header(데스크톱)와 하단 바(모바일)에서 재사용. */
export function Navigation({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-violet-50 text-violet-600"
                : "text-slate-400 hover:bg-[#f5f4fb] hover:text-slate-900",
            )}
          >
            <Icon strokeWidth={1.5} className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
