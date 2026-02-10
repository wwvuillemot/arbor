import { db, schema, closeConnection } from "./index";
import { eq } from "drizzle-orm";

/**
 * Seed built-in agent modes
 *
 * Creates the 4 built-in agent modes:
 * - assistant: General-purpose helper with all tools
 * - planner: Focus on structure and organization
 * - editor: Content refinement and improvement
 * - researcher: Information gathering and synthesis
 */
export async function seedAgentModes() {
  console.log("🤖 Seeding agent modes...");

  try {
    // Check if agent modes already exist
    const existingModes = await db.select().from(schema.agentModes);

    if (existingModes.length > 0) {
      console.log("ℹ️  Agent modes already exist. Skipping seed.");
      console.log(`   Found ${existingModes.length} existing mode(s):`);
      existingModes.forEach((m) => console.log(`   - ${m.name}`));
      return;
    }

    // Insert built-in agent modes
    await db.insert(schema.agentModes).values([
      {
        name: "assistant",
        displayName: "Assistant",
        description:
          "General-purpose writing assistant. Helps with brainstorming, drafting, editing, organizing, and any other writing tasks.",
        allowedTools: [
          "create_node",
          "update_node",
          "delete_node",
          "move_node",
          "list_nodes",
          "search_nodes",
          "search_semantic",
          "add_tag",
          "remove_tag",
          "list_tags",
          "export_node",
          "export_project",
        ],
        guidelines: `- Be helpful and versatile across all writing tasks
- Balance creativity with accuracy
- Offer suggestions proactively when appropriate
- Use all available tools to assist the user
- Maintain a friendly, collaborative tone`,
        temperature: "0.70",
        isBuiltIn: true,
      },
      {
        name: "planner",
        displayName: "Planner",
        description:
          "Focuses on story structure, project organization, and outlining. Helps plan chapters, scenes, character arcs, and narrative flow.",
        allowedTools: ["create_node", "move_node", "list_nodes", "add_tag"],
        guidelines: `- Focus on high-level structure and organization
- Think about narrative arcs, pacing, and flow
- Suggest hierarchical structures for projects
- Help create outlines and chapter plans
- Prioritize logical reasoning over creative generation
- Ask clarifying questions about story goals and structure`,
        temperature: "0.40",
        isBuiltIn: true,
      },
      {
        name: "editor",
        displayName: "Editor",
        description:
          "Content refinement specialist. Focuses on improving clarity, grammar, style, tone, and readability of existing text.",
        allowedTools: ["update_node", "search_nodes", "list_nodes"],
        guidelines: `- Focus on improving existing text, not generating new content
- Pay attention to clarity, grammar, spelling, and punctuation
- Maintain the author's voice while suggesting improvements
- Provide specific, actionable feedback
- Consider readability, sentence structure, and paragraph flow
- Flag inconsistencies in tone or style`,
        temperature: "0.30",
        isBuiltIn: true,
      },
      {
        name: "researcher",
        displayName: "Researcher",
        description:
          "Information gathering and synthesis. Helps find relevant content within the project, identify patterns, and compile research notes.",
        allowedTools: [
          "search_semantic",
          "search_nodes",
          "list_nodes",
          "list_tags",
        ],
        guidelines: `- Focus on finding and synthesizing information from the project
- Cite specific nodes and content when referencing material
- Identify patterns, themes, and connections across the project
- Provide accurate, well-organized summaries
- Suggest areas that need more research or development
- Prioritize accuracy over creativity`,
        temperature: "0.20",
        isBuiltIn: true,
      },
    ]);

    console.log("✓ Created 4 built-in agent modes");
    console.log("  - assistant (temperature: 0.70)");
    console.log("  - planner (temperature: 0.40)");
    console.log("  - editor (temperature: 0.30)");
    console.log("  - researcher (temperature: 0.20)");
  } catch (error) {
    console.error("❌ Agent mode seeding failed:", error);
    throw error;
  }
}

/**
 * Seed database with example projects
 *
 * Creates a sample hierarchy:
 * - Project A: "My Fantasy Novel"
 *   - Folder: "Characters"
 *     - Note: "Protagonist: Aria"
 *     - Note: "Antagonist: Lord Malachar"
 *   - Folder: "World Building"
 *     - Note: "Magic System"
 * - Project B: "D&D Campaign: Lost Mines"
 *   - Folder: "Session Notes"
 *     - Note: "Session 1: The Goblin Ambush"
 */

