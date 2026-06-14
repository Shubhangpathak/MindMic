import { summarizeTranscript } from "./ollamaConfig.js";

async function main() {
  const result = await summarizeTranscript();
  console.log(result);
}

main();