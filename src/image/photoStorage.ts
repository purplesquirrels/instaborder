// Copies of picked photos in the origin private file system (on disk, not in
// memory). Android can revoke access to files picked earlier, so reading the
// original File again later fails; full-size decodes read these copies instead.

const ROOT_DIR = "photos";
const LOCK_PREFIX = "photos-session-";
// one folder per page, so several open tabs don't delete each other's copies
const SESSION = crypto.randomUUID();

let sessionDir: Promise<FileSystemDirectoryHandle> | null = null;

// remove folders left behind by pages that have since closed
async function removeStaleSessions(dir: FileSystemDirectoryHandle) {
  const { held = [], pending = [] } = await navigator.locks.query();
  const live = new Set([...held, ...pending].map((lock) => lock.name));
  const stale: string[] = [];
  for await (const name of dir.keys()) {
    if (!live.has(LOCK_PREFIX + name)) stale.push(name);
  }
  await Promise.all(
    stale.map((name) =>
      dir.removeEntry(name, { recursive: true }).catch(() => {}),
    ),
  );
}

function getSessionDir() {
  sessionDir ??= (async () => {
    // held for as long as this page is open, marking the folder as in use
    void navigator.locks.request(
      LOCK_PREFIX + SESSION,
      () => new Promise(() => {}),
    );
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(ROOT_DIR, { create: true });
    await removeStaleSessions(dir);
    return dir.getDirectoryHandle(SESSION, { create: true });
  })();
  return sessionDir;
}

// Copy `file` to storage and return the copy, or the original if storage
// isn't available (unsupported, private browsing, out of quota).
export async function storeCopy(file: File, name: string): Promise<File> {
  try {
    const dir = await getSessionDir();
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    return await handle.getFile();
  } catch (err) {
    console.warn("Couldn't keep a copy of the photo; using the original", err);
    return file;
  }
}

export async function removeCopies(names: string[]) {
  if (!sessionDir) return;
  const dir = await sessionDir.catch(() => null);
  await Promise.all(
    names.map((name) => dir?.removeEntry(name).catch(() => {})),
  );
}
