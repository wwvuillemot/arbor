# Arbor API Client

This directory contains the typed API client for Arbor, generated from OpenAPI specifications using Orval.

## Overview

The API client is automatically generated from the backend's OpenAPI spec (`server/openapi.yaml`) to ensure type-safe communication between the Next.js frontend and the backend API.

## Usage

### Generating the Client

```bash
# Generate once
make api-generate

# Watch mode (regenerates on OpenAPI spec changes)
make api-watch
```

### Using the Generated Client

```typescript
import { useListNodes, useCreateNode } from "@/lib/api/generated/nodes";

function MyComponent() {
  // Query with React Query hooks
  const { data: nodes, isLoading } = useListNodes({
    parentId: "some-uuid",
  });

  // Mutation
  const createNode = useCreateNode();

  const handleCreate = async () => {
    await createNode.mutateAsync({
      data: {
        type: "note",
        title: "My Note",
        content: "Note content",
      },
    });
  };

  // ...
}
```

## Directory Structure

```
src/lib/api/
├── README.md           # This file
├── client.ts           # Custom Axios instance (used by Orval)
└── generated/          # Auto-generated (DO NOT EDIT)
    ├── models/         # TypeScript types
    └── *.ts            # API hooks by tag
```

## Configuration

The Orval configuration is in `orval.config.ts` at the project root.

Key settings:

- **Input**: `server/openapi.yaml`
- **Output**: `src/lib/api/generated`
- **Client**: React Query hooks
- **Mutator**: Custom Axios instance from `client.ts`

## Best Practices

1. **Never edit generated files** - They will be overwritten
2. **Update OpenAPI spec first** - Then regenerate the client
3. **Use React Query hooks** - They provide caching, loading states, etc.
4. **Handle errors** - Use the `handleApiError` utility from `client.ts`

## Customization

To customize the API client behavior, edit:

- `client.ts` - Axios instance configuration
- `orval.config.ts` - Orval generation settings

## Integration with Backend

The backend should expose its OpenAPI spec at `server/openapi.yaml`. This spec should be:

- **Complete** - All endpoints documented
- **Accurate** - Types match actual responses
- **Versioned** - Updated with API changes

## React Query Setup

Make sure to wrap your app with `QueryClientProvider`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```
