import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const episodesDir = path.join(__dirname, "episodes");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function isCellTuple(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "number")
  );
}

function validateEpisode(episode, label) {
  const errors = [];

  if (!episode.episode_id) errors.push("episode_id is missing");
  if (!episode.amr_id) errors.push("amr_id is missing");
  if (!episode.task) errors.push("task is missing");
  if (!isCellTuple(episode.start_cell)) errors.push("start_cell must be [x, y]");
  if (episode.goal_cell !== null && !isCellTuple(episode.goal_cell)) {
    errors.push("goal_cell must be [x, y] or null");
  }
  if (!Array.isArray(episode.trajectory)) errors.push("trajectory must be an array");
  if (Array.isArray(episode.trajectory) && episode.trajectory.length === 0) {
    errors.push("trajectory is empty");
  }
  if (!Array.isArray(episode.reservation_log)) {
    errors.push("reservation_log must be an array");
  }
  if (typeof episode.collisions_avoided !== "number") {
    errors.push("collisions_avoided must be a number");
  }
  if (typeof episode.duration_ms !== "number") {
    errors.push("duration_ms must be a number");
  }
  if (typeof episode.success !== "boolean") {
    errors.push("success must be boolean");
  }

  if (errors.length > 0) {
    fail(`${label}: ${errors.join(", ")}`);
    return false;
  }

  pass(`${label}: valid episode ${episode.episode_id}`);
  return true;
}

function validateFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const json = JSON.parse(raw);
  const basename = path.basename(filePath);

  const episodes = Array.isArray(json.episodes) ? json.episodes : [json];

  if (episodes.length === 0) {
    fail(`${basename}: no episodes found`);
    return 0;
  }

  let validCount = 0;

  episodes.forEach((episode, index) => {
    if (validateEpisode(episode, `${basename}#${index}`)) {
      validCount += 1;
    }
  });

  return validCount;
}

if (!fs.existsSync(episodesDir)) {
  fs.mkdirSync(episodesDir, { recursive: true });
}

const files = fs
  .readdirSync(episodesDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => path.join(episodesDir, file));

if (files.length === 0) {
  fail("No JSON files found in dataset/episodes. Export a dataset JSON and copy it into dataset/episodes/.");
} else {
  let totalValid = 0;

  for (const file of files) {
    totalValid += validateFile(file);
  }

  if (process.exitCode !== 1) {
    pass(`All dataset files valid. valid_episode_count=${totalValid}`);
  }
}