export async function seed(closeConnectionAfter = false) {
  console.log("🌱 Seeding database...");

  try {
    // Seed agent modes first
    await seedAgentModes();

    // Check if data already exists
    const existingProjects = await db
      .select()
      .from(schema.nodes)
      .where(eq(schema.nodes.type, "project"));

    if (existingProjects.length > 0) {
      console.log("ℹ️  Database already has projects. Skipping seed.");
      console.log(`   Found ${existingProjects.length} existing project(s):`);
      existingProjects.forEach((p) => console.log(`   - ${p.name}`));
      return;
    }

    // Create Project A: My Fantasy Novel
    const [projectA] = await db
      .insert(schema.nodes)
      .values({
        type: "project",
        name: "My Fantasy Novel",
        position: 0,
        createdBy: "user:system",
        updatedBy: "user:system",
        metadata: {
          description:
            "An epic fantasy story about a young mage discovering her powers",
          status: "active",
          created_date: "2024-01-15",
        },
      })
      .returning();
    console.log("✓ Created project:", projectA.name);

    // Create folders in Project A
    const [charactersFolder] = await db
      .insert(schema.nodes)
      .values({
        type: "folder",
        name: "Characters",
        parentId: projectA.id,
        position: 0,
        createdBy: "user:system",
        updatedBy: "user:system",
        metadata: { color: "#3b82f6", icon: "users" },
      })
      .returning();
    console.log("  ✓ Created folder:", charactersFolder.name);

    const [worldBuildingFolder] = await db
      .insert(schema.nodes)
      .values({
        type: "folder",
        name: "World Building",
        parentId: projectA.id,
        position: 10,
        createdBy: "user:system",
        updatedBy: "user:system",
        metadata: { color: "#10b981", icon: "globe" },
      })
      .returning();
    console.log("  ✓ Created folder:", worldBuildingFolder.name);

    // Create notes in Characters folder
    await db.insert(schema.nodes).values([
      {
        type: "note",
        name: "Protagonist: Aria",
        parentId: charactersFolder.id,
        position: 0,
        createdBy: "user:system",
        updatedBy: "user:system",
        content: {
          text: `# Aria Stormweaver

**Age**: 17
**Role**: Protagonist
**Powers**: Lightning magic, weather manipulation

## Background
Aria grew up in a small coastal village, unaware of her magical heritage...

## Character Arc
- Discovers her powers during a storm
- Learns to control her abilities
- Confronts her destiny as the last Stormweaver
`,
        },
        metadata: {
          tags: ["character", "protagonist", "magic"],
          word_count: 45,
          reading_time: 1,
        },
      },
      {
        type: "note",
        name: "Antagonist: Lord Malachar",
        parentId: charactersFolder.id,
        position: 10,
        createdBy: "user:system",
        updatedBy: "user:system",
        content: {
          text: `# Lord Malachar

**Age**: Unknown (appears 40s)
**Role**: Antagonist
**Powers**: Dark magic, necromancy

## Background
Once a respected court mage, Malachar turned to forbidden magic after losing his family...

## Motivation
Seeks to resurrect his loved ones, regardless of the cost to the world.
`,
        },
        metadata: {
          tags: ["character", "antagonist", "dark-magic"],
          word_count: 38,
          reading_time: 1,
        },
      },
    ]);
    console.log("  ✓ Created 2 character notes");

    // Create note in World Building folder
    await db.insert(schema.nodes).values({
      type: "note",
      name: "Magic System",
      parentId: worldBuildingFolder.id,
      position: 0,
      createdBy: "user:system",
      updatedBy: "user:system",
      content: {
        text: `# Magic System

## Types of Magic
1. **Elemental Magic**: Fire, Water, Earth, Air, Lightning
2. **Life Magic**: Healing, growth, enhancement
3. **Dark Magic**: Necromancy, curses, forbidden arts

## Rules
- Magic requires innate talent (cannot be learned by everyone)
- Overuse causes physical exhaustion
- Dark magic corrupts the user over time
- Each mage typically specializes in one element
`,
      },
      metadata: {
        tags: ["worldbuilding", "magic", "rules"],
        word_count: 62,
        reading_time: 1,
      },
    });
    console.log("  ✓ Created world building note");

    // Create Project B: D&D Campaign
    const [projectB] = await db
      .insert(schema.nodes)
      .values({
        type: "project",
        name: "D&D Campaign: Lost Mines of Phandelver",
        position: 10,
        createdBy: "user:system",
        updatedBy: "user:system",
        metadata: {
          description: "A classic D&D 5e adventure with custom modifications",
          status: "active",
          created_date: "2024-02-01",
          system: "D&D 5e",
        },
      })
      .returning();
    console.log("✓ Created project:", projectB.name);

    // Create Session Notes folder
    const [sessionNotesFolder] = await db
      .insert(schema.nodes)
      .values({
        type: "folder",
        name: "Session Notes",
        parentId: projectB.id,
        position: 0,
        createdBy: "user:system",
        updatedBy: "user:system",
        metadata: { color: "#f59e0b", icon: "book" },
      })
      .returning();
    console.log("  ✓ Created folder:", sessionNotesFolder.name);

    // Create session note
    await db.insert(schema.nodes).values({
      type: "note",
      name: "Session 1: The Goblin Ambush",
      parentId: sessionNotesFolder.id,
      position: 0,
      createdBy: "user:system",
      updatedBy: "user:system",
      content: {
        text: `# Session 1: The Goblin Ambush
**Date**: February 3, 2024
**Players**: Alice, Bob, Charlie, Diana

## Summary
The party was hired to escort a wagon to Phandalin. On the road, they encountered a goblin ambush...

## Key Events
- Met Sildar Hallwinter (captured by goblins)
- Discovered Gundren Rockseeker is missing
- Tracked goblins to Cragmaw Hideout
- Rescued Sildar from the goblin chief

## Loot
- 50 gold pieces
- Potion of Healing x2
- Goblin boss's magic dagger (+1)

## Next Session
Head to Phandalin and investigate Gundren's disappearance
`,
      },
      metadata: {
        tags: ["session-notes", "combat", "rescue"],
        word_count: 95,
        reading_time: 2,
        session_number: 1,
        date: "2024-02-03",
      },
    });
    console.log("  ✓ Created session note");

    console.log("\n✅ Seeding complete!");
    console.log("\nCreated:");
    console.log("  - 2 projects");
    console.log("  - 3 folders");
    console.log("  - 4 notes");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    if (closeConnectionAfter) {
      await closeConnection();
    }
  }
}

// Run seed when called directly from command line
if (require.main === module) {
  seed(true);
}
