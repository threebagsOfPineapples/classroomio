import { getContext } from 'svelte';

export const EDITOR_TRANSLATION_CONTEXT = 'cio-editor-translation';
const editorTranslations = new WeakMap<object, (message: string) => string>();

export function setEditorTranslation(editor: object, translate: (message: string) => string) {
  editorTranslations.set(editor, translate);
}

export function getEditorTranslation(editor?: object): (message: string) => string {
  if (editor) return editorTranslations.get(editor) ?? ((message: string) => message);

  return getContext(EDITOR_TRANSLATION_CONTEXT) ?? ((message: string) => message);
}
