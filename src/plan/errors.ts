// Turns provider error text into a sentence a person can act on. Unknown errors pass
// through unchanged, so nothing is hidden.
const RULES: [RegExp, string][] = [
  [/authentication_error|invalid x-api-key|incorrect api key|api key not valid|invalid api key|invalid_api_key|unauthorized|\b401\b/i,
    "The provider rejected your API key. Check it in model settings."],
  [/insufficient_quota|credit balance|billing|quota|\b402\b/i,
    "The provider says your account is out of credit or over its quota."],
  [/rate.?limit|too many requests|\b429\b|overloaded/i,
    "The provider is busy or rate-limiting your account. Wait a minute and try again."],
  [/model.{0,40}(not found|does not exist|not_found)|unknown model|no such model|model_not_found/i,
    "That model name was not found at the provider. Check the model in settings."],
  [/unable to allocate|failed to allocate|bad_alloc|out of memory|requires more system memory|insufficient memory/i,
    "Your computer ran out of memory loading the model. Close other programs, stop other Ollama models (`ollama ps`, then `ollama stop <name>`), or choose a smaller model."],
  [/ECONNREFUSED|fetch failed|ENOTFOUND|getaddrinfo/i,
    "Could not reach the model server. Check the address in model settings and that the server is running."],
];

export function friendlyError(raw: string): string {
  for (const [pattern, message] of RULES) if (pattern.test(raw)) return message;
  return raw;
}
