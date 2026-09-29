<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { resolve } from '$app/paths';
</script>

<a href={resolve('/admin', {})} class="enterprise-brand">
  <img src="/enterprise-training-icon.png" alt="" width="40" height="40" />
  <span>
    <strong>{$t('enterprise.interface.platform_name')}</strong>
    <small>{$t('enterprise.interface.admin_portal')}</small>
  </span>
</a>
