<script module>
  import { Button } from '@cio/ui';
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import * as ImageCropper from '@cio/ui/custom/image-cropper';
  import { FIELDS } from './fields';

  const { Story } = defineMeta({
    title: 'Molecules/ImageCropper',
    component: ImageCropper.Root,
    parameters: {
      layout: 'centered',
      controls: {
        include: FIELDS
      }
    },
    argTypes: {
      src: {
        control: 'text',
        description: 'The source URL of the current image',
        table: { defaultValue: { summary: '""' } }
      },
      onCropped: {
        control: false,
        description: 'Callback function called when image is cropped',
        table: {
          type: { summary: '(url: string) => void' },
          defaultValue: { summary: 'undefined' }
        }
      },
      onUnsupportedFile: {
        control: false,
        description: 'Callback function called when unsupported file is uploaded',
        table: {
          type: { summary: '(file: File) => void' },
          defaultValue: { summary: 'undefined' }
        }
      }
    },
    tags: ['autodocs']
  });
</script>

<Story name="Default">
  {#snippet template(args)}
    <div class="flex flex-col items-center gap-4">
      <ImageCropper.Root
        {...args}
        accept="image/*"
        src="https://github.com/shadcn.png"
        onUnsupportedFile={(file) => {
          console.error(`Unsupported file type: ${file.type}`);
        }}
      >
        <ImageCropper.UploadTrigger>
          <ImageCropper.Preview />
        </ImageCropper.UploadTrigger>
        <ImageCropper.Dialog>
          <ImageCropper.Cropper />
          <ImageCropper.Controls>
            <ImageCropper.Cancel />
            <ImageCropper.Crop />
          </ImageCropper.Controls>
        </ImageCropper.Dialog>
      </ImageCropper.Root>
    </div>
  {/snippet}
</Story>

<Story name="Square Preview">
  {#snippet template(args)}
    <div class="flex flex-col items-center gap-4">
      <ImageCropper.Root
        {...args}
        accept="image/*"
        src="https://github.com/shadcn.png"
        onUnsupportedFile={(file) => {
          console.error(`Unsupported file type: ${file.type}`);
        }}
      >
        <ImageCropper.UploadTrigger>
          <ImageCropper.Preview class="rounded-md" />
        </ImageCropper.UploadTrigger>
        <ImageCropper.Dialog>
          <ImageCropper.Cropper cropShape="rect" />
          <ImageCropper.Controls>
            <ImageCropper.Cancel />
            <ImageCropper.Crop />
          </ImageCropper.Controls>
        </ImageCropper.Dialog>
      </ImageCropper.Root>
    </div>
  {/snippet}
</Story>

<Story name="Localized Controls">
  {#snippet template(args)}
    <ImageCropper.Root {...args} accept="image/*" src="https://github.com/shadcn.png">
      <ImageCropper.UploadTrigger>
        <ImageCropper.Preview />
      </ImageCropper.UploadTrigger>
      <ImageCropper.Dialog closeLabel="关闭">
        <ImageCropper.Cropper />
        <ImageCropper.Controls>
          <ImageCropper.Cancel label="取消" />
          <ImageCropper.Crop label="裁剪" />
        </ImageCropper.Controls>
      </ImageCropper.Dialog>
    </ImageCropper.Root>
  {/snippet}
</Story>

<Story name="No Default Image">
  {#snippet template(args)}
    <div class="flex flex-col items-center gap-4">
      <ImageCropper.Root
        {...args}
        accept="image/*"
        onCropped={(url) => {
          console.log('Cropped image URL:', url);
        }}
        onUnsupportedFile={(file) => {
          console.error('Unsupported file:', file.name);
        }}
      >
        <ImageCropper.UploadTrigger>
          <ImageCropper.Preview />
        </ImageCropper.UploadTrigger>
        <ImageCropper.Dialog>
          <ImageCropper.Cropper />
          <ImageCropper.Controls>
            <ImageCropper.Cancel />
            <ImageCropper.Crop />
          </ImageCropper.Controls>
        </ImageCropper.Dialog>
      </ImageCropper.Root>
    </div>
  {/snippet}
</Story>

<Story name="Custom Preview">
  {#snippet template(args)}
    <div class="flex flex-col items-center gap-4">
      <ImageCropper.Root
        src="https://github.com/shadcn.png"
        onUnsupportedFile={(file) => {
          toast.error(`Unsupported file type: ${file.type}`);
        }}
      >
        <ImageCropper.UploadTrigger>
          <ImageCropper.Preview>
            {#snippet child({ src })}
              <img {src} alt="your avatar" class="size-32 border-2 border-blue-500" />
            {/snippet}
          </ImageCropper.Preview>
        </ImageCropper.UploadTrigger>
        <ImageCropper.Dialog>
          <ImageCropper.Cropper cropShape="rect" />
          <ImageCropper.Controls>
            <ImageCropper.Cancel />
            <ImageCropper.Crop />
          </ImageCropper.Controls>
        </ImageCropper.Dialog>
      </ImageCropper.Root>
    </div>
  {/snippet}
</Story>
