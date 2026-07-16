import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useEntitlements } from "@/features/account/hooks/useEntitlements";
import type { Project } from "../types";
import { fetchProjects, createProject, updateProject, deleteProject } from "../services/projects.api";

export function useProjects() {
  const navigate = useNavigate();
  const { entitlements, loading: entitlementsLoading, error: entitlementsError, refresh: refreshEntitlements } = useEntitlements();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renameModalId, setRenameModalId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const filtered = projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase()));
  const projectLimit = entitlements?.limits.projects ?? null;
  const canCreateProject = projectLimit == null || projects.length < projectLimit;

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchProjects();
      setProjects(response.data);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim() || !canCreateProject) return;
    try {
      setError(null);
      setIsCreating(true);
      const created = await createProject({ name: newProjectName.trim() });
      setProjects((current) => [created, ...current]);
      setNewProjectName("");
      setShowNewModal(false);
      await refreshEntitlements(true);
      navigate(`/dashboard/${created.id}`);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setIsCreating(false);
    }
  }, [newProjectName, canCreateProject, navigate, refreshEntitlements]);

  const handleRename = useCallback(async (id: string, name: string) => {
    try {
      setError(null);
      setIsRenaming(true);
      const updated = await updateProject(id, { name });
      setProjects((current) => current.map((project) => project.id === id ? updated : project));
    } catch (renameError) {
      setError((renameError as Error).message);
    } finally {
      setIsRenaming(false);
      setOpenMenuId(null);
      setRenameModalId(null);
      setRenameInputValue("");
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      setError(null);
      setDeletingId(id);
      await deleteProject(id);
      setProjects((current) => current.filter((project) => project.id !== id));
      await refreshEntitlements(true);
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingId(null);
      setOpenMenuId(null);
    }
  }, [refreshEntitlements]);

  return {
    projects, filtered, isLoading, error: error || entitlementsError,
    entitlements, entitlementsLoading, canCreateProject, projectLimit,
    search, setSearch, openMenuId, setOpenMenuId,
    showNewModal, newProjectName, setNewProjectName, isCreating,
    openNewModal: () => { if (canCreateProject) { setNewProjectName(""); setShowNewModal(true); } },
    closeNewModal: () => { setNewProjectName(""); setShowNewModal(false); },
    renameModalId, renameInputValue, setRenameInputValue, isRenaming,
    openRenameModal: (id: string, name: string) => { setRenameModalId(id); setRenameInputValue(name); },
    closeRenameModal: () => { setRenameModalId(null); setRenameInputValue(""); },
    submitRename: async () => { if (renameModalId && renameInputValue.trim()) await handleRename(renameModalId, renameInputValue.trim()); },
    deletingId, handleCreateProject, handleRename, handleDelete, reload: load,
  };
}
