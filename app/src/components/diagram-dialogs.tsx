"use client";

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
import { isLocked, type Diagram } from "@/lib/diagrams";

export function RenameDialog({
  diagram,
  onSubmit,
  onClose,
}: {
  diagram: Diagram;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("sidebar");
  const [name, setName] = useState(diagram.name);
  const trimmed = name.trim();

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="rename-dialog">
        <DialogHeader>
          <DialogTitle>{t("renameTitle")}</DialogTitle>
          <DialogDescription>{t("renameBody")}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed.length > 0) onSubmit(trimmed);
          }}
        >
          <Input
            autoFocus
            aria-label={t("renameLabel")}
            data-testid="rename-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" data-testid="rename-cancel">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" data-testid="rename-submit" disabled={trimmed.length === 0}>
              {t("renameConfirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InfoDialog({ diagram, onClose }: { diagram: Diagram; onClose: () => void }) {
  const t = useTranslations("sidebar");

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="info-dialog">
        <DialogHeader>
          <DialogTitle>{t("infoTitle")}</DialogTitle>
          <DialogDescription>{t("infoBody")}</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Field label={t("infoName")} testId="info-name" value={diagram.name} />
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
  diagram,
  onConfirm,
  onClose,
}: {
  diagram: Diagram;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("sidebar");
  const locked = isLocked(diagram);

  return (
    <AlertDialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <AlertDialogContent data-testid="delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{locked ? t("deleteLockedTitle") : t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {locked
              ? t("deleteLockedBody", { name: diagram.name })
              : t("deleteBody", { name: diagram.name })}
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
