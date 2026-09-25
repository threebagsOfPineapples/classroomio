<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { ROUTE } from '$lib/utils/constants/routes';
  import { t } from '$lib/utils/functions/translations';
  import { AuthUI } from '$features/ui';
  import { EmailSentIcon } from '$features/ui/icons';
  import { forgotApi } from '$features/auth/api/forgot.svelte';
  import type { TForgotPasswordForm } from '$features/auth/utils/types';
  import * as Field from '@cio/ui/base/field';
  import { Input } from '@cio/ui/base/input';
  import { Button } from '@cio/ui/base/button';
  import * as Card from '@cio/ui/base/card';

  let fields: TForgotPasswordForm = $state({ email: '' });
</script>

<svelte:head>
  <title>{$t('login.forgot')} · {$t('enterprise.company_name')}</title>
</svelte:head>

<AuthUI handleSubmit={() => forgotApi.submit(fields)} showOnlyContent={true} showLogo={!forgotApi.success}>
  {#if forgotApi.success}
    <div class="flex flex-col items-center justify-center gap-4">
      <EmailSentIcon />
      <Card.Title class="text-xl">{$t('login.forgot_password.email_sent')}</Card.Title>
      <p class="ui:text-muted-foreground text-center text-sm">
        {$t('login.forgot_password.sent_description', { email: fields.email })}
      </p>
    </div>

    <div class="mt-6 flex w-full items-center justify-end">
      <Button type="button" class="w-full" onclick={() => goto(resolve(ROUTE.LOGIN, {}))}>{$t('login.login')}</Button>
    </div>
  {:else}
    <div class="flex flex-col gap-6">
      <div>
        <Card.Title class="text-xl">{$t('login.forgot')}</Card.Title>
        <Card.Description class="mt-2">{$t('login.forgot_password.description')}</Card.Description>
      </div>
      <Field.Field>
        <Field.Label for="email">{$t('login.fields.email')}</Field.Label>
        <Field.Content>
          <Input
            id="email"
            type="email"
            bind:value={fields.email}
            placeholder="you@domain.com"
            disabled={forgotApi.isLoading}
            autofocus
            aria-invalid={forgotApi.errors.email ? 'true' : undefined}
          />
          {#if forgotApi.errors.email}
            <Field.Error>{forgotApi.errors.email}</Field.Error>
          {/if}
        </Field.Content>
      </Field.Field>

      <div class="flex w-full flex-col gap-2">
        <Button type="submit" disabled={forgotApi.isLoading} loading={forgotApi.isLoading} class="w-full">
          {$t('login.forgot_password.send_link')}
        </Button>
        <Button type="button" variant="ghost" class="w-full" onclick={() => goto(resolve(ROUTE.LOGIN, {}))}
          >{$t('onboarding.back')}</Button
        >
      </div>
    </div>
  {/if}
</AuthUI>
