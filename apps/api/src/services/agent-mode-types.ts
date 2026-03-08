export interface AgentModeConfig {
  /** Unique ID */
  id: string;
  /** Mode identifier (e.g., "assistant", "my-custom-mode") */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of what this mode does */
  description: string;
  /** Tool names this mode is allowed to use */
  allowedTools: string[];
  /** Specific behavioral guidelines for the LLM */
  guidelines: string;
  /** Suggested temperature for this mode (0.0 - 1.0) */
  temperature: number;
  /** Whether this is a built-in mode (cannot be deleted/modified) */
  isBuiltIn: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}
