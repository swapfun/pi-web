"use client";

import { useEffect, useMemo, useState } from "react";
import { loadProjectShortcuts, saveProjectShortcuts, emptyProjectShortcuts, shortcutName, PROJECT_SHORTCUT_INITIAL_COUNT, PROJECT_SHORTCUT_MAX_COUNT, type ProjectShortcut } from "@/lib/project-shortcuts";

export interface ShortcutProject {
  key: string;
  root: string;
  name?: string;
}

function projectName(project: ShortcutProject): string {
  return project.name || project.root.replace(/[\\/]+$/u, "").split(/[\\/]/u).filter(Boolean).pop() || "Project";
}

function initials(value: string): string {
  const han = value.match(/[\p{Script=Han}]/gu);
  if (han?.length) return han.slice(0, 2).join("");
  return (value.match(/[a-z]/gi)?.join("") || value).slice(0, 4);
}

export function ProjectShortcutBar({ projects, selectedProjectKey, activityByProject, onSelect }: {
  projects: ShortcutProject[];
  selectedProjectKey: string | null;
  activityByProject?: ReadonlyMap<string, { running: number; unread: number }>;
  onSelect: (project: ShortcutProject) => void;
}) {
  const [slots, setSlots] = useState<ProjectShortcut[] | null>(() => loadProjectShortcuts());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectShortcut[]>([]);
  const byKey = useMemo(() => new Map(projects.map((project) => [project.key, project])), [projects]);

  useEffect(() => {
    if (slots !== null || projects.length === 0) return;
    const initial = emptyProjectShortcuts();
    projects.slice(0, PROJECT_SHORTCUT_INITIAL_COUNT).forEach((project, index) => { initial[index] = { projectKey: project.key }; });
    setSlots(initial);
    saveProjectShortcuts(initial);
  }, [projects, slots]);

  const current = slots ?? emptyProjectShortcuts();
  const beginEdit = () => { setDraft(current.map((slot) => ({ ...slot }))); setEditing((open) => !open); };
  const save = () => {
    const next = draft.slice(0, PROJECT_SHORTCUT_MAX_COUNT).map((slot) => {
      const name = shortcutName(slot.name ?? "");
      return { projectKey: slot.projectKey || null, ...(name ? { name } : {}) };
    });
    setSlots(next);
    saveProjectShortcuts(next);
    setEditing(false);
  };

  return (
    <div style={{ padding: "5px 10px 7px", borderBottom: "1px solid var(--border)" }}>
      <div aria-label="常用项目" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, overflow: "hidden" }}>
        {current.map((slot, index) => {
          const project = slot.projectKey ? byKey.get(slot.projectKey) : undefined;
          if (!project) return null;
          const name = slot.name || projectName(project);
          const active = project.key === selectedProjectKey;
          const activity = activityByProject?.get(project.key);
          return (
            <button key={`${project.key}-${index}`} type="button" title={project.root} aria-label={name} aria-current={active ? "page" : undefined} onClick={() => onSelect(project)}
              style={{ position: "relative", width: 34, height: 30, padding: "0 4px", border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, background: active ? "var(--bg-selected)" : "var(--bg-panel)", color: active ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontSize: 11, fontWeight: 650 }}>
              {initials(name)}
              {Boolean(activity?.running) && <span aria-label={`运行中 ${activity?.running}`} style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, border: "2px solid var(--bg-panel)", borderRadius: "50%", background: "#f97316" }} />}
              {Boolean(activity?.unread) && <span aria-label={`未读 ${activity?.unread}`} style={{ position: "absolute", bottom: -2, right: activity?.running ? -3 : -2, width: 8, height: 8, border: "2px solid var(--bg-panel)", borderRadius: "50%", background: "#22c55e" }} />}
            </button>
          );
        })}
        <button type="button" title={editing ? "关闭项目快捷键编辑" : "编辑项目快捷键"} aria-label="编辑项目快捷键" aria-expanded={editing} onClick={beginEdit}
          style={{ width: 30, height: 30, padding: 0, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", fontSize: 15 }}>⋯</button>
      </div>
      {editing && (
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 7, background: "var(--bg-panel)" }}>
          <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
            {draft.map((slot, index) => (
              <div key={index} style={{ display: "flex", gap: 5, minWidth: 0 }}>
                <select aria-label={`快捷键项目 ${index + 1}`} value={slot.projectKey ?? ""} onChange={(event) => setDraft((items) => items.map((item, i) => i === index ? { ...item, projectKey: event.target.value || null } : item))} style={{ flex: 1, minWidth: 0, height: 28, background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 4 }}>
                  <option value="">选择项目…</option>
                  {projects.map((project) => <option key={project.key} value={project.key}>{projectName(project)}</option>)}
                </select>
                <input aria-label={`快捷键名称 ${index + 1}`} value={slot.name ?? ""} maxLength={12} placeholder="名称" onChange={(event) => setDraft((items) => items.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} style={{ width: 62, height: 28, padding: "0 5px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 4 }} />
                <button type="button" aria-label={`删除第 ${index + 1} 个项目快捷键`} title={`删除第 ${index + 1} 个项目快捷键`} onClick={() => setDraft((items) => items.filter((_, i) => i !== index))} style={{ width: 28, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-muted)" }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: 8 }}>
            <button type="button" disabled={draft.length >= PROJECT_SHORTCUT_MAX_COUNT} onClick={() => setDraft((items) => items.length >= PROJECT_SHORTCUT_MAX_COUNT ? items : [...items, { projectKey: null }])}>＋ 添加快捷键</button>
            <span style={{ color: "var(--text-dim)", fontSize: 10 }}>{draft.length}/{PROJECT_SHORTCUT_MAX_COUNT}</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => setEditing(false)}>取消</button>
            <button type="button" onClick={save}>保存</button>
          </div>
        </div>
      )}
    </div>
  );
}
