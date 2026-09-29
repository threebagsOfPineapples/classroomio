<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { preventDefault } from '$lib/utils/functions/svelte';
  import { coursePaymentValidation } from '$lib/utils/functions/validator';
  import { courseApi } from '$features/course/api/course.svelte';

  import * as Dialog from '@cio/ui/base/dialog';
  import { InputField } from '@cio/ui/custom/input-field';
  import { Button } from '@cio/ui/base/button';

  interface Props {
    open?: boolean;
    paymentLink?: string;
    courseId?: string;
  }

  let { open = $bindable(false), paymentLink = '', courseId = '' }: Props = $props();

  let fields = $state({
    fullname: '',
    email: ''
  });

  let errors: Record<string, string> = $state({
    fullname: '',
    email: ''
  });

  const STEPS = {
    STEP_1: 'ENTER_DETAILS',
    STEP_2: 'GO_TO_PAYMENT'
  };

  let step = $state(STEPS.STEP_1);

  function resetForm() {
    step = STEPS.STEP_1;
    fields.fullname = '';
    fields.email = '';
    errors.fullname = '';
    errors.email = '';
  }

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;

    if (!isOpen) {
      resetForm();
    }
  }

  async function onSubmit() {
    errors = coursePaymentValidation(fields);

    if (Object.keys(errors).length) {
      return;
    }

    if (paymentLink && courseId) {
      step = STEPS.STEP_2;

      // Send payment request emails via backend
      await courseApi.createPaymentRequest(courseId, fields.email, fields.fullname);
    } else {
      open = false;
    }
  }

  function onClickPaymentLink() {
    open = false;
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="w-96">
    <Dialog.Header>
      <Dialog.Title>{$t('interface_copy.process_course_payment')}</Dialog.Title>
    </Dialog.Header>
    {#if step === STEPS.STEP_1}
      <form onsubmit={preventDefault(onSubmit)}>
        <InputField
          label={$t('interface_copy.your_fullname')}
          bind:value={fields.fullname}
          autoFocus={true}
          placeholder={$t('interface_copy.john_doe')}
          className="mb-4"
          isRequired={true}
          autoComplete={false}
          errorMessage={errors.fullname}
        />
        <InputField
          label={$t('course.navItem.landing_page.email')}
          bind:value={fields.email}
          placeholder="johndoe@email.com"
          className="mb-4"
          isRequired={true}
          autoComplete={false}
          errorMessage={errors.email}
        />

        <div class="mt-5 flex flex-row-reverse items-center">
          <Button type="submit">
            {paymentLink ? 'Next' : 'Finish'}
          </Button>
        </div>
      </form>
    {:else if step === STEPS.STEP_2}
      <p>
        {$t(
          'interface_copy.you_will_now_be_taken_to_a_payment_page_once_you_ve_paid_send_a_proof_of_payment_to_the_course_admin'
        )}
      </p>
      <div class="mt-5 flex flex-row-reverse items-center">
        <a href={paymentLink} target="_blank" onclick={onClickPaymentLink} class="text-sm font-semibold"
          >{$t('interface_copy.go_to_payment')}</a
        >
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
