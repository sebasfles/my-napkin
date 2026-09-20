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
import {
  createDiagram,
  createFolder,
  createLibrary,
  deleteItem,
  fetchItems,
  lockDiagram,
  moveItem,
  pinDiagram,
  renameItem,
} from "@/lib/api";
import { defaultDiagramName } from "@/lib/diagram-name";
import {
  isDiagram,
  isLibrary,
  type Canvas,
  type Diagram,
  type Folder,
  type Item,
  type Library,
  type ParentId,
} from "@/lib/diagrams";
import type { SaveStatus } from "@/lib/save-state";
import { subtree } from "@/lib/tree";

export interface SaveReport {
  id: string;
  status: SaveStatus;
}

interface WorkspaceValue {
  items: Item[];
  loading: boolean;
  failed: boolean;
  reload: () => void;
  create: (parentId: ParentId) => Promise<Diagram>;
  createFolder: (name: string, parentId: ParentId) => Promise<Folder>;
  createLibrary: (name: string) => Promise<Library>;
  rename: (id: string, name: string) => Promise<void>;
  move: (id: string, parentId: ParentId) => Promise<void>;
  setPinned: (id: string, pinned: boolean) => Promise<void>;
  setLock: (id: string, locked: boolean) => Promise<void>;
  registerSaver: (id: string, settle: () => Promise<void>) => () => void;
  remove: (id: string) => Promise<string[]>;
  markSaved: (item: Canvas) => void;
  isDeleted: (id: string) => boolean;
  saveStatus: SaveReport | null;
  reportSave: (id: string, status: SaveStatus) => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveReport | null>(null);
  const deleted = useRef<Set<string>>(new Set());
  const settlers = useRef<Map<string, () => Promise<void>>>(new Map());

  useEffect(() => {
    let active = true;

    fetchItems()
      .then((loaded) => {
        if (!active) return;
        setItems(loaded);
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

  const create = useCallback(
    async (parentId: ParentId) => {
      const name = defaultDiagramName(
        new Date(),
        items.filter(isDiagram).map((diagram) => diagram.name),
      );
      const created = await createDiagram(name, parentId);
      setItems((current) => [created, ...current]);

      return created;
    },
    [items],
  );

  const addFolder = useCallback(async (name: string, parentId: ParentId) => {
    const created = await createFolder(name, parentId);
    setItems((current) => [created, ...current]);

    return created;
  }, []);

  const addLibrary = useCallback(async (name: string) => {
    const created = await createLibrary(name);
    setItems((current) => [created, ...current]);

    return created;
  }, []);

  const merge = useCallback((id: string, fields: Partial<Item>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...fields } : item)));
  }, []);

  const reportSave = useCallback((id: string, status: SaveStatus) => {
    setSaveStatus({ id, status });
  }, []);

  const rename = useCallback(
    async (id: string, name: string) => {
      const renamed = await renameItem(id, name);
      merge(id, { name: renamed.name });
    },
    [merge],
  );

  const move = useCallback(
    async (id: string, parentId: ParentId) => {
      const moved = await moveItem(id, parentId);
      merge(id, { parentId: moved.parentId });
    },
    [merge],
  );

  const setPinned = useCallback(
    async (id: string, pinned: boolean) => {
      const updated = await pinDiagram(id, pinned);
      merge(id, { pinnedAt: updated.pinnedAt });
    },
    [merge],
  );

  const registerSaver = useCallback((id: string, settle: () => Promise<void>) => {
    settlers.current.set(id, settle);

    return () => {
      if (settlers.current.get(id) === settle) settlers.current.delete(id);
    };
  }, []);

  const setLock = useCallback(
    async (id: string, locked: boolean) => {
      if (locked) await settlers.current.get(id)?.();

      const updated = await lockDiagram(id, locked);
      merge(id, { lockedAt: updated.lockedAt });
    },
    [merge],
  );

  const markSaved = useCallback(
    (item: Canvas) => {
      merge(item.id, {
        updatedAt: item.updatedAt,
        elementCount: item.elementCount,
        sceneBytes: item.sceneBytes,
        ...(isLibrary(item) ? { itemCount: item.itemCount } : {}),
      });
    },
    [merge],
  );

  const remove = useCallback(
    async (id: string) => {
      const doomed = subtree(items, id).map((item) => item.id);
      const gone = doomed.length > 0 ? doomed : [id];

      for (const memberId of gone) deleted.current.add(memberId);

      try {
        await deleteItem(id);
      } catch (error) {
        for (const memberId of gone) deleted.current.delete(memberId);
        throw error;
      }

      setItems((current) => current.filter((item) => !gone.includes(item.id)));

      return gone;
    },
    [items],
  );

  const isDeleted = useCallback((id: string) => deleted.current.has(id), []);

  const value = useMemo(
    () => ({
      items,
      loading: state === "loading",
      failed: state === "failed",
      reload,
      create,
      createFolder: addFolder,
      createLibrary: addLibrary,
      rename,
      move,
      setPinned,
      setLock,
      registerSaver,
      remove,
      markSaved,
      isDeleted,
      saveStatus,
      reportSave,
    }),
    [
      addFolder,
      addLibrary,
      create,
      isDeleted,
      items,
      markSaved,
      move,
      registerSaver,
      reload,
      remove,
      rename,
      reportSave,
      saveStatus,
      setLock,
      setPinned,
      state,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
