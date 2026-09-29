<script>
  import { t } from '$lib/utils/functions/translations';
  import { Label } from '@cio/ui/base/label';
  import { Switch } from '@cio/ui/base/switch';

  import { issueCertificateModal, resetForm } from './store';
  import { preventDefault } from '$lib/utils/functions/svelte';

  import * as Dialog from '@cio/ui/base/dialog';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { InputField } from '@cio/ui/custom/input-field';
  import { Button } from '@cio/ui/base/button';

  let isAutomatic = $state(false);

  const issueCertificate = () => {
    resetForm();
  };
</script>

<Dialog.Root
  bind:open={$issueCertificateModal.open}
  onOpenChange={(isOpen) => {
    if (!isOpen) resetForm();
  }}
>
  <Dialog.Content class="w-3/5">
    <Dialog.Header>
      <Dialog.Title>{$t('interface_copy.send_certificate')}</Dialog.Title>
    </Dialog.Header>
    <main>
      <div>
        <div class="mb-4 flex items-center space-x-2">
          <Switch id="auto-certificate" bind:checked={isAutomatic} />
          <Label for="auto-certificate" class="text-sm font-medium">{$t('interface_copy.automatic')}</Label>
        </div>
        <p class="my-4 text-sm font-medium">
          {$t(
            'interface_copy.if_you_set_this_as_automatic_certificates_will_be_issued_after_the_learner_completes_the_course'
          )}
        </p>
      </div>
      <p class="my-4 text-xs font-normal text-gray-500">
        {$t('interface_copy.or_send_a_personalised_custom_certificate_below')}
      </p>
      <form onsubmit={preventDefault(issueCertificate)}>
        <div class="flex w-full flex-col gap-2 md:flex-row">
          <InputField
            label={$t('interface_copy.email_address_of_the_student')}
            className="w-full my-4"
            labelClassName="text-xs font-normal"
            placeholder={$t('interface_copy.email_comma_seperated')}
            bind:value={$issueCertificateModal.email}
          />
          <InputField
            label={$t('interface_copy.schedule_date')}
            className="w-full my-4"
            labelClassName="text-xs font-normal"
            placeholder="12/06/2023"
            bind:value={$issueCertificateModal.date}
          />
        </div>

        <TextareaField
          label={$t('interface_copy.add_a_personalized_message')}
          labelClassName="text-xs font-normal"
          bind:value={$issueCertificateModal.message}
          rows={2}
          placeholder={$t('interface_copy.your_message_here')}
          className="mb-4"
        />

        <div class="mt-5 flex w-full items-end justify-end">
          <Button type="submit">{$t('interface_copy.issue_certificate')}</Button>
        </div>
      </form>
    </main>
  </Dialog.Content>
</Dialog.Root>
