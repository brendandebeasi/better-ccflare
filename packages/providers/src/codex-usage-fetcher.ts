import { Logger } from "@better-ccflare/logger";
import { parseCodexUsageHeaders } from "./providers/codex/usage";
import type { UsageData } from "./usage-fetcher";

const log = new Logger("CodexUsageFetcher");

const CODEX_VERSION = "0.92.0";
const CODEX_USER_AGENT = `codex-cli/${CODEX_VERSION} (Windows 10.0.26100; x64)`;
const CODEX_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses";

export async function fetchCodexUsageData(
	accessToken: string,
): Promise<UsageData | null> {
	const controller = new AbortController();
	try {
		const response = await fetch(CODEX_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				Version: CODEX_VERSION,
				"Openai-Beta": "responses=experimental",
				"User-Agent": CODEX_USER_AGENT,
				originator: "codex_cli_rs",
			},
			body: JSON.stringify({
				model: "gpt-5.1-codex-mini",
				instructions: "answer briefly",
				input: [{ type: "message", role: "user", content: "1+1" }],
				store: false,
				stream: true,
			}),
			signal: controller.signal,
		});

		const usage = parseCodexUsageHeaders(response.headers, {
			defaultUtilization: response.status === 429 ? 100 : 0,
		});

		if (usage) {
			log.info(
				`Codex usage probe: 5h=${usage.five_hour.utilization}%, 7d=${usage.seven_day.utilization}%`,
			);
		} else {
			log.info(
				`Codex usage probe: no usage headers in response (status ${response.status})`,
			);
		}

		// Abort the streaming response — we only needed the headers
		controller.abort();

		return usage;
	} catch (error) {
		controller.abort();
		const msg = error instanceof Error ? error.message : String(error);
		if (!msg.includes("abort")) {
			log.error(`Codex usage probe failed: ${msg}`);
		}
		return null;
	}
}
