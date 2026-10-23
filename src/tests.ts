/** Пример из комментария: номер, позиция в файле, вход и ожидаемый ответ. */
export interface TestCase {
  /** Порядковый номер примера в файле, начиная с 1. */
  number: number;
  /** Смещение начала комментария в тексте файла. */
  offset: number;
  /** Входные данные, которые подаются программе в stdin. */
  input: string;
  /** Ожидаемый вывод программы. */
  answer: string;
}

/** Любой блочный комментарий; группа 1 — текст между `/*` и `*\/`. */
const BLOCK_COMMENT = /\/\*([\s\S]*?)\*\//g;

/** Тело примера: группа 1 — всё после `input:`, группа 2 — после `output:`. */
const TEST_BODY = /^\s*input:([\s\S]*?)\boutput:([\s\S]*)$/;

/** Находит примеры в блочных комментариях с `input:` и `output:`. */
export function parseTests(source: string): TestCase[] {
  const tests: TestCase[] = [];
  for (const comment of source.matchAll(BLOCK_COMMENT)) {
    // Обычные комментарии без input/output пропускаем.
    const match = comment[1].match(TEST_BODY);
    if (match) {
      tests.push({
        number: tests.length + 1,
        offset: comment.index,
        // Программы на C++ обычно ждут перевод строки в конце ввода.
        input: `${match[1].trim()}\n`,
        answer: match[2].trim(),
      });
    }
  }
  return tests;
}
