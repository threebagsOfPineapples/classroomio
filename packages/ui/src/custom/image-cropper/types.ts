import type { AvatarRootProps, DialogContentProps, WithChildren, WithoutChild, WithoutChildren } from 'bits-ui';
import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements';

import type { CropperProps } from 'svelte-easy-crop';
import type { Snippet } from 'svelte';
import type { ButtonElementProps } from '../../base/button/button.svelte';

export type ImageCropperRootPropsWithoutHTML = WithChildren<{
  id?: string;
  src?: string;
  onCropped?: (url: string) => void;
  onUnsupportedFile?: (file: File) => void;
  onFileSelected?: (file: File) => void;
  maxFileSize?: number; // Maximum file size in bytes
  /** Skip the crop dialog and use the original file immediately. */
  skipCrop?: boolean;
}>;

export type ImageCropperRootProps = ImageCropperRootPropsWithoutHTML & HTMLInputAttributes;

export type ImageCropperDialogProps = DialogContentProps & { closeLabel?: string };

export type ImageCropperActionProps = ButtonElementProps & { label?: string };

export type ImageCropperCropperProps = Omit<Partial<CropperProps>, 'oncropcomplete' | 'image'>;

export type ImageCropperControlsWithoutHTML = WithChildren<{
  ref?: HTMLDivElement | null;
}>;

export type ImageCropperControlsProps = ImageCropperControlsWithoutHTML &
  WithoutChildren<HTMLAttributes<HTMLDivElement>>;

export type ImageCropperPreviewPropsWithoutHTML = {
  child?: Snippet<[{ src: string }]>;
};

export type ImageCropperPreviewProps = ImageCropperPreviewPropsWithoutHTML & WithoutChild<AvatarRootProps>;

export type ImageCropperUploadTriggerPropsWithoutHTML = WithChildren<{
  ref?: HTMLLabelElement | null;
}>;

export type ImageCropperUploadTriggerProps = ImageCropperUploadTriggerPropsWithoutHTML &
  WithoutChildren<HTMLAttributes<HTMLLabelElement>>;
