import io
import json

from app import parse_jobs


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def fake_urlopen(payload, seen):
    def _open(req, timeout):
        seen.update(url=req.full_url, auth=req.headers.get("Authorization"), body=json.loads(req.data), timeout=timeout)
        return FakeResp(json.dumps(payload).encode())
    return _open


JOB = {"title": "छत की वायरिंग", "title_en": "Rooftop wiring", "earnings": 300, "duration_minutes": 60,
       "earliest_start": "06:30", "latest_finish": "10:00", "environment": "direct_sun", "workload": "moderate"}


def test_provider_switches_on_modal_key(monkeypatch):
    monkeypatch.delenv("MODAL_API_KEY", raising=False)
    assert parse_jobs.provider() == "bedrock"
    monkeypatch.setenv("MODAL_API_KEY", "test-key")
    assert parse_jobs.provider() == "modal"


def test_modal_tool_call_reply(monkeypatch):
    monkeypatch.setenv("MODAL_API_KEY", "test-key")
    seen = {}
    payload = {"choices": [{"message": {"tool_calls": [{"function": {"name": "record_jobs",
                                                                     "arguments": json.dumps({"jobs": [JOB]})}}]}}],
               "usage": {"total_tokens": 42}}
    monkeypatch.setattr(parse_jobs.urllib.request, "urlopen", fake_urlopen(payload, seen))
    out = parse_jobs.parse("छत की वायरिंग 300 रुपये", "hi")
    assert seen["url"] == "https://inference.us-west.modal.direct/v1/chat/completions"
    assert seen["auth"] == "Bearer test-key"
    assert seen["body"]["model"] == parse_jobs.DEFAULT_MODAL_MODEL
    assert out["model"].startswith("modal:")
    job = out["jobs"][0]
    assert (job["earnings"], job["environment"], job["confirmed"], job["missing"]) == (300, "direct_sun", False, [])


def test_modal_json_in_content_reply(monkeypatch):
    monkeypatch.setenv("MODAL_API_KEY", "test-key")
    content = "Here you go:\n```json\n" + json.dumps({"jobs": [{**JOB, "workload": None}]}) + "\n```"
    payload = {"choices": [{"message": {"content": content}}]}
    monkeypatch.setattr(parse_jobs.urllib.request, "urlopen", fake_urlopen(payload, {}))
    out = parse_jobs.parse("text", "en")
    assert out["jobs"][0]["missing"] == ["workload"]


def test_modal_reasoning_only_reply(monkeypatch):
    monkeypatch.setenv("MODAL_API_KEY", "test-key")
    payload = {"choices": [{"finish_reason": "stop", "message": {
        "content": "", "reasoning_content": "Thinking... final: " + json.dumps({"jobs": [JOB]})}}]}
    monkeypatch.setattr(parse_jobs.urllib.request, "urlopen", fake_urlopen(payload, {}))
    assert parse_jobs.parse("text", "hi")["jobs"][0]["earnings"] == 300
