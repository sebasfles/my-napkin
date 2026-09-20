"use client";

import { Check, Folder as FolderIcon, Home } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { byteSize, type ByteUnit } from "@/lib/bytes";
import {
  isFolder,
  isLocked,
  parentOf,
  type Diagram,
  type Item,
  type ParentId,
} from "@/lib/diagrams";
import { folderChoices, pathTo, subtreeCounts } from "@/lib/tree";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NameDialog({
  item,
  open,
  onOpenChange,
  onSubmit,
}: DialogProps & { item: Item | null; onSubmit: (name: string) => void }) {
  const t = useTranslations("sidebar");
  const creating = item === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="name-dialog">
        <DialogHeader>
          <DialogTitle>
            {creating ? t("newFolderTitle") : isFolder(item) ? t("renameFolder") : t("renameTitle")}
          </DialogTitle>
          <DialogDescription>{creating ? t("newFolderBody") : t("renameBody")}</DialogDescription>
        </DialogHeader>

        <NameForm
          key={item ? `${item.id}:${item.name}` : "new"}
          initialName={item?.name ?? ""}
          confirm={creating ? t("create") : t("renameConfirm")}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  initialName,
  confirm,
  onSubmit,
}: {
  initialName: string;
  confirm: string;
  onSubmit: (name: string) => void;
}) {
  const t = useTranslations("sidebar");
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed.length > 0) onSubmit(trimmed);
      }}
    >
      <Input
        autoFocus
        aria-label={t("nameLabel")}
        data-testid="name-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" data-testid="name-cancel">
            {t("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" data-testid="name-submit" disabled={trimmed.length === 0}>
          {confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MoveDialog({
  item,
  items,
  open,
  onOpenChange,
  onMove,
}: DialogProps & { item: Item | null; items: Item[]; onMove: (parentId: ParentId) => void }) {
  const t = useTranslations("sidebar");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="move-dialog">
        <DialogHeader>
          <DialogTitle>{t("moveTitle")}</DialogTitle>
          <DialogDescription>{t("moveBody", { name: item?.name ?? "" })}</DialogDescription>
        </DialogHeader>

        {item ? <MoveForm key={item.id} item={item} items={items} onMove={onMove} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MoveForm({
  item,
  items,
  onMove,
}: {
  item: Item;
  items: Item[];
  onMove: (parentId: ParentId) => void;
}) {
  const t = useTranslations("sidebar");
  const here = parentOf(item);
  const [target, setTarget] = useState<ParentId>(here);
  const choices = folderChoices(items, item.id);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="listbox"
        aria-label={t("moveTitle")}
        className="-mx-1 max-h-64 overflow-y-auto"
        data-testid="move-choices"
      >
        <MoveChoice
          name={t("diagrams")}
          icon={<Home aria-hidden className="size-4 text-muted-foreground" />}
          depth={0}
          selected={target === null}
          onSelect={() => setTarget(null)}
        />
        {choices.map(({ folder, depth }) => (
          <MoveChoice
            key={folder.id}
            name={folder.name}
            icon={<FolderIcon aria-hidden className="size-4 text-muted-foreground" />}
            depth={depth + 1}
            selected={target === folder.id}
            onSelect={() => setTarget(folder.id)}
          />
        ))}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" data-testid="move-cancel">
            {t("cancel")}
          </Button>
        </DialogClose>
        <Button
          type="button"
          data-testid="move-submit"
          disabled={target === here}
          onClick={() => onMove(target)}
        >
          {t("moveConfirm")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function MoveChoice({
  name,
  icon,
  depth,
  selected,
  onSelect,
}: {
  name: string;
  icon: ReactNode;
  depth: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-testid="move-choice"
      onClick={onSelect}
      style={{ paddingInlineStart: `${0.5 + Math.min(depth, 5)}rem` }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
        "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected && "bg-accent text-accent-foreground",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {selected ? <Check aria-hidden className="size-4 shrink-0" /> : null}
    </button>
  );
}

export function InfoDialog({
  diagram,
  items,
  open,
  onOpenChange,
}: DialogProps & { diagram: Diagram | null; items: Item[] }) {
  const t = useTranslations("sidebar");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="info-dialog">
        <DialogHeader>
          <DialogTitle>{t("infoTitle")}</DialogTitle>
          <DialogDescription>{t("infoBody")}</DialogDescription>
        </DialogHeader>

        {diagram ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <Field label={t("infoName")} testId="info-name" value={diagram.name} />
            <Field
              label={t("infoPath")}
              testId="info-path"
              value={folderPath(items, parentOf(diagram), t("diagrams"))}
            />
            <Field
              label={t("infoCreated")}
              testId="info-created"
              value={<At at={diagram.createdAt} />}
            />
            <Field
              label={t("infoUpdated")}
              testId="info-updated"
              value={<At at={diagram.updatedAt} />}
            />
            <Field
              label={t("infoPinned")}
              testId="info-pinned"
              value={diagram.pinnedAt ? <At at={diagram.pinnedAt} /> : t("infoUnknown")}
            />
            <Field
              label={t("infoLocked")}
              testId="info-locked"
              value={diagram.lockedAt ? <At at={diagram.lockedAt} /> : t("infoUnknown")}
            />
            <Field
              label={t("infoElements")}
              testId="info-elements"
              value={<Count of={diagram.elementCount} />}
            />
            <Field
              label={t("infoSize")}
              testId="info-size"
              value={<Size bytes={diagram.sceneBytes} />}
            />
          </dl>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="info-close">
              {t("close")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDialog({
  item,
  items,
  open,
  onOpenChange,
  onConfirm,
}: DialogProps & { item: Item | null; items: Item[]; onConfirm: () => void }) {
  const t = useTranslations("sidebar");
  const locked = item !== null && !isFolder(item) && isLocked(item);
  const name = item?.name ?? "";
  const counts = item && isFolder(item) ? subtreeCounts(items, item.id) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {locked ? t("deleteLockedTitle") : counts ? t("deleteFolderTitle") : t("deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {locked
              ? t("deleteLockedBody", { name })
              : counts
                ? t("deleteFolderBody", {
                    name,
                    diagrams: counts.diagrams,
                    folders: counts.folders,
                  })
                : t("deleteBody", { name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-cancel">
            {locked ? t("close") : t("cancel")}
          </AlertDialogCancel>
          {locked ? null : (
            <AlertDialogAction
              variant="destructive"
              data-testid="delete-confirm"
              onClick={onConfirm}
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function folderPath(items: Item[], folderId: ParentId, rootName: string): string {
  const path = pathTo(items, folderId) ?? [];
  return [rootName, ...path.map((folder) => folder.name)].join(" / ");
}

function Field({ label, testId, value }: { label: string; testId: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-xs" data-testid={testId}>
        {value}
      </dd>
    </>
  );
}

function At({ at }: { at: string }) {
  const format = useFormatter();
  return <>{format.dateTime(new Date(at), { dateStyle: "medium", timeStyle: "short" })}</>;
}

function Count({ of }: { of: number | undefined }) {
  const t = useTranslations("sidebar");
  const format = useFormatter();

  if (of === undefined) return <>{t("infoUnknown")}</>;
  return <>{format.number(of)}</>;
}

function Size({ bytes }: { bytes: number | undefined }) {
  const t = useTranslations("sidebar");
  const format = useFormatter();

  if (bytes === undefined) return <>{t("infoUnknown")}</>;

  const { value, unit } = byteSize(bytes);
  const label: Record<ByteUnit, string> = { b: t("sizeB"), kb: t("sizeKb"), mb: t("sizeMb") };

  return (
    <>
      {format.number(value, { maximumFractionDigits: 1 })} {label[unit]}
    </>
  );
}
