import { acceptCompletion, autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import type { FieldDefinition } from "../contracts/core.js";

export interface ClassicProgramEditor {
  getValue(): string;
  setValue(value: string): void;
  focus(): void;
  destroy(): void;
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
): ClassicProgramEditor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initialValue,
      extensions: [
        minimalSetup,
        epiInfoLanguage,
        syntaxHighlighting(defaultHighlightStyle),
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
      ],
    }),
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue(value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
