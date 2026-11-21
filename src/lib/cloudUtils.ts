/**
 * Cloud gallery images are returned by the selected hosted provider.
 * Avoid ever writing a generated image into a shared server filesystem.
 * Very large images should be exported by the user instead of persisted in sessions.
 */
export const uploadImageToCloud = async (base64Data:string,_meta:unknown):Promise<string|null> => {
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data) || base64Data.length > 3 * 1024 * 1024) return null;
    return "data:image/png;base64," + base64Data;
};
