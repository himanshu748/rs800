import { copyFileSync } from "node:fs";

copyFileSync(new URL("../../../services/api/app/data/demo_jobs.json", import.meta.url), new URL("../lib/demo_jobs.json", import.meta.url));
