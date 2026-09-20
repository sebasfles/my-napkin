"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createDiagram, deleteDiagram, fetchDiagrams, lockDiagram, renameDiagram } from "@/lib/api";
import { defaultDiagramName } from "@/lib/diagram-name";
import { byUpdatedAtDesc, type Diagram } from "@/lib/diagrams";
import type { SaveStatus } from "@/lib/save-state";

export interface SaveReport {
  id: string;
  status: SaveStatus;
}

interface DiagramsValue {
  diagrams: Diagram[];
  loading: boolean;
  failed: boolean;
  reload: () => void;
  create: () => Promise<Diagram>;
  rename: (id: string, name: string) => Promise<void>;
  setLock: (id: string, locked: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markSaved: (diagram: Diagram) => void;
  isDeleted: (id: string) => boolean;
  saveStatus: SaveReport | null;
  reportSave: (id: string, status: SaveStatus) => void;
}

const DiagramsContext = createContext<DiagramsValue | null>(null);

export function DiagramsProvider({ children }: { children: ReactNode }) {
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveReport | null>(null);
  const deleted = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    fetchDiagrams()
      .then((loaded) => {
        if (!active) return;
        setDiagrams(loaded);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("failed");
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState("loading");
    setAttempt((value) => value + 1);
  }, []);

  const create = useCallback(async () => {
    const name = defaultDiagramName(
      new Date(),
      diagrams.map((diagram) => diagram.name),
    );
    const created = await createDiagram(name);
    setDiagrams((current) => [created, ...current].sort(byUpdatedAtDesc));
    return created;
  }, [diagrams]);

  const merge = useCallback((id: string, fields: Partial<Diagram>) => {
    setDiagrams((current) =>
      current.map((item) => (item.id === id ? { ...item, ...fields } : item)).sort(byUpdatedAtDesc),
    );
  }, []);

  const reportSave = useCallback((id: string, status: SaveStatus) => {
    setSaveStatus({ id, status });
  }, []);

  const rename = useCallback(
    async (id: string, name: string) => {
      const renamed = await renameDiagram(id, name);
      merge(id, { name: renamed.name });
    },
    [merge],
  );

  const setLock = useCallback(
    async (id: string, locked: boolean) => {
      const updated = await lockDiagram(id, locked);
      merge(id, { lockedAt: updated.lockedAt });
    },
    [merge],
  );

  const markSaved = useCallback(
    (diagram: Diagram) => {
      merge(diagram.id, {
        updatedAt: diagram.updatedAt,
        elementCount: diagram.elementCount,
        sceneBytes: diagram.sceneBytes,
      });
    },
    [merge],
  );

  const remove = useCallback(async (id: string) => {
    deleted.current.add(id);

    try {
      await deleteDiagram(id);
    } catch (error) {
      deleted.current.delete(id);
      throw error;
    }

    setDiagrams((current) => current.filter((item) => item.id !== id));
  }, []);

  const isDeleted = useCallback((id: string) => deleted.current.has(id), []);

  const value = useMemo(
    () => ({
      diagrams,
      loading: state === "loading",
      failed: state === "failed",
      reload,
      create,
      rename,
      setLock,
      remove,
      markSaved,
      isDeleted,
      saveStatus,
      reportSave,
    }),
    [
      create,
      diagrams,
      isDeleted,
      markSaved,
      reload,
      remove,
      rename,
      reportSave,
      saveStatus,
      setLock,
      state,
    ],
  );

  return <DiagramsContext.Provider value={value}>{children}</DiagramsContext.Provider>;
}

export function useDiagrams(): DiagramsValue {
  const value = useContext(DiagramsContext);
  if (!value) throw new Error("useDiagrams must be used inside DiagramsProvider");
  return value;
}
