from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


EvidenceClassification = Literal["FACT", "INFERENCE", "HYPOTHESIS"]


class Evidence(BaseModel):
    """A single piece of evidence collected during an investigation.

    The classification distinguishes verified facts from the agent's
    inference and educated guesses so speculation is never presented as fact.
    """

    sourceType: str
    sourceKey: str
    title: str
    detail: str | None = None
    classification: EvidenceClassification = "FACT"
    sourceUrl: str | None = None
    payload: dict[str, Any] | None = None


class ToolCallRecord(BaseModel):
    """Audit record of a single AI tool invocation."""

    toolName: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | None = None
    status: str = "success"
    durationMs: int | None = None


class InvestigationResult(BaseModel):
    """Structured output produced by the AI investigator.

    This is the validated contract the Node backend persists as an
    Investigation row plus its evidence / tool-call children.
    """

    summary: str
    rootCause: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[Evidence] = Field(default_factory=list)
    affectedServices: list[str] = Field(default_factory=list)
    relatedDeployment: str | None = None
    relatedCommit: str | None = None
    changedFiles: list[str] = Field(default_factory=list)
    suggestedFix: str | None = None
    risk: str | None = None
    verificationPlan: str | None = None
    toolCalls: list[ToolCallRecord] = Field(default_factory=list)

    @field_validator("summary", "rootCause")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("must not be blank")
        return value.strip()