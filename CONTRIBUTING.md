# Contributing to FieldSeal

FieldSeal is the US hackathon product. Submit Norwegian esense work to [`Kfagermo/esense`](https://github.com/Kfagermo/esense), not this repository.

## Set up

1. Fork `Kfagermo/fieldseal` and clone your fork.
2. Add the canonical repository as `upstream`:

   ```text
   git remote add upstream https://github.com/Kfagermo/fieldseal.git
   git fetch upstream
   ```

3. Create a branch from the current upstream `main`:

   ```text
   git switch -c feature/short-description upstream/main
   ```

4. Create a virtual environment and install `requirements.txt`.

## Before opening a pull request

Run:

```text
python -m py_compile app.py queue_midnight_demo.py seed_demo_team.py seed_midnight_showcase.py visual_preview.py workflow_smoke.py
node --check static/app.js
node --check static/i18n.js
node --check static/midnight-demo.en.js
node --check static/midnight-demo.locales.js
node --check static/sw.js
node --check static/tooltips.js
python workflow_smoke.py
```

Keep each pull request focused. Explain the worker impact, privacy impact, verification performed, and any remaining risk.

## Non-negotiable boundaries

- Never commit `.env` files, credentials, wallet material, private state, runtime databases, evidence, customer data, or generated contract artifacts.
- Do not send job, customer, worker, evidence, or report data to an external AI service without an explicit product and privacy decision.
- AI may assist planning and documentation but must not claim compliance, approval, certification, competence, authorization, or safety.
- Do not invent laws, standards, permits, inspections, measurements, or source references.
- Keep deterministic rules separate from AI suggestions.
- Midnight receives commitments and minimum proof state, never private report contents.
- Do not run live preprod mutation tests as part of ordinary pull-request validation.
- Preserve the synthetic-only public demonstration boundary.

## Reviews

Pull requests target `Kfagermo/fieldseal:main`. At least one approval is required, stale approvals are dismissed after new changes, and review conversations must be resolved before merge.
