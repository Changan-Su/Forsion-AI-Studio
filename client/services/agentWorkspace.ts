/**
 * .agent/ directory management for each session workspace.
 *
 * Layout inside a session's virtual filesystem (IndexedDB):
 *   .agent/skills/<skill-id>.skill.md   -- custom skill definitions
 *
 * Built-in skills are bundled at build time and never written here.
 */
import { workspaceService } from './workspaceService';
import { parseSkillMd, serializeSkillMd, customSkillToParsed, type ParsedSkill } from './skillParser';
import type { SkillDefinition, CustomSkillDefinition } from '../types';
import { STORAGE_KEYS } from '../constants';

// GlobalDB: a dedicated IndexedDB for agent-global state (migration flags, etc.)
// Keyed separately from per-session workspace to avoid polluting the session FS.
const GLOBAL_DB_NAME = 'forsion_agent_global';
const GLOBAL_DB_VERSION = 1;
const GLOBAL_STORE = 'meta';

function openGlobalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(GLOBAL_DB_NAME, GLOBAL_DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(GLOBAL_STORE)) {
        req.result.createObjectStore(GLOBAL_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getGlobalMeta(key: string): Promise<string | null> {
  const db = await openGlobalDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(GLOBAL_STORE, 'readonly').objectStore(GLOBAL_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function setGlobalMeta(key: string, value: string): Promise<void> {
  const db = await openGlobalDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(GLOBAL_STORE, 'readwrite').objectStore(GLOBAL_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

const SKILLS_DIR = '.agent/skills';

function skillPath(skillId: string): string {
  return `${SKILLS_DIR}/${skillId}.skill.md`;
}

// ── Initialize ────────────────────────────────────────────────────────────────

/**
 * Ensure the .agent/skills directory marker exists.
 * In the virtual FS we just write a placeholder .gitkeep file.
 */
export async function initAgentWorkspace(sessionId: string): Promise<void> {
  const marker = `${SKILLS_DIR}/.gitkeep`;
  const existing = await workspaceService.readTextFile(sessionId, marker);
  if (existing === null) {
    await workspaceService.writeTextFile(sessionId, marker, '', 'text/plain');
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * List and parse all custom skill files from .agent/skills/.
 * Returns an empty array if none exist.
 */
export async function listWorkspaceSkills(sessionId: string): Promise<ParsedSkill[]> {
  const allFiles = await workspaceService.listFiles(sessionId);
  const skillFiles = allFiles.filter(
    (f) => f.path.startsWith(SKILLS_DIR + '/') && f.path.endsWith('.skill.md')
  );

  const skills: ParsedSkill[] = [];
  for (const meta of skillFiles) {
    const raw = await workspaceService.readTextFile(sessionId, meta.path);
    if (!raw) continue;
    try {
      const parsed = parseSkillMd(raw);
      skills.push(parsed);
    } catch (e) {
      console.error(`[agentWorkspace] Failed to parse skill at ${meta.path}:`, e);
    }
  }
  return skills;
}

// ── Save ─────────────────────────────────────────────────────────────────────

/**
 * Serialize and write a custom skill to .agent/skills/<id>.skill.md.
 */
export async function saveWorkspaceSkill(
  sessionId: string,
  skill: SkillDefinition
): Promise<void> {
  await initAgentWorkspace(sessionId);
  const content = serializeSkillMd(skill);
  await workspaceService.writeTextFile(sessionId, skillPath(skill.id), content, 'text/markdown');
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Remove a custom skill file from .agent/skills/.
 */
export async function deleteWorkspaceSkill(
  sessionId: string,
  skillId: string
): Promise<boolean> {
  return workspaceService.deleteFile(sessionId, skillPath(skillId));
}

// ── Migration ─────────────────────────────────────────────────────────────────

const MIGRATION_IDB_KEY = 'custom_skills_migrated';

/**
 * One-time migration: if localStorage has legacy custom skills, write them as
 * SKILL.md files into the given session's .agent/skills/ directory and remove
 * the localStorage entry.
 *
 * Idempotent:
 *  - The migration flag is stored in IndexedDB (no localStorage writes).
 *  - If the source key is already gone, nothing happens.
 */
export async function migrateLocalStorageSkills(sessionId: string): Promise<void> {
  // Check migration flag in IndexedDB — no localStorage involved
  const alreadyDone = await getGlobalMeta(MIGRATION_IDB_KEY).catch(() => null);
  if (alreadyDone === 'done') return;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_SKILLS);
    if (!raw) {
      await setGlobalMeta(MIGRATION_IDB_KEY, 'done');
      return;
    }

    const legacySkills: CustomSkillDefinition[] = JSON.parse(raw);
    if (!Array.isArray(legacySkills) || legacySkills.length === 0) {
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_SKILLS);
      await setGlobalMeta(MIGRATION_IDB_KEY, 'done');
      return;
    }

    await initAgentWorkspace(sessionId);

    for (const skill of legacySkills) {
      try {
        const parsed = customSkillToParsed(skill);
        await saveWorkspaceSkill(sessionId, parsed);
      } catch (e) {
        console.error(`[agentWorkspace] Migration failed for skill ${skill.id}:`, e);
      }
    }

    // Remove the legacy localStorage key — all data now lives in IndexedDB
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_SKILLS);
    await setGlobalMeta(MIGRATION_IDB_KEY, 'done');
    console.log(`[agentWorkspace] Migrated ${legacySkills.length} skills from localStorage to .agent/skills/`);
  } catch (e) {
    console.error('[agentWorkspace] Migration error:', e);
  }
}

// ── Read one ──────────────────────────────────────────────────────────────────

/**
 * Read and parse a single skill by id.
 */
export async function getWorkspaceSkill(
  sessionId: string,
  skillId: string
): Promise<ParsedSkill | null> {
  const raw = await workspaceService.readTextFile(sessionId, skillPath(skillId));
  if (!raw) return null;
  try {
    return parseSkillMd(raw);
  } catch (e) {
    console.error(`[agentWorkspace] Failed to parse skill ${skillId}:`, e);
    return null;
  }
}
