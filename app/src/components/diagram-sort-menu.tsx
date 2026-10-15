"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isInEditor } from "@/lib/editor";
import {
  sortDirections,
  sortBy,
  sortFields,
  type DiagramSort,
  type SortDirection,
  type SortField,
} from "@/lib/tree";

const fieldKey = {
  name: "sortName",
  created: "sortCreated",
  edited: "sortEdited",
} as const satisfies Record<SortField, string>;

function directionKey(field: SortField, direction: SortDirection) {
  if (field === "name") return direction === "asc" ? "sortAtoZ" : "sortZtoA";

  return direction === "asc" ? "sortOldest" : "sortNewest";
}

function directionsFor(field: SortField): SortDirection[] {
  const natural = sortBy(field).direction;

  return [natural, ...sortDirections.filter((direction) => direction !== natural)];
}

export function DiagramSortMenu({
  sort,
  onSort,
}: {
  sort: DiagramSort;
  onSort: (sort: DiagramSort) => void;
}) {
  const t = useTranslations("sidebar");
  const field = t(fieldKey[sort.field]);
  const direction = t(directionKey(sort.field, sort.direction));

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          aria-label={t("sort", { field, direction })}
          data-testid="diagram-sort"
          className="text-muted-foreground"
        >
          {field}
          {sort.direction === "asc" ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-52"
        data-testid="diagram-sort-menu"
        onFocusOutside={(event) => {
          if (isInEditor(event.target)) event.preventDefault();
        }}
      >
        <DropdownMenuLabel>{t("sortBy")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort.field}
          onValueChange={(value) => {
            const next = sortFields.find((candidate) => candidate === value);
            if (next) onSort(sortBy(next));
          }}
        >
          {sortFields.map((candidate) => (
            <DropdownMenuRadioItem
              key={candidate}
              value={candidate}
              data-testid={`sort-field-${candidate}`}
              onSelect={(event) => event.preventDefault()}
            >
              {t(fieldKey[candidate])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t("sortOrder")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort.direction}
          onValueChange={(value) => {
            const next = sortDirections.find((candidate) => candidate === value);
            if (next) onSort({ ...sort, direction: next });
          }}
        >
          {directionsFor(sort.field).map((candidate) => (
            <DropdownMenuRadioItem
              key={candidate}
              value={candidate}
              data-testid={`sort-direction-${candidate}`}
              onSelect={(event) => event.preventDefault()}
            >
              {t(directionKey(sort.field, candidate))}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
