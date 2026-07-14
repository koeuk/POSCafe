"use client";

import { useState } from "react";
import { uploadImage } from "./api";

/**
 * Wraps `uploadImage` with a shared `uploading` flag and multi-file support.
 * Callers keep their own error handling (upload throws on failure), so upload
 * errors surface through the same error slot as the rest of the form.
 */
export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  /** Uploads one file or many; returns the uploaded URL(s). Throws on failure. */
  async function upload(files: File | FileList): Promise<string[]> {
    const list = files instanceof FileList ? Array.from(files) : [files];
    setUploading(true);
    try {
      return await Promise.all(list.map((file) => uploadImage(file)));
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading };
}
