import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

/** `execFile` в виде промиса, чтобы писать через async/await. */
const execFileAsync = promisify(execFile);

/** Папка для бинарников во временном каталоге, чтобы не мусорить в проекте. */
const BUILD_DIR = path.join(tmpdir(), "cpp-example-check");

/** Ограничение времени на один запуск решения, мс. */
const TIME_LIMIT_MS = 2000;

/** Компилирует решение через g++ и возвращает путь к бинарнику. */
export async function compile(sourcePath: string): Promise<string> {
  await mkdir(BUILD_DIR, { recursive: true });
  // Бинарник называется как исходник: A.cpp -> A.
  const executable = path.join(BUILD_DIR, path.parse(sourcePath).name);

  try {
    await execFileAsync("g++", [
      "-std=c++20",
      "-O2",
      sourcePath,
      "-o",
      executable,
    ]);
  } catch (error) {
    // Текст ошибки компилятора лежит в stderr, его и показываем.
    const { stderr } = error as { stderr?: string };
    throw new Error(stderr || String(error));
  }
  return executable;
}

/** Решение верно, если уложилось в 2 секунды, не упало и вывело ответ. */
export async function passes(
  executable: string,
  input: string,
  answer: string,
): Promise<boolean> {
  // По таймауту процесс убивается сразу, SIGKILL нельзя перехватить.
  const running = execFileAsync(executable, {
    timeout: TIME_LIMIT_MS,
    killSignal: "SIGKILL",
  });
  // Программа может завершиться, не дочитав ввод; это не ошибка плагина.
  running.child.stdin?.on("error", () => {});
  running.child.stdin?.end(input);

  try {
    const { stdout } = await running;
    return words(stdout) === words(answer);
  } catch {
    // Таймаут или ненулевой код возврата: решение неверное.
    return false;
  }
}

/** Склеивает слова через пробел, чтобы пробелы и переводы строк не мешали. */
function words(text: string): string {
  return text.trim().split(/\s+/).join(" ");
}
