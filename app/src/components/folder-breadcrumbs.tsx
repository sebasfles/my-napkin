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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Folder, ParentId } from "@/lib/diagrams";
import { crumbs } from "@/lib/tree";

export function FolderBreadcrumbs({
  path,
  onNavigate,
}: {
  path: Folder[];
  onNavigate: (folderId: ParentId) => void;
}) {
  const t = useTranslations("sidebar");
  const { hidden, shown } = crumbs(path);

  return (
    <Breadcrumb data-testid="breadcrumbs" className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-1 overflow-hidden text-xs">
        <BreadcrumbItem className="shrink-0">
          {path.length === 0 ? (
            <BreadcrumbPage
              className="text-xs font-medium tracking-wider uppercase"
              data-testid="crumb-root"
            >
              {t("home")}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <button
                type="button"
                data-testid="crumb-root"
                onClick={() => onNavigate(null)}
                className="cursor-pointer text-xs font-medium tracking-wider uppercase outline-none focus-visible:underline"
              >
                {t("home")}
              </button>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {hidden.length > 0 ? (
          <>
            <BreadcrumbSeparator className="shrink-0" />
            <BreadcrumbItem className="shrink-0">
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
                      <span className="truncate">{folder.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
          </>
        ) : null}

        {shown.map((folder, index) => (
          <Fragment key={folder.id}>
            <BreadcrumbSeparator className="shrink-0" />
            <BreadcrumbItem className="min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
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
                        className="max-w-24 cursor-pointer truncate outline-none focus-visible:underline"
                      >
                        {folder.name}
                      </button>
                    </BreadcrumbLink>
                  )}
                </TooltipTrigger>
                <TooltipContent data-testid="crumb-tooltip">{folder.name}</TooltipContent>
              </Tooltip>
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
