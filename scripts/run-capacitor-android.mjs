import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";

function javaWorks(env = process.env) {
  const result = spawnSync("java", ["-version"], { env, stdio: "ignore", shell: isWindows });
  return result.status === 0;
}

function addIfExists(paths, path) {
  if (path && existsSync(path)) paths.push(path);
}

function addVersionedJdks(paths, baseDir) {
  if (!baseDir || !existsSync(baseDir)) return;
  for (const name of readdirSync(baseDir)) {
    if (/^(jdk|temurin|zulu|microsoft)-?21/i.test(name) || /^jdk-21/i.test(name)) {
      addIfExists(paths, join(baseDir, name));
    }
  }
}

function detectJavaHome() {
  const candidates = [];

  if (isWindows) {
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    addIfExists(candidates, join(programFiles, "Android", "Android Studio", "jbr"));
    addIfExists(candidates, join(programFiles, "Android", "Android Studio", "jre"));
    addIfExists(candidates, programFilesX86 && join(programFilesX86, "Android", "Android Studio", "jbr"));
    addVersionedJdks(candidates, join(programFiles, "Eclipse Adoptium"));
    addVersionedJdks(candidates, join(programFiles, "Java"));
  } else if (process.platform === "darwin") {
    addIfExists(candidates, "/Applications/Android Studio.app/Contents/jbr/Contents/Home");
    addIfExists(candidates, "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home");
    addIfExists(candidates, "/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home");
  } else {
    addIfExists(candidates, "/opt/android-studio/jbr");
    addIfExists(candidates, "/usr/lib/jvm/java-21-openjdk-amd64");
    addIfExists(candidates, "/usr/lib/jvm/temurin-21-jdk-amd64");
  }

  return candidates.find((javaHome) => javaWorks({
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${join(javaHome, "bin")}${isWindows ? ";" : ":"}${process.env.PATH || ""}`,
  }));
}

const env = { ...process.env };

if (!env.JAVA_HOME && !javaWorks(env)) {
  const javaHome = detectJavaHome();
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    env.PATH = `${join(javaHome, "bin")}${isWindows ? ";" : ":"}${env.PATH || ""}`;
    console.log(`JAVA_HOME temporário: ${javaHome}`);
  }
}

if (!javaWorks(env)) {
  console.error("Java/JDK 21 não encontrado. Instale o Android Studio ou Temurin JDK 21 e rode novamente.");
  process.exit(1);
}

const npx = isWindows ? "npx.cmd" : "npx";
const result = spawnSync(npx, ["cap", "run", "android"], { env, stdio: "inherit", shell: false });
process.exit(result.status ?? 1);