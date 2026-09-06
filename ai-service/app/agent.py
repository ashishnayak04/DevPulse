"""Investigation agent: a tool-calling loop that gathers incident context from
the Node API and produces a structured InvestigationResult.

Two execution modes:

* **LLM mode** — when ``AI_API_KEY`` and ``AI_BASE_URL`` are configured an
  OpenAI-compatible model drives a tool-calling loop under a token budget.
* **Mock mode** — deterministic chain-of-thought fallback for local/dev boxes
  with no LLM credentials. It still calls the real internal context tools so
  the evidence + tool-call audit trail is realistic end to end.
"""

from __future__ import annotations

import json
import time
from typing import Any

from . import config
from . import node_client
from .llm import TokenBudget, ai_configured, chat_completion, estimate_tokens
from .schemas import Evidence, InvestigationResult, ToolCallRecord


class InvestigationBudgetError(Exception):
    """Raised when the token budget or tool-call cap is hit mid-investigation."""


def _params(required: list[str], properties: dict[str, Any]) -> dict[str, Any]:
    return {"type": "object", "required": required, "properties": properties}


IDENTIFIER = {"type": "string", "description": "Incident UUID. Omit or pass '' to use the current incident."}

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_incident",
            "description": "Fetch incident summary: endpoint identity, status window, down ping count and any existing investigation record.",
            "parameters": _params(["incidentId"], {"incidentId": IDENTIFIER}),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ping_logs",
            "description": "Fetch raw monitor ping logs (status code, response time, up/down) around the incident window. Use start/end ISO timestamps to zoom.",
            "parameters": _params(["incidentId"], {
                "incidentId": IDENTIFIER,
                "start": {"type": "string", "description": "ISO timestamp window start"},
                "end": {"type": "string", "description": "ISO timestamp window end"},
                "limit": {"type": "integer", "description": "Max rows (default 300)"},
            }),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_alerts",
            "description": "Fetch alert events (DOWN / UP / SSL_EXPIRY) near the incident.",
            "parameters": _params(["incidentId"], {"incidentId": IDENTIFIER}),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_timeline",
            "description": "Fetch the pre-built incident timeline: typed events, failure clustering, error rate and deployment correlation with likelyDeployment.",
            "parameters": _params(["incidentId"], {"incidentId": IDENTIFIER}),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_deployment",
            "description": "Fetch a single deployment with its linked commits and repository.",
            "parameters": _params(["incidentId", "deploymentId"], {"incidentId": IDENTIFIER, "deploymentId": {"type": "string"}}),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_git_commit",
            "description": "Fetch basic metadata for a commit in a repository owned by the incident's user.",
            "parameters": _params(["incidentId", "repositoryId", "sha"], {
                "incidentId": IDENTIFIER,
                "repositoryId": {"type": "string"},
                "sha": {"type": "string"},
            }),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_git_diff",
            "description": "Fetch a commit including file changes (additions/deletions/patch) and deployments that included it.",
            "parameters": _params(["incidentId", "repositoryId", "sha"], {
                "incidentId": IDENTIFIER,
                "repositoryId": {"type": "string"},
                "sha": {"type": "string"},
            }),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_changed_files",
            "description": "List files changed across a range of commits leading up to a sha (or the latest 10).",
            "parameters": _params(["incidentId", "repositoryId"], {
                "incidentId": IDENTIFIER,
                "repositoryId": {"type": "string"},
                "sha": {"type": "string", "description": "Target commit sha (default latest)"},
                "baseSha": {"type": "string", "description": "Optional range base sha"},
            }),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "inspect_source_file",
            "description": "Read a source file from a repository at a ref (sha or default branch). Content is truncated at 20k chars.",
            "parameters": _params(["incidentId", "repositoryId", "path"], {
                "incidentId": IDENTIFIER,
                "repositoryId": {"type": "string"},
                "path": {"type": "string", "description": "Repo-relative file path"},
                "sha": {"type": "string", "description": "Optional ref to read at"},
            }),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_similar_incidents",
            "description": "Full-text search for historically similar incidents (same endpoint or matching text).",
            "parameters": _params(["incidentId"], {
                "incidentId": IDENTIFIER,
                "limit": {"type": "integer"},
            }),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_historical_resolution",
            "description": "Look up the most recent completed investigation with a fix for a similar incident.",
            "parameters": _params(["incidentId"], {"incidentId": IDENTIFIER}),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_recent_investigations",
            "description": "List recent completed investigations across all endpoints for pattern context.",
            "parameters": _params([], {"count": {"type": "integer"}}),
        },
    },
]

