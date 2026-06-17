import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import type { Project } from "../types";
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../services/projects.api";

export function useProjects() {
  const navigate = useNavigate();

  // ── Remote state ───────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renameModalId, setRenameModalId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetchProjects();
        if (!cancelled) setProjects(res.data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    try {
      setIsCreating(true);
      const created = await createProject({ name: newProjectName.trim() });
      setProjects((prev) => [created, ...prev]);
      setNewProjectName("");
      setShowNewModal(false);
      // navigate("/dashboard");
      navigate(
          `/dashboard/${created.id}`,
        );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }, [newProjectName, navigate]);

  // ── Rename ─────────────────────────────────────────────────────────────────
  const handleRename = useCallback(async (id: string, name: string) => {
    try {
      setIsRenaming(true);
      const updated = await updateProject(id, { name });
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRenaming(false);
      setOpenMenuId(null);
      setRenameModalId(null);
      setRenameInputValue("");
    }
  }, []);

  const openRenameModal = (id: string, currentName: string) => {
    setRenameModalId(id);
    setRenameInputValue(currentName);
  };

  const closeRenameModal = () => {
    setRenameModalId(null);
    setRenameInputValue("");
  };

  const submitRename = async () => {
    if (!renameInputValue.trim() || !renameModalId) return;
    await handleRename(renameModalId, renameInputValue.trim());
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    try {
      setDeletingId(id);
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
      setOpenMenuId(null);
    }
  }, []);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openNewModal = () => {
    setNewProjectName("");
    setShowNewModal(true);
  };
  const closeNewModal = () => {
    setNewProjectName("");
    setShowNewModal(false);
  };

  return {
    // Data
    projects,
    filtered,
    isLoading,
    error,

    // Search
    search,
    setSearch,

    // Menu
    openMenuId,
    setOpenMenuId,

    // Modal
    showNewModal,
    newProjectName,
    setNewProjectName,
    isCreating,
    openNewModal,
    closeNewModal,

    // Rename Modal
    renameModalId,
    renameInputValue,
    setRenameInputValue,
    isRenaming,
    openRenameModal,
    closeRenameModal,
    submitRename,

    // Async states
    deletingId,

    // Handlers
    handleCreateProject,
    handleRename,
    handleDelete,
  };
}