interface HeaderProps {
  tenantSlug: string;
}

export function Header({ tenantSlug }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Tenant:</span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {tenantSlug}
        </span>
      </div>
    </header>
  );
}
