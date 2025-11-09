"use client";

import { useEffect } from "react";

export function ProtectImages() {
  useEffect(() => {
    // Prevent right-click context menu on images
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" && (target.getAttribute("src")?.includes("logo") || target.getAttribute("src")?.includes("enclave"))) {
        e.preventDefault();
        return false;
      }
    };

    // Prevent drag start on images
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" && (target.getAttribute("src")?.includes("logo") || target.getAttribute("src")?.includes("enclave"))) {
        e.preventDefault();
        return false;
      }
    };

    // Prevent keyboard shortcuts (Ctrl+S, Ctrl+P, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        return false;
      }
      // Prevent Ctrl+P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}


