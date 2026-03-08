import {
  nodeTypeEnum,
  tagTypeEnum,
  type NodeType,
  type TagType,
} from "../db/schema";
import type { ExportFormat, ToolArgs } from "./mcp-tool-executor-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getRequiredStringArg(args: ToolArgs, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string argument: ${key}`);
  }
  return value;
}

export function getOptionalStringArg(
  args: ToolArgs,
  key: string,
): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected string argument: ${key}`);
  }
  return value;
}

export function getOptionalNumberArg(
  args: ToolArgs,
  key: string,
): number | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Expected numeric argument: ${key}`);
  }
  return value;
}

export function getOptionalObjectArg(
  args: ToolArgs,
  key: string,
): Record<string, unknown> | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`Expected object argument: ${key}`);
  }
  return value;
}

export function getOptionalNodeTypeArg(
  args: ToolArgs,
  key: string,
): NodeType | undefined {
  const value = getOptionalStringArg(args, key);
  if (!value) {
    return undefined;
  }
  if (!nodeTypeEnum.includes(value as NodeType)) {
    throw new Error(`Invalid node type: ${value}`);
  }
  return value as NodeType;
}

export function getRequiredNodeTypeArg(args: ToolArgs, key: string): NodeType {
  const value = getRequiredStringArg(args, key);
  if (!nodeTypeEnum.includes(value as NodeType)) {
    throw new Error(`Invalid node type: ${value}`);
  }
  return value as NodeType;
}

export function getOptionalTagTypeArg(
  args: ToolArgs,
  key: string,
): TagType | undefined {
  const value = getOptionalStringArg(args, key);
  if (!value) {
    return undefined;
  }
  if (!tagTypeEnum.includes(value as TagType)) {
    throw new Error(`Invalid tag type: ${value}`);
  }
  return value as TagType;
}

export function getOptionalExportFormatArg(
  args: ToolArgs,
  key: string,
): ExportFormat | undefined {
  const value = getOptionalStringArg(args, key);
  if (!value) {
    return undefined;
  }
  if (value !== "markdown" && value !== "html") {
    throw new Error(`Invalid export format: ${value}`);
  }
  return value;
}

export function getOptionalContentArg(args: ToolArgs, key: string): unknown {
  return args[key];
}

export function getListParentId(args: ToolArgs): string | null {
  const parentId = getOptionalStringArg(args, "parentId");
  if (!parentId || parentId === "root") {
    return null;
  }
  return parentId;
}
