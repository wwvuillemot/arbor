"use client";

import { SearchPanel } from "@/components/search";

export default function SearchPage() {
  return (
    <div className="h-full">
      <SearchPanel
        onSelectNode={(nodeId) => {
          // TODO: Navigate to node in projects page
          console.log("Navigate to node:", nodeId);
        }}
      />
    </div>
  );
}
