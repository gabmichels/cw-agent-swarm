# @crowd-wisdom/chloe

Chloe is an autonomous agent assistant with marketing expertise.

## TypeScript Configuration

This package uses TypeScript with some compromises for third-party libraries:

- `// @ts-ignore` comments are used for specific imports where type definitions are not fully compatible
- The code is designed to build correctly despite type issues
- We have a separate `tsconfig.build.json` for building with relaxed checks
- Type declarations are disabled in the tsup configuration to avoid build errors

## Dependencies

The agent requires several external dependencies:

1. **LangChain packages**:
   - `@langchain/core` (v0.3.39 or higher)
   - `@langchain/openai` (v0.5.6 or higher)
   - `@langchain/langgraph` (v0.0.24 or higher)
   - `langchain`

2. **Discord.js**:
   - Required for notifications via Discord
   - Installed at the workspace level to ensure proper availability

3. **Cron and other utilities**:
   - `cron` - for scheduled tasks
   - `dotenv` - for environment variables
   - `zod` - for validation

## Known TypeScript Issues

1. `@langchain/langgraph` typings are not fully compatible with our usage
2. Several imports need to be fixed with ambient declarations:
   - See the ambient-modules.d.ts file in the root types folder for declarations
   - These declarations help TypeScript recognize external modules

## Development

```bash
# Install dependencies
pnpm install

# Build the package (ignores TypeScript errors)
pnpm build

# Run type checking
pnpm check-types

# Start the agent
pnpm start
```

## Environment Variables

For Discord notifications, create a `.env` file:

```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_channel_id
``` 