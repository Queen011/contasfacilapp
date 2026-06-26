import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function ensureLocalProperties() {
  const file = join("android", "local.properties");
  const candidates = [];
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    const userProfile = process.env.USERPROFILE;
    if (localAppData) candidates.push(join(localAppData, "Android", "Sdk"));
    if (userProfile) candidates.push(join(userProfile, "AppData", "Local", "Android", "Sdk"));
  } else if (process.platform === "darwin") {
    if (process.env.HOME) candidates.push(join(process.env.HOME, "Library", "Android", "sdk"));
  } else {
    if (process.env.HOME) candidates.push(join(process.env.HOME, "Android", "Sdk"));
  }
  if (process.env.ANDROID_HOME) candidates.unshift(process.env.ANDROID_HOME);
  if (process.env.ANDROID_SDK_ROOT) candidates.unshift(process.env.ANDROID_SDK_ROOT);
  const sdk = candidates.find((p) => p && existsSync(p));
  if (!sdk) return;
  const escaped = sdk.replace(/\\/g, "\\\\");
  const line = `sdk.dir=${escaped}\n`;
  let current = "";
  try { current = readFileSync(file, "utf8"); } catch {}
  // Reescreve se faltar ou se a entrada sdk.dir parecer corrompida (barras não escapadas)
  const sdkLine = current.split(/\r?\n/).find((l) => l.startsWith("sdk.dir="));
  const valid = sdkLine && existsSync(sdkLine.replace(/^sdk\.dir=/, "").replace(/\\\\/g, "\\"));
  if (!valid) {
    writeFileSync(file, line);
    console.log(`local.properties (re)gerado: ${sdk}`);
  }
}

ensureLocalProperties();

const isWindows = process.platform === "win32";
const separator = isWindows ? ";" : ":";

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
    const localAppData = process.env.LOCALAPPDATA;
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    addIfExists(candidates, join(programFiles, "Android", "Android Studio", "jbr"));
    addIfExists(candidates, join(programFiles, "Android", "Android Studio", "jre"));
    addIfExists(candidates, programFilesX86 && join(programFilesX86, "Android", "Android Studio", "jbr"));
    addIfExists(candidates, localAppData && join(localAppData, "Programs", "Android Studio", "jbr"));
    addVersionedJdks(candidates, join(programFiles, "Eclipse Adoptium"));
    addVersionedJdks(candidates, join(programFiles, "Java"));
  } else if (process.platform === "darwin") {
    addIfExists(candidates, "/Applications/Android Studio.app/Contents/jbr/Contents/Home");
    addIfExists(candidates, "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home");
  } else {
    addIfExists(candidates, "/opt/android-studio/jbr");
    addIfExists(candidates, "/usr/lib/jvm/java-21-openjdk-amd64");
  }
  return candidates.find((javaHome) => javaWorks({
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${join(javaHome, "bin")}${separator}${process.env.PATH || ""}`,
  }));
}

const env = { ...process.env };

if (!javaWorks(env)) {
  const javaHome = detectJavaHome();
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    env.PATH = `${join(javaHome, "bin")}${separator}${env.PATH || ""}`;
    console.log(`JAVA_HOME temporário: ${javaHome}`);
  }
}

if (!javaWorks(env)) {
  console.error("Java/JDK não encontrado. Abra o Android Studio uma vez, ou instale o Temurin JDK 21.");
  process.exit(1);
}

function runRootStep(label, command, args) {
  console.log(label);
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    shell: isWindows,
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

runRootStep("Sincronizando app web + Capacitor Android...", "npm", ["run", "android:sync"]);

const gradle = isWindows ? "gradlew.bat" : "./gradlew";
const apkPath = join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
rmSync(apkPath, { force: true });

const result = spawnSync(gradle, ["clean", "assembleDebug"], {
  cwd: "android",
  env,
  stdio: "inherit",
  shell: isWindows,
});

if ((result.status ?? 1) === 0 && existsSync(apkPath)) {
  console.log(`APK gerado: ${apkPath}`);
}
process.exit(result.status ?? 1);
