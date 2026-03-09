"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { useTranslations } from "next-intl";
import {
  FileText,
  Folder,
  FolderTree,
  Link2,
  Bot,
  Mic,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractHeroImage, tiptapToMarkdown } from "@/lib/tiptap-utils";
import { HeroGradient } from "@/components/hero-gradient";

export interface TagInfo {
  id: string;
  name: string;
  color: string | null;
}

export interface SearchResultItem {
  nodeId: string;
  name: string;
  nodeType: string;
  score: number;
  matchType: string;
  contentJson?: unknown;
  content?: string;
  updatedAt: string | Date;
  tags?: TagInfo[];
  projectId?: string | null;
  projectName?: string | null;
}

export interface SearchResultCardProps {
  result: SearchResultItem;
  onClick?: () => void;
  className?: string;
}

const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
  project: FolderTree,
  folder: Folder,
  note: FileText,
  link: Link2,
  ai_suggestion: Bot,
  audio_note: Mic,
};

export function SearchResultCard({
  result,
  onClick,
  className,
}: SearchResultCardProps) {
  const tFileTree = useTranslations("fileTree");
  const Icon = NODE_TYPE_ICONS[result.nodeType] ?? FileText;
  const typeLabel =
    tFileTree(
      `nodeTypes.${result.nodeType}` as Parameters<typeof tFileTree>[0],
    ) ?? result.nodeType;

  const heroImage = React.useMemo(
    () => extractHeroImage(result.contentJson),
    [result.contentJson],
  );

  const markdownPreview = React.useMemo(
    () => tiptapToMarkdown(result.contentJson, 400),
    [result.contentJson],
  );

  const snippet = React.useMemo(() => {
    if (result.content) {
      const text = result.content;
      return text.length > 150 ? text.slice(0, 150) + "…" : text;
    }
    return markdownPreview;
  }, [result.content, markdownPreview]);

  const formattedDate = React.useMemo(() => {
    const date = new Date(result.updatedAt);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [result.updatedAt]);

  const tags = result.tags ?? [];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col w-full text-left border rounded-xl overflow-hidden p-0",
        "hover:border-accent hover:shadow-md transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        "bg-card",
        className,
      )}
      data-testid="search-result-card"
    >
      {/* Hero image / gradient */}
      <div className="w-full h-32 border-b">
        <HeroGradient
          seed={result.name}
          imageUrl={heroImage}
          className="w-full h-full"
        />
      </div>

      <div className="p-3 space-y-2">
        {/* Header: icon + type + title */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5 shrink-0 p-1 rounded bg-muted text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-semibold text-sm leading-tight"
                data-testid="result-name"
              >
                {result.name}
              </span>
              <span
                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium uppercase tracking-wide"
                data-testid="result-type"
              >
                {typeLabel}
              </span>
            </div>

            {/* Project breadcrumb */}
            {result.projectName && result.nodeType !== "project" && (
              <div className="flex items-center gap-0.5 mt-0.5 text-xs text-muted-foreground">
                <FolderTree className="h-3 w-3 shrink-0" />
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="truncate">{result.projectName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                style={
                  tag.color
                    ? {
                        borderColor: tag.color + "60",
                        backgroundColor: tag.color + "18",
                        color: tag.color,
                      }
                    : {}
                }
              >
                {tag.name}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Content preview */}
        {snippet && (
          <div className="relative max-h-[120px] overflow-hidden">
            {result.content ? (
              <p
                className="text-xs text-muted-foreground line-clamp-3"
                data-testid="result-snippet"
              >
                {snippet}
              </p>
            ) : (
              <div
                className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-xs text-muted-foreground [&>*]:my-0.5 [&>*:first-child]:mt-0"
                data-testid="result-snippet"
              >
                <ReactMarkdown>{snippet}</ReactMarkdown>
              </div>
            )}
            {/* Fade overlay */}
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
          </div>
        )}

        {/* Footer: match type + score + date */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className="px-1.5 py-0.5 rounded bg-muted"
              data-testid="result-match-type"
            >
              {result.matchType}
            </span>
            <span
              className="flex items-center gap-1"
              data-testid="result-score"
            >
              <span className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                <span
                  className="block h-full bg-primary rounded-full"
                  style={{ width: `${Math.round(result.score * 100)}%` }}
                />
              </span>
              {Math.round(result.score * 100)}%
            </span>
          </div>
          <span data-testid="result-date">{formattedDate}</span>
        </div>
      </div>
    </button>
  );
}
