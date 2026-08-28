import { acceptCompletion, autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { defaultHighlightStyle, indentUnit, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { linter, lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import type { FieldDefinition } from "../contracts/core.js";
import { ClassicProgramDiagnostic, parseBoundedClassicProgram } from "./classic-program.js";

export interface ClassicProgramEditor {
  getValue(): string;
  setValue(value: string): void;
  setLineNumbers(visible: boolean): void;
  setTabSettings(tabSize: ClassicProgramTabSize, indentWithTabs: boolean): void;
  refreshDiagnostics(): void;
  focus(): void;
  destroy(): void;
}

export type ClassicProgramTabSize = 2 | 4 | 8;

export interface ClassicProgramEditorPreferences {
  lineNumbers: boolean;
  tabSize: ClassicProgramTabSize;
  indentWithTabs: boolean;
}

export interface ClassicProgramCursorPosition {
  line: number;
  column: number;
}

export interface ClassicProgramLintStatus {
  valid: boolean;
  message: string;
  line?: number;
}

const epiInfoLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^(?:DEFINE|RECODE|TO|END|FREQ|TEXTINPUT)\b/i)) return "keyword";
    if (stream.match(/^STRATAVAR\b/i)) return "propertyName";
    if (stream.match(/^(?:LOVALUE|HIVALUE)\b/i)) return "atom";
    if (stream.match(/^"(?:[^"]|"")*"?/)) return "string";
    if (stream.match(/^-?\d+(?:\.\d+)?/)) return "number";
    if (stream.match(/^(?:=|-)/)) return "operator";
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) return "variableName";
    stream.next();
    return null;
  },
});

function fieldCompletion(field: FieldDefinition): Completion {
  return {
    label: field.name,
    displayLabel: field.prompt === field.name ? field.name : `${field.name} — ${field.prompt}`,
    detail: field.type,
    info: `Current form field · ${field.type}`,
    type: "variable",
  };
}

function definedVariables(document: string): Completion[] {
  const variables = [...document.matchAll(/^\s*DEFINE\s+([A-Za-z_][A-Za-z0-9_]*)\b/gim)].map((match) => match[1]!);
  return [...new Set(variables)].map((label) => ({ label, detail: "defined text", type: "variable" }));
}

function completionResult(from: number, options: Completion[]): CompletionResult | null {
  return options.length === 0 ? null : { from, options, validFor: /^(?:[A-Za-z_][A-Za-z0-9_]*)?$/ };
}

function createCompletionSource(getFields: () => readonly FieldDefinition[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    const fields = getFields();

    const recode = /^\s*RECODE\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (recode) {
      const fragment = recode[1] ?? "";
      return completionResult(context.pos - fragment.length, fields.filter((field) => field.type === "number").map(fieldCompletion));
    }

    const target = /^\s*RECODE\s+[A-Za-z_][A-Za-z0-9_]*\s+TO\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (target) {
      const fragment = target[1] ?? "";
      return completionResult(context.pos - fragment.length, definedVariables(context.state.doc.toString()));
    }

    const strata = /\bSTRATAVAR\s*=\s*([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (strata) {
      const fragment = strata[1] ?? "";
      return completionResult(context.pos - fragment.length, fields.map(fieldCompletion));
    }

    const frequency = /^\s*FREQ\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (frequency) {
      const fragment = frequency[1] ?? "";
      return completionResult(context.pos - fragment.length, [...fields.map(fieldCompletion), ...definedVariables(context.state.doc.toString())]);
    }

    const command = /^\s*([A-Za-z]*)$/.exec(before);
    if (command && (context.explicit || command[1]!.length > 0)) {
      return completionResult(context.pos - command[1]!.length, [
        { label: "DEFINE", detail: "declare a variable", type: "keyword" },
        { label: "RECODE", detail: "group numeric values", type: "keyword" },
        { label: "FREQ", detail: "frequency table", type: "keyword" },
      ]);
    }

    return null;
  };
}

export function createClassicProgramEditor(
  parent: HTMLElement,
  initialValue: string,
  getFields: () => readonly FieldDefinition[],
  preferences: ClassicProgramEditorPreferences,
  onCursorPosition?: (position: ClassicProgramCursorPosition) => void,
  onLintStatus?: (status: ClassicProgramLintStatus) => void,
): ClassicProgramEditor {
  const lineNumberConfiguration = new Compartment();
  const tabConfiguration = new Compartment();
  const tabExtensions = (tabSize: ClassicProgramTabSize, indentWithTabs: boolean) => [
    EditorState.tabSize.of(tabSize),
    indentUnit.of(indentWithTabs ? "\t" : " ".repeat(tabSize)),
  ];
  const collectDiagnostics = (editorView: EditorView): Diagnostic[] => {
    try {
      parseBoundedClassicProgram(editorView.state.doc.toString(), getFields());
      onLintStatus?.({ valid: true, message: "Program syntax is valid for the safe V0.1 command set." });
      return [];
    } catch (error) {
      const diagnostic = error instanceof ClassicProgramDiagnostic ? error : null;
      const requestedLine = diagnostic?.line ?? 1;
      const lineNumber = Math.max(1, Math.min(requestedLine, editorView.state.doc.lines));
      const line = editorView.state.doc.line(lineNumber);
      const message = diagnostic ? diagnostic.message.replace(/^Line \d+:\s*/, "") : "Unable to validate this program.";
      onLintStatus?.({ valid: false, message, line: lineNumber });
      return [{
        from: line.from,
        to: Math.max(line.from + 1, line.to),
        severity: "error",
        message,
      }];
    }
  };
  const liveSyntaxLinter = linter(collectDiagnostics, { delay: 350 });
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initialValue,
      extensions: [
        minimalSetup,
        lineNumberConfiguration.of(preferences.lineNumbers ? lineNumbers() : []),
        tabConfiguration.of(tabExtensions(preferences.tabSize, preferences.indentWithTabs)),
        epiInfoLanguage,
        syntaxHighlighting(defaultHighlightStyle),
        liveSyntaxLinter,
        lintGutter(),
        autocompletion({ activateOnTyping: true, override: [createCompletionSource(getFields)] }),
        keymap.of([
          { key: "Tab", run: acceptCompletion },
          indentWithTab,
        ]),
        EditorView.contentAttributes.of({
          "aria-label": "Epi Info program source",
          "aria-describedby": "classic-program-completion-help",
          spellcheck: "false",
        }),
        EditorView.updateListener.of((update) => {
          if (!onCursorPosition || (!update.selectionSet && !update.docChanged)) return;
          const cursor = update.state.selection.main.head;
          const line = update.state.doc.lineAt(cursor);
          onCursorPosition({ line: line.number, column: cursor - line.from + 1 });
        }),
      ],
    }),
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue(value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    },
    setLineNumbers(visible) {
      view.dispatch({ effects: lineNumberConfiguration.reconfigure(visible ? lineNumbers() : []) });
    },
    setTabSettings(tabSize, indentWithTabs) {
      view.dispatch({ effects: tabConfiguration.reconfigure(tabExtensions(tabSize, indentWithTabs)) });
    },
    refreshDiagnostics() {
      view.dispatch(setDiagnostics(view.state, collectDiagnostics(view)));
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
