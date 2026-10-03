import { t } from '$lib/utils/functions/translations';

const editorLabelKeys: Record<string, string> = {
  Close: 'settings.landing_page.editor.close',
  Cancel: 'settings.profile.personal_information.cancel',
  Crop: 'settings.profile.profile_picture.crop'
};

export function translateEditorMessage(message: string) {
  if (!message) return '';

  const key = message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const keyPath = editorLabelKeys[message] ?? `editor_copy.${key}`;

  return t.get(keyPath);
}