EVALUATION_NOTE = (
    "Evaluation notes: link concrete facts to FACT evidence, reasoned-cause chains to INFERENCE, "
    "and educated guesses to HYPOTHESIS. Never mark a guess as FACT."
)

SYSTEM_PROMPT = f"""You are DevPulse's AI incident investigator. You produce a structured postmortem for a
monitoring incident by calling tools to gather facts, then reply with ONLY a JSON object that matches
the InvestigationResult schema (summary, rootCause, confidence 0..1, evidence[], affectedServices[],
relatedDeployment/relatedCommit (UUIDs when known), changedFiles[], suggestedFix, risk in
low|medium|high|critical, verificationPlan, toolCalls[] mirroring every call you made).

Investigate methodically:
1. Understand the incident (get_incident, get_timeline).
2. Inspect the failure signal (get_ping_logs, get_alerts).
3. Check deployment correlation from the timeline's likelyDeployment; if present inspect it (get_deployment)
   and the commits/files it shipped (get_git_diff, get_changed_files). Inspect the most suspicious file
   (inspect_source_file) when the change looks deploy-related.
4. Compare with history (search_similar_incidents, get_historical_resolution, list_recent_investigations).
5. Synthesize the report. If a deployment change is implicated, prefer a revert-style fix.
{EVALUATION_NOTE}"""


async def run_investigation(incident_id: str, endpoint_id: str | None = None) -> InvestigationResult:
    if not ai_configured():
        return await _mock_investigation(incident_id, endpoint_id)

    records: list[ToolCallRecord] = []
    budget = TokenBudget(config.AI_BUDGET_TOKENS, reserve=config.AI_EST_OUTPUT_TOKENS)

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": "Investigate the current incident.",
        },
    ]
    _attach_identity_message(messages, incident_id)

    used_calls = 0
    final_text = None

    while True:
        if used_calls >= config.AI_MAX_TOOL_CALLS:
            raise InvestigationBudgetError(
                f"tool-call cap reached ({config.AI_MAX_TOOL_CALLS})"
            )
        if budget.exhausted():
            raise InvestigationBudgetError(
                f"token budget reached ({budget.spent}/{budget.limit})"
            )

        try:
            reply = await chat_completion(messages, tools=TOOL_SPECS)
        except Exception as exc:  # noqa: BLE001
            raise InvestigationBudgetError(f"LLM failure: {exc}") from exc

        budget.add(reply["usage"]["total_tokens"])
        message = reply["message"]
        tool_calls = message.get("tool_calls") or []

        if not tool_calls:
            final_text = message.get("content")
            break

        for call in tool_calls:
            fn = call.get("function", {}) or {}
            name = fn.get("name", "")
            raw_args = fn.get("arguments", "{}")
            try:
                arguments = json.loads(raw_args) if raw_args else {}
            except json.JSONDecodeError:
                arguments = {}

            used_calls += 1
            record, piece = await _execute_tool(
                name, arguments, add_identity=call.get("id") or used_calls,
            )
            records.append(record)
            budget.add(estimate_tokens(json.dumps(piece.get("result", {}))))

            messages.append(
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [call],
                }
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.get("id"),
                    "content": json.dumps(piece.get("result", {})),
                }
            )

    if not final_text:
        raise InvestigationBudgetError("LLM returned no final answer")

    return _parse_result(final_text, records)


# ─── Tool execution ─────────────────────────────────────────────────


def _attach_identity_message(messages: list[dict], incident_id: str) -> None:
    messages.append({"role": "user", "content": f"[context] incidentId={incident_id}"})


async def _execute_tool(name: str, arguments: dict, add_identity: Any) -> tuple[ToolCallRecord, dict]:
    started = time.perf_counter()
    status = "success"
    result = None
    try:
        result = await node_client.call_tool(name, arguments)
    except node_client.ToolError as exc:
        status = "error"
        result = {"error": exc.message, "code": exc.code}
    except Exception as exc:  # noqa: BLE001
        status = "error"
        result = {"error": str(exc)}
    finally:
        duration_ms = int((time.perf_counter() - started) * 1000)

    record = ToolCallRecord(
        toolName=name,
        arguments=arguments,
        result=result,
        status=status,
        durationMs=duration_ms,
    )
    return record, {"result": result}


