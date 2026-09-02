import { acceptCompletion, autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { cursorDocEnd, cursorDocStart, indentWithTab, redo, selectAll, undo } from "@codemirror/commands";
import { defaultHighlightStyle, indentUnit, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { linter, lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import type { FieldDefinition } from "../contracts/core.js";
import { ClassicSyntaxError, parseClassicProgram } from "./classic-ast.js";
import { ClassicProgramDiagnostic, parseBoundedClassicProgram } from "./classic-program.js";

export interface ClassicProgramEditor {
  getValue(): string;
  setValue(value: string): void;
  setLineNumbers(visible: boolean): void;
  setTabSettings(tabSize: ClassicProgramTabSize, indentWithTabs: boolean): void;
  setFont(fontFamily: string, fontSize: number): void;
  refreshDiagnostics(): void;
  undo(): boolean;
  redo(): boolean;
  selectAll(): boolean;
  moveToBeginning(): boolean;
  moveToEnd(): boolean;
  findText(query: string, fromStart?: boolean, caseSensitive?: boolean, wholeWord?: boolean): boolean;
  replaceText(query: string, replacement: string, replaceAll?: boolean, caseSensitive?: boolean, wholeWord?: boolean): number;
  getSelectedText(): string;
  replaceSelection(value: string, selectInserted?: boolean): void;
  replaceSelectedText(value: string): void;
  focus(): void;
  destroy(): void;
}

export type ClassicProgramTabSize = 2 | 4 | 8;

export interface ClassicProgramEditorPreferences {
  lineNumbers: boolean;
  tabSize: ClassicProgramTabSize;
  indentWithTabs: boolean;
  fontFamily: string;
  fontSize: number;
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
    if (stream.match(/^(?:EPIAI|QUALITY|FILE|CONVERT|READ|RELATE|MATCHING|ALL|LIST|FREQ|MEANS|TABLES|SUMMARIZE|GRAPH|GRAPHTYPE|TITLETEXT|XTITLE|YTITLE|RECODE|TO|DEFINE|GROUPVAR|UNDEFINE|ASSIGN|DISPLAY|DBVARIABLES|DBVIEWS|FIELDVAR|OUTTABLE|IF|THEN|ELSE|END|SELECT|SORT|CANCEL|ASC|ASCENDING|DESC|DESCENDING|STANDARD|GLOBAL|PERMANENT|NUMERIC|TEXTINPUT|YN|DATEFORMAT|DATETIMEFORMAT|TIMEFORMAT)\b/i)) return "keyword";
    if (stream.match(/^(?:STRATAVAR|WEIGHTVAR|OUTTABLE|PSUVAR|STATISTICS|COLUMNSIZE)\b/i)) return "propertyName";
    if (stream.match(/^(?:LOVALUE|HIVALUE|TRUE|FALSE|YES|NO|NOWRAP|ONEISYES|FISHER|NONE)\b/i)) return "atom";
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
  const variables = [...document.matchAll(/^\s*DEFINE\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+([A-Za-z_][A-Za-z0-9_]*))?/gim)]
    .filter((match) => match[2]?.toUpperCase() !== "GROUPVAR")
    .map((match) => match[1]!);
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

    const groupMember = /^\s*DEFINE\s+[A-Za-z_][A-Za-z0-9_]*\s+GROUPVAR(?:\s+[A-Za-z_][A-Za-z0-9_]*)*\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (groupMember) {
      const fragment = groupMember[1] ?? "";
      return completionResult(context.pos - fragment.length, fields.map(fieldCompletion));
    }

    const target = /^\s*RECODE\s+[A-Za-z_][A-Za-z0-9_]*\s+TO\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (target) {
      const fragment = target[1] ?? "";
      return completionResult(context.pos - fragment.length, definedVariables(context.state.doc.toString()));
    }

    const assignment = /^\s*ASSIGN\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (assignment) {
      const fragment = assignment[1] ?? "";
      return completionResult(context.pos - fragment.length, definedVariables(context.state.doc.toString()));
    }

    const undefine = /^\s*UNDEFINE\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (undefine) {
      const fragment = undefine[1] ?? "";
      return completionResult(context.pos - fragment.length, [{ label: "*", detail: "all Standard variables", type: "keyword" }, ...definedVariables(context.state.doc.toString())]);
    }

    const ifVariable = /^\s*IF\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (ifVariable) {
      const fragment = ifVariable[1] ?? "";
      return completionResult(context.pos - fragment.length, definedVariables(context.state.doc.toString()));
    }

    const display = /^\s*DISPLAY\s+([A-Za-z_]*)$/i.exec(before);
    if (display) return completionResult(context.pos - display[1]!.length, [{ label: "DBVARIABLES", detail: "variables currently available", type: "keyword" }]);

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

    const sort = /^\s*SORT(?:\s+(?:[A-Za-z_][A-Za-z0-9_]*|\[[^\]]+\])(?:\s+(?:ASC|ASCENDING|DESC|DESCENDING))?)*\s+([A-Za-z_][A-Za-z0-9_]*)?$/i.exec(before);
    if (sort) {
      const fragment = sort[1] ?? "";
      return completionResult(context.pos - fragment.length, fields.map(fieldCompletion));
    }

    const command = /^\s*([A-Za-z]*)$/.exec(before);
    if (command && (context.explicit || command[1]!.length > 0)) {
      return completionResult(context.pos - command[1]!.length, [
        { label: "READ", detail: "open a data source", type: "keyword" },
        { label: "RELATE", detail: "join a related table", type: "keyword" },
        { label: "DEFINE", detail: "declare a variable", type: "keyword" },
        { label: "UNDEFINE", detail: "remove a defined variable", type: "keyword" },
        { label: "ASSIGN", detail: "set a variable value", type: "keyword" },
        { label: "DISPLAY", detail: "show variables and metadata", type: "keyword" },
        { label: "IF", detail: "conditionally run statements", type: "keyword" },
        { label: "RECODE", detail: "group numeric values", type: "keyword" },
        { label: "FREQ", detail: "frequency table", type: "keyword" },
        { label: "GRAPH", detail: "chart active records", type: "keyword" },
        { label: "TABLES", detail: "cross-tabulation", type: "keyword" },
        { label: "SELECT", detail: "filter records", type: "keyword" },
        { label: "SORT", detail: "order active records", type: "keyword" },
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
  onDocumentChange?: (value: string) => void,
): ClassicProgramEditor {
  const lineNumberConfiguration = new Compartment();
  const tabConfiguration = new Compartment();
  const fontConfiguration = new Compartment();
  const tabExtensions = (tabSize: ClassicProgramTabSize, indentWithTabs: boolean) => [
    EditorState.tabSize.of(tabSize),
    indentUnit.of(indentWithTabs ? "\t" : " ".repeat(tabSize)),
  ];
  const fontExtension = (fontFamily: string, fontSize: number) => EditorView.editorAttributes.of({
    style: `--classic-program-font-family: "${fontFamily.replace(/"/g, "\\\"")}"; --classic-program-font-size: ${fontSize}px`,
  });
  const collectDiagnostics = (editorView: EditorView): Diagnostic[] => {
    try {
      const source = editorView.state.doc.toString();
      const ast = parseClassicProgram(source);
      const executableShape = ast.body.length === 3
        && ast.body[0]?.type === "DefineStatement"
        && ast.body[1]?.type === "RecodeStatement"
        && ast.body[2]?.type === "FrequencyStatement";
      if (executableShape) parseBoundedClassicProgram(source, getFields());
      onLintStatus?.({
        valid: true,
        message: executableShape
          ? "Program syntax is valid, and fields are valid for the safe V0.1 executor."
          : `Program syntax is valid AST ${ast.astVersion}; execution remains disabled for this command sequence.`,
      });
      return [];
    } catch (error) {
      const diagnostic = error instanceof ClassicProgramDiagnostic || error instanceof ClassicSyntaxError ? error : null;
      const requestedLine = diagnostic?.line ?? 1;
      const lineNumber = Math.max(1, Math.min(requestedLine, editorView.state.doc.lines));
      const line = editorView.state.doc.line(lineNumber);
      const message = diagnostic ? diagnostic.message.replace(/^Line \d+(?:, column \d+)?:\s*/, "") : "Unable to validate this program.";
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
        fontConfiguration.of(fontExtension(preferences.fontFamily, preferences.fontSize)),
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
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
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
    refreshDiagnostics() {
      view.dispatch(setDiagnostics(view.state, collectDiagnostics(view)));
    },
    undo: () => undo(view),
    redo: () => redo(view),
    selectAll: () => selectAll(view),
    moveToBeginning: () => cursorDocStart(view),
    moveToEnd: () => cursorDocEnd(view),
    findText(query, fromStart = false, caseSensitive = false, wholeWord = false) {
      if (!query) return false;
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expression = new RegExp(wholeWord ? `\\b${escaped}\\b` : escaped, caseSensitive ? "g" : "gi");
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
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expression = new RegExp(wholeWord ? `\\b${escaped}\\b` : escaped, caseSensitive ? "g" : "gi");
      const source = view.state.doc.toString();
      const matches = [...source.matchAll(expression)];
      const selected = view.state.selection.main;
      const candidates = replaceAll ? matches : matches.filter((match) => match.index! >= selected.from).slice(0, 1);
      if (candidates.length === 0) return 0;
      view.dispatch({ changes: candidates.map((match) => ({ from: match.index!, to: match.index! + match[0].length, insert: replacement })) });
      view.focus();
      return candidates.length;
    },
    getSelectedText: () => view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to),
    replaceSelection(value, selectInserted = true) {
      const selection = view.state.selection.main;
      const source = view.state.doc.toString();
      const prefix = selection.from > 0 && source[selection.from - 1] !== "\n" ? "\n" : "";
      const suffix = selection.to < source.length && source[selection.to] !== "\n" ? "\n" : "";
      const inserted = `${prefix}${value}${suffix}`;
      const from = selection.from + prefix.length;
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: inserted },
        selection: selectInserted ? { anchor: from, head: from + value.length } : { anchor: from + value.length },
      });
      view.focus();
    },
    replaceSelectedText(value) {
      const selection = view.state.selection.main;
      // CodeMirror stores canonical LF line breaks even when the Windows
      // clipboard supplies CRLF. Calculate the new cursor against the same
      // normalized text that the editor will store.
      const normalizedValue = value.replace(/\r\n?/g, "\n");
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: normalizedValue },
        selection: { anchor: selection.from + normalizedValue.length },
      });
      view.focus();
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
