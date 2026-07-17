# LLM Configuration Guide

This guide explains how to connect local LLM engines (like LM Studio or Ollama) or cloud APIs (like Gemini or OpenAI) to the compliance reasoning agent in this project.

## How it works

The `ComplianceAgent` checks environment variables to determine which provider to use. If no variables are defined, or if API keys are missing, it defaults to a **mock/heuristics fallback mode** so that development and testing can proceed offline.

---

## Configuration Settings

You can define these variables in your `.env` file at the root of the project:

### 1. Local LLM (LM Studio / Ollama)
If you want to run a model locally on your machine:
```bash
# Setup
LLM_PROVIDER=local_llm
LLM_API_BASE=http://localhost:1234/v1      # Change this to http://localhost:11434/v1 for Ollama
LLM_MODEL=gemma-2-9b                      # Set to your local model name
```

### 2. Gemini API
To connect directly to Google Gemini models:
```bash
# Setup
LLM_PROVIDER=gemini
LLM_API_KEY=YOUR_GEMINI_API_KEY
LLM_MODEL=gemini-1.5-flash                # Or gemini-1.5-pro
```

### 3. OpenAI API
To connect to OpenAI:
```bash
# Setup
LLM_PROVIDER=openai
LLM_API_KEY=YOUR_OPENAI_API_KEY
LLM_MODEL=gpt-4o                          # Or gpt-4o-mini
```

---

## Default Fallback Mode
If `LLM_PROVIDER` is set to `mock`, or if config variables are left blank, the app will run the rule-based compliance engine locally. This handles:
* **EV Charger queries:** retrieves NEC 625 citations, checklists permit/inspection, and flags missing torque measurements and panel photographs.
* **Breaker panel queries:** retrieves FEL planning and risk management regulations.
* **Commercial lighting queries:** checks for engineering layout calculations.
