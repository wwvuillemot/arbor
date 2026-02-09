"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Loader2 } from "lucide-react";

const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ImageUploadProps {
  nodeId: string;
  projectId: string;
  onUploadComplete: (attachmentId: string, downloadUrl: string) => void;
  onUploadError?: (error: string) => void;
  onUpload: (params: {
    nodeId: string;
    projectId: string;
    filename: string;
    mimeType: string;
    data: string;
  }) => Promise<{ id: string }>;
  onGetDownloadUrl: (params: { id: string }) => Promise<{ url: string }>;
  isUploading?: boolean;
}

export function ImageUpload({
  nodeId,
  projectId,
  onUploadComplete,
  onUploadError,
  onUpload,
  onGetDownloadUrl,
  isUploading = false,
}: ImageUploadProps) {
  const t = useTranslations("editor");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const validateFile = React.useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        return t("imageUpload.invalidType");
      }
      if (file.size > MAX_FILE_SIZE) {
        return t("imageUpload.fileTooLarge");
      }
      return null;
    },
    [t],
  );

  const processFile = React.useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        onUploadError?.(validationError);
        return;
      }

      try {
        // Convert to base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(arrayBuffer)),
        );

        // Upload via tRPC
        const attachment = await onUpload({
          nodeId,
          projectId,
          filename: file.name,
          mimeType: file.type,
          data: base64,
        });

        // Get download URL
        const { url } = await onGetDownloadUrl({ id: attachment.id });
        onUploadComplete(attachment.id, url);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("imageUpload.uploadFailed");
        onUploadError?.(message);
      }
    },
    [
      nodeId,
      projectId,
      validateFile,
      onUpload,
      onGetDownloadUrl,
      onUploadComplete,
      onUploadError,
      t,
    ],
  );

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((f) =>
        ACCEPTED_IMAGE_TYPES.includes(f.type),
      );
      if (imageFile) {
        processFile(imageFile);
      }
    },
    [processFile],
  );

  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [processFile],
  );

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
        isDragging
          ? "border-accent bg-accent/10"
          : "border-muted-foreground/25 hover:border-accent/50"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      data-testid="image-upload-dropzone"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          fileInputRef.current?.click();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
        data-testid="image-upload-input"
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t("imageUpload.uploading")}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <ImagePlus className="w-6 h-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t("imageUpload.dropOrClick")}
          </span>
          <span className="text-xs text-muted-foreground/60">
            {t("imageUpload.supportedFormats")}
          </span>
        </div>
      )}
    </div>
  );
}

export { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE };
