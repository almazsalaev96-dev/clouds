/**
 * Handing the viewer a file.
 *
 * Two hosts, two mechanisms. In an ordinary browser a blob URL and a synthetic
 * click is the way. Inside the claude.ai artifact viewer that is inert — the frame
 * is never allowed to start a download itself — and the file has to go through the
 * `downloads` capability, which shows the viewer a confirmation they can decline.
 *
 * One function so the Settings screen does not have to know which host it is in.
 */

interface DownloadsNamespace {
  save(request: { filename: string; data: string | Blob }): Promise<{ status: string }>;
}

interface ClaudeGlobal {
  use?: (name: string) => Promise<unknown>;
}

export type SaveOutcome = 'saved' | 'declined' | 'unavailable';

export async function saveFile(
  filename: string,
  data: string,
  mimeType = 'application/json',
): Promise<SaveOutcome> {
  const claude = (globalThis as { claude?: ClaudeGlobal }).claude;

  if (typeof claude?.use === 'function') {
    try {
      const downloads = (await claude.use('downloads')) as DownloadsNamespace | null;
      if (downloads) {
        await downloads.save({ filename, data });
        return 'saved';
      }
    } catch (error) {
      // The viewer said no, or the host refused. Either way there is nothing to
      // fall back to here — a frame download is exactly what is blocked.
      const code = (error as { code?: string })?.code;
      return code === 'declined' ? 'declined' : 'unavailable';
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return 'saved';
  } catch {
    return 'unavailable';
  }
}
