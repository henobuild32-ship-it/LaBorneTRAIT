'use client';

import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionPanelProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export default function SectionPanel({
  title,
  description,
  icon,
  badge,
  defaultOpen = true,
  collapsible = true,
  className,
  contentClassName,
  children,
}: SectionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  const header = (
    <>
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold uppercase tracking-wider text-foreground">
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      {badge}
      {collapsible && (
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      )}
    </>
  );

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={contentId}
          className={cn(
            'flex w-full min-h-[44px] items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            !open && 'bg-muted/20',
          )}
        >
          {header}
        </button>
      ) : (
        <div className="flex w-full items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5">
          {header}
        </div>
      )}

      {open && (
        <div id={contentId} className={cn('flex flex-col gap-3', contentClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}
