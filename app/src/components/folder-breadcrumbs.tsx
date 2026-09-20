"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Folder, ParentId } from "@/lib/diagrams";

const visibleCrumbs = 2;

export function FolderBreadcrumbs({
  path,
  onNavigate,
}: {
  path: Folder[];
  onNavigate: (folderId: ParentId) => void;
}) {
  const t = useTranslations("sidebar");
  const hidden = path.slice(0, Math.max(path.length - visibleCrumbs, 0));
  const shown = path.slice(hidden.length);

  return (
    <Breadcrumb data-testid="breadcrumbs">
      <BreadcrumbList className="flex-nowrap gap-1 text-xs">
        <BreadcrumbItem>
          {path.length === 0 ? (
            <BreadcrumbPage
              className="text-xs font-medium tracking-wider uppercase"
              data-testid="crumb-root"
            >
              {t("diagrams")}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <button
                type="button"
                data-testid="crumb-root"
                onClick={() => onNavigate(null)}
                className="shrink-0 cursor-pointer text-xs font-medium tracking-wider uppercase outline-none focus-visible:underline"
              >
                {t("diagrams")}
              </button>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {hidden.length > 0 ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("crumbsHidden")}
                    data-testid="crumb-more"
                  >
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {hidden.map((folder) => (
                    <DropdownMenuItem key={folder.id} onSelect={() => onNavigate(folder.id)}>
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
          </>
        ) : null}

        {shown.map((folder, index) => (
          <Fragment key={folder.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              {index === shown.length - 1 ? (
                <BreadcrumbPage className="truncate font-medium" data-testid="crumb-current">
                  {folder.name}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    data-testid="crumb"
                    onClick={() => onNavigate(folder.id)}
                    className="max-w-24 shrink-0 cursor-pointer truncate outline-none focus-visible:underline"
                  >
                    {folder.name}
                  </button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
