import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

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
    addIfExists(candidates, "/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home");
  } else {
    addIfExists(candidates, "/opt/android-studio/jbr");
    addIfExists(candidates, "/usr/lib/jvm/java-21-openjdk-amd64");
    addIfExists(candidates, "/usr/lib/jvm/temurin-21-jdk-amd64");
  }

  return candidates.find((javaHome) => javaWorks({
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${join(javaHome, "bin")}${separator}${process.env.PATH || ""}`,
  }));
}

const env = { ...process.env };

function assertFileContains(path, expected) {
  if (!existsSync(path)) {
    console.error(`Arquivo obrigatório não encontrado: ${path}`);
    process.exit(1);
  }
  const text = readFileSync(path, "utf8");
  if (!text.includes(expected)) {
    console.error(`Marcador obrigatório não encontrado em ${path}: ${expected}`);
    process.exit(1);
  }
}

assertFileContains("android/app/src/main/java/com/contasfacil/app/MainActivity.java", "IME v6");
assertFileContains("public/diagnostico.html", "IME v6");
assertFileContains("src/routes/login.tsx", "Diagnóstico direto APK — IME v6");
console.log("Marcadores IME v6 conferidos: código nativo, login e diagnóstico direto.");

if (!javaWorks(env)) {
  const javaHome = detectJavaHome();
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    env.PATH = `${join(javaHome, "bin")}${separator}${env.PATH || ""}`;
    console.log(`JAVA_HOME temporário: ${javaHome}`);
  }
}

if (!javaWorks(env)) {
  console.error("Java/JDK não encontrado. Abra o Android Studio uma vez, ou instale o Temurin JDK 21, e rode novamente.");
  process.exit(1);
}

const gradle = isWindows ? "gradlew.bat" : "./gradlew";
const oldApkPath = join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");

rmSync(oldApkPath, { force: true });
console.log("Limpando build Android antigo para evitar APK/cache desatualizado...");

const result = spawnSync(gradle, ["clean", "assembleDebug"], {
  cwd: "android",
  env,
  stdio: "inherit",
  shell: isWindows,
});

if ((result.status ?? 1) === 0 && existsSync(oldApkPath)) {
  console.log(`APK novo gerado: ${oldApkPath}`);
}

process.exit(result.status ?? 1);