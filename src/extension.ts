import * as vscode from "vscode";
import { compile, passes } from "./judge";
import { parseTests } from "./tests";

/** Результат проверки: сошлось, неверное решение или ошибка компиляции. */
type Status = "OK" | "WRONG" | "ERROR";

/** Текст, который показывается на кнопке для каждого результата. */
const STATUS_TITLES: Record<Status, string> = {
  OK: "✅ Сошлось",
  WRONG: "❌ Неверное решение",
  ERROR: "⚠️ Ошибка, подробности в Output",
};

/** Показывает кнопку над каждым примером и хранит результаты проверок. */
class ExampleLensProvider implements vscode.CodeLensProvider {
  /** Результаты по файлам: URI файла -> (номер примера -> статус). */
  private readonly statuses = new Map<string, Map<number, Status>>();
  /** Событие, по которому VS Code заново запрашивает кнопки. */
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changed.event;

  /** Вызывается VS Code: возвращает кнопки для всех примеров документа. */
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const statuses = this.statuses.get(document.uri.toString());
    return parseTests(document.getText()).map((test) => {
      // Кнопка рисуется над строкой, где начинается комментарий с примером.
      const position = document.positionAt(test.offset);
      const status = statuses?.get(test.number);
      return new vscode.CodeLens(new vscode.Range(position, position), {
        // Пока пример не проверяли, кнопка предлагает проверить.
        title: status ? STATUS_TITLES[status] : "▶ Проверить пример",
        command: "cppExamples.checkExample",
        arguments: [document.uri, test.number],
      });
    });
  }

  /** Запоминает результат примера и просит VS Code перерисовать кнопки. */
  setStatus(uri: vscode.Uri, number: number, status: Status): void {
    const key = uri.toString();
    const statuses = this.statuses.get(key) ?? new Map<number, Status>();
    statuses.set(number, status);
    this.statuses.set(key, statuses);
    this.changed.fire();
  }

  /** Сбрасывает результаты файла, например после его правки. */
  forget(uri: vscode.Uri): void {
    // Перерисовываем кнопки, только если у файла были результаты.
    if (this.statuses.delete(uri.toString())) {
      this.changed.fire();
    }
  }
}

/** Единственный провайдер кнопок на всё расширение. */
const lenses = new ExampleLensProvider();

/** Панель Output, куда выводятся ошибки компиляции. */
let output: vscode.OutputChannel;

/** Точка входа: VS Code вызывает её при открытии первого C++ файла. */
export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("C++ Example Checker");
  // Всё, что лежит в subscriptions, VS Code освободит при выгрузке плагина.
  context.subscriptions.push(
    output,
    // Кнопки показываются только в C++ файлах, сохранённых на диске.
    vscode.languages.registerCodeLensProvider(
      { language: "cpp", scheme: "file" },
      lenses,
    ),
    vscode.commands.registerCommand("cppExamples.checkExample", checkExample),
    // После правки файла старые результаты уже неверны, сбрасываем их.
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length > 0) {
        lenses.forget(event.document.uri);
      }
    }),
  );
}

/** Обработчик кнопки: собирает решение, запускает на примере, даёт вердикт. */
async function checkExample(uri: vscode.Uri, number: number): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);
  // Компилятор читает файл с диска, поэтому сначала сохраняем правки.
  await document.save();
  const test = parseTests(document.getText()).find(
    (candidate) => candidate.number === number,
  );
  // Пример могли удалить из файла, пока была видна старая кнопка.
  if (!test) {
    return;
  }

  try {
    const executable = await compile(document.fileName);
    const correct = await passes(executable, test.input, test.answer);
    const status = correct ? "OK" : "WRONG";
    lenses.setStatus(uri, number, status);
  } catch (error) {
    // Сюда попадают ошибки компиляции: показываем их в панели Output.
    lenses.setStatus(uri, number, "ERROR");
    output.replace((error as Error).message);
    output.show(true);
  }
}
