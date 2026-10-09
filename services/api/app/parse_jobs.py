"""Turn a worker's free-text or spoken job list into draft jobs with Amazon Bedrock.

Bedrock only extracts fields. It never decides timing, eligibility or safety, and every
draft is shown to the worker for review before it can reach the optimizer.
"""

import json
import os
import uuid

DEFAULT_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

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


def parse(text: str, language: str) -> dict:
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
    jobs = [_clean(j) for j in tool.get("jobs", [])][:20]
    return {"jobs": jobs, "model": model, "language": language,
            "usage": resp.get("usage", {}), "note": "Drafts from Bedrock. Review every field before planning."}
