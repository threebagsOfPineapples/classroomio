<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { Search } from '@cio/ui/custom/search';
  import { FIELDS } from './fields';

  const { Story } = defineMeta({
    title: 'Molecules/Search',
    component: Search,
    parameters: {
      layout: 'centered',
      controls: {
        include: FIELDS
      }
    },
    argTypes: {
      onValueChange: { control: false }
    },
    tags: ['autodocs']
  });
</script>

<Story name="Empty" args={{ placeholder: 'Search courses' }} />
<Story name="Filled" args={{ placeholder: 'Search courses', value: 'Onboarding' }} />
<Story name="Explicit accessible label" args={{ 'aria-label': 'Search courses' }} />
<Story name="Placeholder accessible label" args={{ placeholder: 'Search employees' }} />
<Story
  name="Chinese labels"
  args={{
    placeholder: '搜索课程',
    'aria-label': '搜索课程',
    clearLabel: '清除搜索',
    value: '入职培训'
  }}
/>
