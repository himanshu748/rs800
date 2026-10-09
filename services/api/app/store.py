import json
import logging
import os
import time
from decimal import Decimal

log = logging.getLogger("rs800.store")
TTL_S = 7 * 24 * 3600


class PlanStore:
    """DynamoDB single table (pk/sk). Falls back to process memory when PLANS_TABLE is unset."""

    def __init__(self):
        self.table_name = os.environ.get("PLANS_TABLE")
        self._mem: dict[str, dict] = {}
        self._table = None
        if self.table_name:
            import boto3
            self._table = boto3.resource("dynamodb").Table(self.table_name)
        else:
            log.warning("PLANS_TABLE not set: plans are kept in memory only")

    @property
    def backend(self) -> str:
        return f"dynamodb:{self.table_name}" if self._table else "memory"

    def put(self, plan_id: str, record: dict) -> None:
        if not self._table:
            self._mem[plan_id] = record
            return
        item = json.loads(json.dumps(record), parse_float=Decimal)
        item.update({"pk": f"PLAN#{plan_id}", "sk": "PLAN", "expiresAt": int(time.time()) + TTL_S})
        self._table.put_item(Item=item)

    def get(self, plan_id: str) -> dict | None:
        if not self._table:
            return self._mem.get(plan_id)
        item = self._table.get_item(Key={"pk": f"PLAN#{plan_id}", "sk": "PLAN"}).get("Item")
        if not item:
            return None
        for k in ("pk", "sk", "expiresAt"):
            item.pop(k, None)
        return json.loads(json.dumps(item, default=lambda d: int(d) if d == int(d) else float(d)))
