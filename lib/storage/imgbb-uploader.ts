/**
 * imgBB Image Hosting Integration
 * 
 * Uploads Puppeteer screenshots directly to imgBB (https://imgbb.com) as base64
 * and returns a permanent public URL — zero local disk storage consumed.
 *
 * API docs: https://api.imgbb.com
 * Get a free API key at: https://api.imgbb.com (sign up → account → API)
 *
 * Set IMGBB_API_KEY in your .env file to enable cloud-hosted screenshots.
 * If the key is missing, the uploader returns null and the system falls back to
 * local disk storage at public/uploads/screenshots/.
 */

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

export interface ImgBBUploadResult {
  /** Direct CDN URL to the full image, e.g. https://i.ibb.co/xxxx/image.png */
  url: string;
  /** Viewer page URL, e.g. https://ibb.co/xxxx */
  viewerUrl: string;
  /** imgBB image ID */
  id: string;
  /** Deletion URL (save this if you ever want to programmatically delete the image) */
  deleteUrl: string;
}

/**
 * Uploads a screenshot buffer or base64 string to imgBB.
 *
 * @param imageBuffer - Raw PNG buffer from Puppeteer's page.screenshot({ encoding: 'binary' })
 * @param name - Optional descriptive name shown in imgBB dashboard
 * @param expirationSeconds - Optional: auto-delete from imgBB after N seconds (60–15552000).
 *                            Leave undefined for permanent hosting.
 * @returns ImgBBUploadResult with public URL, or null if upload failed
 */
export async function uploadToImgBB(
  imageBuffer: Buffer,
  name?: string,
  expirationSeconds?: number
): Promise<ImgBBUploadResult | null> {
  const apiKey = process.env.IMGBB_API_KEY;

  if (!apiKey) {
    return null; // Fall back to local storage
  }

  try {
    const base64Image = imageBuffer.toString('base64');

    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64Image);
    if (name) formData.append('name', name);
    // Default expiration to SCREENSHOT_RETENTION_DAYS (default 3 days = 259,200 seconds)
    const retentionDays = Number(process.env.SCREENSHOT_RETENTION_DAYS) || 3;
    const effectiveExp = expirationSeconds !== undefined ? expirationSeconds : (retentionDays * 24 * 60 * 60);
    if (effectiveExp > 0) {
      formData.append('expiration', String(Math.max(60, Math.min(15552000, effectiveExp))));
    }

    const response = await fetch(IMGBB_API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.warn(`[imgBB] Upload failed — HTTP ${response.status}: ${await response.text()}`);
      return null;
    }

    const result = await response.json() as {
      success: boolean;
      status: number;
      data: {
        id: string;
        url: string;
        display_url: string;
        url_viewer: string;
        delete_url: string;
      };
    };

    if (!result.success || !result.data?.url) {
      console.warn('[imgBB] Upload API returned failure:', result);
      return null;
    }

    return {
      url: result.data.url,
      viewerUrl: result.data.url_viewer,
      id: result.data.id,
      deleteUrl: result.data.delete_url,
    };
  } catch (err) {
    console.warn('[imgBB] Upload error:', (err as Error).message);
    return null;
  }
}

/**
 * Returns true if imgBB integration is configured and active.
 */
export function isImgBBEnabled(): boolean {
  return Boolean(process.env.IMGBB_API_KEY);
}