def _parse_result(text: str, records: list[ToolCallRecord]) -> InvestigationResult:
    stripped = text.strip()
    if not stripped.startswith("{"):
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise InvestigationBudgetError("LLM final answer is not valid JSON")
        stripped = stripped[start : end + 1]

    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError as exc:
        raise InvestigationBudgetError(f"LLM final answer is not valid JSON: {exc}") from exc

    if payload.get("toolCalls") is None:
        payload["toolCalls"] = [r.model_dump() for r in records]

    return InvestigationResult(**payload)


# ─── Mock mode (no LLM credentials) ───────────────────────────────


async def _mock_investigation(incident_id: str, endpoint_id: str | None) -> InvestigationResult:
    records: list[ToolCallRecord] = []
    evidence: list[Evidence] = []

    async def tool(name: str, arguments: dict) -> dict:
        record, _ = await _execute_tool(name, arguments, add_identity=name)
        records.append(record)
        if record.result is None or "error" in record.result:
            return None  # type: ignore[return-value]
        return record.result  # type: ignore[return-value]

    incident_box = await tool("get_incident", {"incidentId": incident_id})
    timeline = await tool("get_timeline", {"incidentId": incident_id})
    alerts = await tool("get_alerts", {"incidentId": incident_id}) or {"items": []}
    similar = await tool("search_similar_incidents", {"incidentId": incident_id, "limit": 5}) or {"items": []}
    historical = await tool("get_historical_resolution", {"incidentId": incident_id}) or {"resolution": None}

    incident = (incident_box or {}).get("incident") or {}
    endpoint = incident.get("endpoint") or {}
    endpoint_name = endpoint.get("name") or "endpoint"
    endpoint_id = endpoint.get("id", endpoint_id)

    correlation = (timeline or {}).get("correlation") or {}
    events = (timeline or {}).get("events") or []
    deployment_events = [e for e in events if e.get("type") == "deployment"]
    likely = correlation.get("likelyDeployment") or {}
    samples = correlation.get("samples") or {}

    evidence.append(
        Evidence(
            sourceType="incident",
            sourceKey=f"incident:{incident_id}",
            title=f"Incident started at {incident.get('startedAt')} on {endpoint_name}",
            detail=(
                f"Endpoint {endpoint.get('url')} recorded {samples.get('down', 0)} failing samples "
                f"({(samples.get('errorRate') or 0) * 100:.1f}% error rate) in the window."
            ),
            classification="FACT",
        )
    )

    if alerts.get("items"):
        first = alerts["items"][0]
        evidence.append(
            Evidence(
                sourceType="alert",
                sourceKey=f"alert:{first.get('id')}",
                title=f"{first.get('type')} alert at {first.get('sentAt')}",
                detail=f"One or more alerts fired around the estimated failure window.",
                classification="FACT",
                payload={"count": len(alerts["items"]), "types": [a.get("type") for a in alerts["items"]]},
            )
        )

    related_deployment = None
    related_commit = None
    changed_files: list[str] = []
    if likely.get("deploymentId"):
        related_deployment = likely["deploymentId"]
        past_cause = (
            "a failed deployment"
            if likely.get("relation") == "failed_deployment"
            else "a deployment immediately preceding the first failure"
        )
        evidence.append(
            Evidence(
                sourceType="correlation",
                sourceKey=f"deployment:{related_deployment}",
                title=f"Deployment likely correlated with failure",
                detail=(
                    f"{likely.get('repository', 'repository')}/{likely['environment']} deployed "
                    f"{likely.get('commitSha', 'unknown sha')} {likely.get('gapSeconds', 0)}s before the first failure "
                    f"({past_cause})."
                ),
                classification="INFERENCE",
                payload={"gapSeconds": likely.get("gapSeconds"), "relation": likely.get("relation")},
            )
        )
        related_commit = likely.get("commitSha")
        deployment_detail = await tool("get_deployment", {"incidentId": incident_id, "deploymentId": related_deployment})
        repo = (deployment_detail or {}).get("repository") or {}
        commit_sha = (deployment_detail or {}).get("commitSha") or related_commit
        if related_commit is None:
            related_commit = commit_sha
        if repo.get("id") and commit_sha:
            diff = await tool(
                "get_git_diff",
                {"incidentId": incident_id, "repositoryId": repo["id"], "sha": commit_sha},
            )
            if diff and diff.get("files"):
                changed_files = [f.get("filename") for f in diff["files"]]
    elif deployment_events:
        newest = deployment_events[-1]
        related_deployment = newest.get("deploymentId")
        related_commit = newest.get("commitSha")
        evidence.append(
            Evidence(
                sourceType="correlation",
                sourceKey=f"deployment:{related_deployment}",
                title=f"Deployment preceded the failure window",
                detail=f"{newest.get('title')} shipped before the incident window.",
                classification="INFERENCE",
            )
        )

    inferred_lines: list[str] = []
    if related_deployment:
        inferred_lines.append(f"Deployment {related_deployment} shipped immediately before the failure signal.")
    if samples.get("errorRate") is not None and samples.get("errorRate", 0) < 0.5:
        inferred_lines.append("The failure signal was partial (sub-50% error rate), consistent with a rollout or region issue.")
    root_cause = (
        "Deployment-triggered regression:\n" + " ".join(inferred_lines)
        if inferred_lines
        else "Sustained endpoint failure with no correlated deployment; likely an environment or upstream outage."
    )

    if similar.get("items"):
        top = similar["items"][0]
        evidence.append(
            Evidence(
                sourceType="similarity",
                sourceKey=f"similar:{top.get('id')}",
                title=f"Similar past incident: {top.get('endpoint', {}).get('name') or 'unknown endpoint'}",
                detail=(
                    f"Relevance score {top.get('score', 0):.3f}, "
                    f"{top.get('timeGapMinutes', 0)}m from this incident: {top.get('summary') or 'no summary'}."
                ),
                classification="HYPOTHESIS",
                payload={"score": top.get("score"), "rootCause": top.get("rootCause")},
            )
        )

    suggested_fix = None
    verification = None
    resolution = historical.get("resolution")
    if resolution:
        suggested_fix = resolution.get("suggestedFix")
        verification = resolution.get("verificationPlan") or None
        evidence.append(
            Evidence(
                sourceType="similarity",
                sourceKey=f"resolution:{resolution.get('id')}",
                title=f"Historical fix: {resolution.get('summary', 'previous incident')}",
                detail=f"Reusing the fix that resolved a similar past incident {resolution.get('relatedCommit') or ''}",
                classification="HYPOTHESIS",
            )
        )

    if not suggested_fix:
        if related_deployment:
            suggested_fix = (
                f"Revert or roll back deployment {related_deployment}"
                f"{(' (' + maybe_sha(related_commit) + ')') if related_commit else ''} "
                f"and monitor {endpoint_name} for the next 15 minutes to confirm recovery."
            )
        else:
            suggested_fix = (
                f"Resolve {endpoint_name} directly (restart, failover or provider intervention), "
                f"then verify with a manual probe. If it recovers, keep monitoring for recurrence."
            )

    summary = (
        f"{endpoint_name} experienced a failure window starting {incident.get('startedAt')} "
        f"({samples.get('down', '?')} failing samples). "
    )
    if related_deployment:
        summary += (
            "The timeline shows a deployment immediately before the first failure, "
            "making a release regression the leading hypothesis. "
        )
    else:
        summary += "No correlated deployment was found; investigate the environment/upstream path. "
    if similar.get("items"):
        summary += f"{len(similar['items'])} historical incident(s) were similar."

    verification = verification or (
        "1) Confirm deployment linkage in the timeline. 2) Poke the endpoint and watch ping logs via the probe. "
        "3) If a change is implicated, revert it and re-run this investigation to confirm the root cause clears."
    )

    return InvestigationResult(
        summary=summary,
        rootCause=root_cause,
        confidence=0.55,
        evidence=evidence,
        affectedServices=[endpoint_name],
        relatedDeployment=related_deployment,
        relatedCommit=related_commit,
        changedFiles=changed_files,
        suggestedFix=suggested_fix,
        risk="medium",
        verificationPlan=verification,
        toolCalls=records,
    )


def maybe_sha(value: Any) -> str:
    return str(value)[:10] if value else ""