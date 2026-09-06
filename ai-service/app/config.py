import os

AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))
AI_SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN", "")

# LLM provider config (used from Phase 4 onward).
AI_PROVIDER = os.getenv("AI_PROVIDER", "openai-compatible")
AI_BASE_URL = os.getenv("AI_BASE_URL", "")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
AI_DEEP_MODEL = os.getenv("AI_DEEP_MODEL", "gpt-4o")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MAX_TOOL_CALLS = int(os.getenv("AI_MAX_TOOL_CALLS", "25"))
AI_TIMEOUT_MS = int(os.getenv("AI_TIMEOUT_MS", "120000"))
AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.2"))
AI_BUDGET_TOKENS = int(os.getenv("AI_BUDGET_TOKENS", "8000"))
AI_EST_OUTPUT_TOKENS = int(os.getenv("AI_EST_OUTPUT_TOKENS", "1500"))

# Node API base URL used by AI tools to fetch scoped investigation context.
NODE_API_URL = os.getenv("NODE_API_URL", "http://localhost:4000")