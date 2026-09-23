import { indentWithTab, redo, undo } from "@codemirror/commands";
import { defaultHighlightStyle, indentUnit, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { linter, lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import type { FormSchema } from "../contracts/core.ts";
import { CheckCodeParseError, compileFieldCheckCodeSubset, parseCheckCodeProgram, type CheckCodeCompileContext } from "./check-code-program.ts";

export type CheckCodeEditorTabSize = 2 | 4 | 8;

export interface CheckCodeEditorPreferences {
  lineNumbers: boolean;
  tabSize: CheckCodeEditorTabSize;
  indentWithTabs: boolean;
  fontFamily: string;
  fontSize: number;
}

export interface CheckCodeEditorPosition { line: number; column: number }
export interface CheckCodeEditorLintStatus { valid: boolean; message: string; line?: number }

export interface CheckCodeSourceEditor {
  getValue(): string;
  setValue(value: string): void;
  setLineNumbers(visible: boolean): void;
  setTabSettings(tabSize: CheckCodeEditorTabSize, indentWithTabs: boolean): void;
  setFont(fontFamily: string, fontSize: number): void;
  findText(query: string, fromStart?: boolean, caseSensitive?: boolean, wholeWord?: boolean): boolean;
  replaceText(query: string, replacement: string, replaceAll?: boolean, caseSensitive?: boolean, wholeWord?: boolean): number;
  undo(): boolean;
  redo(): boolean;
  refreshDiagnostics(): void;
  focus(): void;
  destroy(): void;
}

const checkCodeLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^(?:DEFINEVARIABLES|END-DEFINEVARIABLES|DEFINE|UNDEFINE|FORM|VIEW|END-FORM|END-VIEW|RECORD|END-RECORD|PAGE|END-PAGE|FIELD|END-FIELD|BEFORE|END-BEFORE|AFTER|END-AFTER|CLICK|END-CLICK|IF|THEN|ELSE|ELSE-IF|END-IF|ALWAYS|END|SUB|END-SUB|CALL|ASSIGN|LET|CLEAR|BEEP|AUTOSEARCH|DISPLAYLIST|CONTINUENEW|IOCODE|SAVE-RECORD|SAVERECORD|NEWRECORD|NEW-RECORD|QUIT|EXIT|GOTO|GOTOPAGE|GOTOFORM|ENABLE|DISABLE|HIDE|UNHIDE|HIGHLIGHT|UNHIGHLIGHT|SET-REQUIRED|SET-NOT-REQUIRED|DIALOG|GEOCODE)\b/i)) return "keyword";
    if (stream.match(/^(?:STANDARD|GLOBAL|PERMANENT|TEXTINPUT|NUMERIC|YN|DATEFORMAT|TIMEFORMAT|DATETIMEFORMAT|TITLETEXT|DBVARIABLES|DBVALUES|DBVIEWS|DATABASES|READ|WRITE)\b/i)) return "propertyName";
    if (stream.match(/^(?:ABS|ROUND|STRLEN|SUBSTRING|UPPERCASE|TXTTONUM|YEAR|MONTH|DAY)(?=\s*\()/i)) return "function(variableName)";
    if (stream.match(/^(?:AND|OR|NOT|MOD|TRUE|FALSE|YES|NO|NULL)\b/i)) return "atom";
    if (stream.match(/^\/\*/)) { while (!stream.match("*/") && !stream.eol()) stream.next(); return "blockComment"; }
    if (stream.match(/^(?:\/\/|\*\*\*).*/)) return "lineComment";
    if (stream.match(/^(?:"(?:[^"]|"")*"?|'(?:[^']|'')*'?)/)) return "string";
    if (stream.match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/)) return "number";
    if (stream.match(/^(?:<=|>=|<>|!=|=|<|>|\+|-|\*|\/|%|\^|&)/)) return "operator";
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) return "variableName";
    stream.next();
    return null;
  },
});

function lineDiagnostic(view: EditorView, lineNumber: number, message: string): Diagnostic {
  const bounded = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
  const line = view.state.doc.line(bounded);
  return { from: line.from, to: Math.max(line.from + 1, line.to), severity: "error", message };
}

function searchExpression(query: string, caseSensitive: boolean, wholeWord: boolean): RegExp {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(wholeWord ? `\\b${escaped}\\b` : escaped, caseSensitive ? "g" : "gi");
}

