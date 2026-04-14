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
				input: "1+1",
				max_output_tokens: 1,
			}),
		});

		const usage = parseCodexUsageHeaders(response.headers, {
			defaultUtilization: response.status === 429 ? 100 : 0,
		});

		if (usage) {
			log.debug(
				`Codex usage probe: 5h=${usage.five_hour.utilization}%, 7d=${usage.seven_day.utilization}%`,
			);
		} else {
			log.debug(
				`Codex usage probe: no usage headers in response (status ${response.status})`,
			);
		}

		// Drain response body to avoid resource leak
		try {
			await response.text();
		} catch {
			// ignore
		}

		return usage;
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		log.error(`Codex usage probe failed: ${msg}`);
		return null;
	}
}
