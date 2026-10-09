"""Turn a worker's free-text or spoken job list into draft jobs with a language model.

Uses a Modal-hosted model when MODAL_API_KEY is set, otherwise Amazon Bedrock.
The model only extracts fields. It never decides timing, eligibility or safety, and every
draft is shown to the worker for review before it can reach the optimizer.
"""

import json
import os
import urllib.request
import uuid

DEFAULT_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
DEFAULT_MODAL_URL = "https://inference.us-west.modal.direct/v1"
DEFAULT_MODAL_MODEL = "jhahimanshu653--ep-glm-5-3-server.us-west.modal.direct"
MODAL_TIMEOUT_S = 25

JOB_SCHEMA = {
    "type": "object",
    "properties": {
        "jobs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Short job title in the worker's language"},
                    "title_en": {"type": "string", "description": "Same title in English"},
                    "earnings": {"type": ["integer", "null"], "description": "Payment in INR, null if not said"},
                    "duration_minutes": {"type": ["integer", "null"]},
                    "earliest_start": {"type": ["string", "null"], "description": "HH:MM 24h"},
                    "latest_finish": {"type": ["string", "null"], "description": "HH:MM 24h"},
                    "preferred_start": {"type": ["string", "null"], "description": "Booked time HH:MM if one was said"},
                    "environment": {"type": ["string", "null"], "enum": ["indoor_cooled", "indoor_uncooled", "shaded_outdoor", "direct_sun", None]},
                    "workload": {"type": ["string", "null"], "enum": ["light", "moderate", "heavy", None]},
                    "location_zone": {"type": ["string", "null"]},
                    "travel_minutes": {"type": ["integer", "null"]},
                    "flexible": {"type": ["boolean", "null"], "description": "false only if the worker says the time cannot move"},
                },
                "required": ["title", "earnings", "duration_minutes", "environment", "workload"],
            },
        }
    },
    "required": ["jobs"],
}

SYSTEM = (
    "You extract a list of paid jobs from what an Indian electrician, plumber or handyman says, in Hindi, "
    "Hinglish or English. Only record facts the worker stated or that follow directly (rooftop means direct_sun; "
    "inside an AC room means indoor_cooled; 'subah 10 baje tak' means latest_finish 10:00). Use null for anything "
    "not stated. Never invent a job, an amount or a time. Never give safety advice. Call the record_jobs tool once."
)

REQUIRED = ["earnings", "duration_minutes", "earliest_start", "latest_finish", "environment", "workload"]


def _round15(v):
    return None if v is None else max(15, int(round(v / 15) * 15))


def _clean(raw: dict) -> dict:
    job = {
        "id": f"job-{uuid.uuid4().hex[:8]}",
        "title": (raw.get("title") or "Job")[:100],
        "title_en": (raw.get("title_en") or raw.get("title") or "")[:100],
        "earnings": raw.get("earnings"),
        "duration_minutes": _round15(raw.get("duration_minutes")),
        "earliest_start": raw.get("earliest_start"),
        "latest_finish": raw.get("latest_finish"),
        "preferred_start": raw.get("preferred_start"),
        "environment": raw.get("environment"),
        "workload": raw.get("workload"),
        "location_zone": raw.get("location_zone") or "",
        "travel_minutes": _round15(raw.get("travel_minutes")) if raw.get("travel_minutes") else 0,
        "flexible": raw.get("flexible") if raw.get("flexible") is not None else True,
        "confirmed": False,
    }
    job["missing"] = [k for k in REQUIRED if job.get(k) in (None, "")]
    return job


def _extract_json(content: str) -> dict:
    """Pull the first JSON object out of a model reply that may wrap it in prose or a code fence."""
    i, j = content.find('{"jobs"'), content.rfind("}")
    if i < 0:
        i = content.find("{")
    if i < 0 or j <= i:
        raise ValueError("model reply had no JSON object")
    data = json.loads(content[i : j + 1])
    if not isinstance(data, dict) or "jobs" not in data:
        raise ValueError("model reply JSON had no jobs")
    return data


def _modal(text: str) -> tuple[dict, str, dict]:
    """Modal-hosted model through its OpenAI-compatible chat completions API."""
    key = os.environ["MODAL_API_KEY"]
    base = os.environ.get("MODAL_BASE_URL", DEFAULT_MODAL_URL).rstrip("/")
    model = os.environ.get("MODAL_MODEL", DEFAULT_MODAL_MODEL)
    body = {
        "model": model,
        "temperature": 0,
        "max_tokens": 6000,
        "messages": [
            {"role": "system", "content": SYSTEM + " Reply with only a JSON object matching the record_jobs schema."},
            {"role": "user", "content": text},
        ],
        "tools": [{"type": "function", "function": {"name": "record_jobs", "description": "Record the extracted jobs",
                                                    "parameters": JOB_SCHEMA}}],
        "tool_choice": {"type": "function", "function": {"name": "record_jobs"}},
    }
    req = urllib.request.Request(f"{base}/chat/completions", data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json", "authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=MODAL_TIMEOUT_S) as r:
        resp = json.loads(r.read())
    choice = resp["choices"][0]
    msg = choice["message"]
    calls = msg.get("tool_calls") or []
    if calls:
        args = calls[0]["function"]["arguments"]
        data = json.loads(args) if isinstance(args, str) else args
        return data, f"modal:{model}", resp.get("usage", {})
    # Reasoning models may put the answer after their thinking, or only in the reasoning field.
    for text_out in (msg.get("content"), msg.get("reasoning_content"), msg.get("reasoning")):
        try:
            return _extract_json(text_out or ""), f"modal:{model}", resp.get("usage", {})
        except ValueError:
            continue
    raise ValueError(
        f"no jobs JSON in reply (finish_reason={choice.get('finish_reason')}, "
        f"content_chars={len(msg.get('content') or '')}, "
        f"reasoning_chars={len(msg.get('reasoning_content') or msg.get('reasoning') or '')}, "
        f"usage={resp.get('usage')})"
    )


def provider() -> str:
    return "modal" if os.environ.get("MODAL_API_KEY") else "bedrock"


def parse(text: str, language: str) -> dict:
    data, model, usage = _modal(text) if provider() == "modal" else _bedrock(text)
    jobs = [_clean(j) for j in data.get("jobs", []) if isinstance(j, dict)][:20]
    return {"jobs": jobs, "model": model, "language": language, "usage": usage,
            "note": "Drafts from a language model. Review every field before planning."}


def _bedrock(text: str) -> tuple[dict, str, dict]:
    import boto3

    model = os.environ.get("BEDROCK_MODEL_ID", DEFAULT_MODEL)
    client = boto3.client("bedrock-runtime", region_name=os.environ.get("BEDROCK_REGION", os.environ.get("AWS_REGION", "us-east-1")))
    resp = client.converse(
        modelId=model,
        system=[{"text": SYSTEM}],
        messages=[{"role": "user", "content": [{"text": text}]}],
        toolConfig={
            "tools": [{"toolSpec": {"name": "record_jobs", "description": "Record the extracted jobs",
                                    "inputSchema": {"json": JOB_SCHEMA}}}],
            "toolChoice": {"tool": {"name": "record_jobs"}},
        },
        inferenceConfig={"maxTokens": 1500, "temperature": 0},
    )
    blocks = resp["output"]["message"]["content"]
    tool = next((b["toolUse"]["input"] for b in blocks if "toolUse" in b), None)
    if tool is None:
        raise ValueError("model did not return structured jobs")
    if isinstance(tool, str):
        tool = json.loads(tool)
    return tool, f"bedrock:{model}", resp.get("usage", {})