export function createCheckCodeSourceEditor(
  parent: HTMLElement,
  initialValue: string,
  getSchema: () => FormSchema,
  preferences: CheckCodeEditorPreferences,
  onCursorPosition?: (position: CheckCodeEditorPosition) => void,
  onLintStatus?: (status: CheckCodeEditorLintStatus) => void,
  onDocumentChange?: (value: string) => void,
  getCompileContext?: () => CheckCodeCompileContext,
): CheckCodeSourceEditor {
  const lineNumberConfiguration = new Compartment();
  const tabConfiguration = new Compartment();
  const fontConfiguration = new Compartment();
  const tabExtensions = (tabSize: CheckCodeEditorTabSize, indentWithTabs: boolean) => [
    EditorState.tabSize.of(tabSize),
    indentUnit.of(indentWithTabs ? "\t" : " ".repeat(tabSize)),
  ];
  const fontExtension = (fontFamily: string, fontSize: number) => EditorView.editorAttributes.of({
    style: `--check-code-font-family: "${fontFamily.replace(/"/g, "\\\"")}"; --check-code-font-size: ${fontSize}px`,
  });
  const collectDiagnostics = (view: EditorView): Diagnostic[] => {
    try {
      const ast = parseCheckCodeProgram(view.state.doc.toString());
      const compiled = compileFieldCheckCodeSubset(ast, getSchema(), getCompileContext?.());
      const diagnostics = compiled.reasons.map((reason) => {
        const line = Number(/^Line (\d+):/.exec(reason)?.[1] ?? 1);
        return lineDiagnostic(view, line, reason.replace(/^Line \d+:\s*/, ""));
      });
      onLintStatus?.({
        valid: diagnostics.length === 0,
        message: diagnostics.length === 0
          ? `Syntax and references are valid across ${ast.blocks.length} scope block${ast.blocks.length === 1 ? "" : "s"}.`
          : `${diagnostics.length} reference or capability issue${diagnostics.length === 1 ? "" : "s"} remain${diagnostics.length === 1 ? "s" : ""}.`,
        ...(diagnostics[0] ? { line: view.state.doc.lineAt(diagnostics[0].from).number } : {}),
      });
      return diagnostics;
    } catch (error) {
      const line = error instanceof CheckCodeParseError ? error.line : 1;
      const message = error instanceof Error ? error.message.replace(/^Line \d+:\s*/, "") : "Unable to parse Check Code source.";
      onLintStatus?.({ valid: false, message, line });
      return [lineDiagnostic(view, line, message)];
    }
  };
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initialValue,
      extensions: [
        minimalSetup,
        lineNumberConfiguration.of(preferences.lineNumbers ? lineNumbers() : []),
        tabConfiguration.of(tabExtensions(preferences.tabSize, preferences.indentWithTabs)),
        fontConfiguration.of(fontExtension(preferences.fontFamily, preferences.fontSize)),
        checkCodeLanguage,
        syntaxHighlighting(defaultHighlightStyle),
        linter(collectDiagnostics, { delay: 350 }),
        lintGutter(),
        keymap.of([indentWithTab]),
        EditorView.contentAttributes.of({ "aria-label": "Check Code source", spellcheck: "false" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onDocumentChange?.(update.state.doc.toString());
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
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, selection: { anchor: 0 } });
    },
    setLineNumbers(visible) {
      view.dispatch({ effects: lineNumberConfiguration.reconfigure(visible ? lineNumbers() : []) });
    },
    setTabSettings(tabSize, indentWithTabs) {
      view.dispatch({ effects: tabConfiguration.reconfigure(tabExtensions(tabSize, indentWithTabs)) });
    },
    setFont(fontFamily, fontSize) {
      view.dispatch({ effects: fontConfiguration.reconfigure(fontExtension(fontFamily, fontSize)) });
    },
    findText(query, fromStart = false, caseSensitive = false, wholeWord = false) {
      if (!query) return false;
      const expression = searchExpression(query, caseSensitive, wholeWord);
      expression.lastIndex = fromStart ? 0 : view.state.selection.main.to;
      const source = view.state.doc.toString();
      let match = expression.exec(source);
      if (!match && !fromStart) { expression.lastIndex = 0; match = expression.exec(source); }
      if (!match) return false;
      const selection = { anchor: match.index, head: match.index + match[0].length };
      view.dispatch({ selection, effects: EditorView.scrollIntoView(selection.head, { y: "center" }) });
      view.focus();
      return true;
    },
    replaceText(query, replacement, replaceAll = false, caseSensitive = false, wholeWord = false) {
      if (!query) return 0;
      const matches = [...view.state.doc.toString().matchAll(searchExpression(query, caseSensitive, wholeWord))];
      const selection = view.state.selection.main;
      const candidates = replaceAll ? matches : matches.filter((match) => match.index! >= selection.from).slice(0, 1);
      if (candidates.length === 0) return 0;
      view.dispatch({ changes: candidates.map((match) => ({ from: match.index!, to: match.index! + match[0].length, insert: replacement })) });
      view.focus();
      return candidates.length;
    },
    undo: () => undo(view),
    redo: () => redo(view),
    refreshDiagnostics() {
      view.dispatch(setDiagnostics(view.state, collectDiagnostics(view)));
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
