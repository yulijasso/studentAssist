'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Settings } from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  tenantSlug: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

export function Sidebar({ tenantSlug }: SidebarProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: 'Overview',
      href: `/dashboard/${tenantSlug}`,
      icon: LayoutDashboard,
    },
    {
      label: 'Departments',
      href: `/dashboard/${tenantSlug}/departments`,
      icon: Building2,
    },
    {
      label: 'Settings',
      href: `/dashboard/${tenantSlug}/settings`,
      icon: Settings,
    },
  ];

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-4">
        <span className="text-lg font-bold text-primary">Campus Assist</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <p className="text-xs text-muted-foreground">Phase 1 — Web Search</p>
      </div>
    </aside>
  );
}
