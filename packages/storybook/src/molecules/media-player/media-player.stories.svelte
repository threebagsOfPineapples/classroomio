<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { MediaPlayer } from '@cio/ui/custom/media-player';
  import { FIELDS } from './fields';

  const { Story } = defineMeta({
    title: 'Molecules/MediaPlayer',
    component: MediaPlayer,
    parameters: {
      layout: 'centered',
      controls: {
        include: FIELDS
      }
    },
    argTypes: {
      'options.onPlayerReady': { control: false },
      'options.onTimeUpdate': { control: false },
      'options.onFirstPlay': { control: false }
    },
    tags: ['autodocs']
  });
</script>

<!-- Vimeo Public Video Story -->
<Story
  name="VimeoPublic"
  args={{
    source: {
      type: 'vimeo',
      url: 'https://player.vimeo.com/video/76979871',
      metadata: {
        title: 'Vimeo Demo Video'
      }
    },
    options: {
      isLearnerView: false
    }
  }}
>
  {#snippet template(args)}
    <div class="w-full max-w-full md:w-160">
      <MediaPlayer {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="LocalizedControls"
  args={{
    source: {
      type: 'generic',
      url: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-576p.mp4'
    },
    options: {
      controls: true,
      i18n: {
        play: '播放',
        pause: '暂停',
        settings: '设置',
        speed: '速度',
        normal: '正常',
        quality: '画质',
        mute: '静音',
        unmute: '取消静音',
        enterFullscreen: '进入全屏',
        exitFullscreen: '退出全屏',
        volume: '音量',
        seek: '播放进度',
        seekLabel: '{currentTime} / {duration}',
        currentTime: '当前时间',
        duration: '总时长',
        captions: '字幕',
        enableCaptions: '开启字幕',
        disableCaptions: '关闭字幕',
        disabled: '关闭',
        enabled: '开启',
        menuBack: '返回上一级菜单',
        pip: '画中画',
        airplay: '投屏',
        qualityLabel: { 0: '自动' },
        qualityBadge: { 1080: '高清', 720: '高清', 480: '标清' }
      }
    }
  }}
>
  {#snippet template(args)}
    <div class="w-full max-w-full md:w-160">
      <MediaPlayer {...args} />
    </div>
  {/snippet}
</Story>

<!-- Vimeo Unlisted with Hash Story -->
<Story
  name="VimeoUnlisted"
  args={{
    source: {
      type: 'vimeo',
      url: 'https://player.vimeo.com/video/76979871?h=d55f0535a3',
      metadata: {
        title: 'Unlisted Vimeo Video with Privacy Hash'
      }
    },
    options: {
      isLearnerView: false
    }
  }}
>
  {#snippet template(args)}
    <div class="w-full max-w-full md:w-160">
      <MediaPlayer {...args} />
    </div>
  {/snippet}
</Story>

<!-- Vimeo Privacy Restricted Story -->
<Story
  name="VimeoPrivacyRestricted"
  args={{
    source: {
      type: 'vimeo',
      url: 'https://player.vimeo.com/video/76979871',
      metadata: {
        title: 'Vimeo Video with Missing Privacy Hash'
      }
    },
    options: {
      isLearnerView: false,
      vimeoPrivacyErrorTitle: 'Embedding restricted by Vimeo privacy settings',
      vimeoPrivacyErrorDescription:
        'Playback was blocked by Vimeo privacy settings. Possible reasons to check include:',
      vimeoPrivacyErrorUnlistedHint: 'Unlisted video link may be missing its privacy key (hash)',
      vimeoPrivacyErrorDomainPrefix: 'Domain restrictions on Vimeo (ensure',
      vimeoPrivacyErrorDomainSuffix: 'is allowed in video settings)',
      vimeoPrivacyErrorOtherHint: 'Other Vimeo privacy settings',
      vimeoRetryLabel: 'Retry playback'
    }
  }}
>
  {#snippet template(args)}
    <div class="w-full max-w-full md:w-160">
      <MediaPlayer {...args} />
    </div>
  {/snippet}
</Story>

<!-- YouTube Embed Story -->
<Story
  name="YouTube"
  args={{
    source: {
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      metadata: {
        title: 'YouTube Video'
      }
    },
    options: {
      isLearnerView: false
    }
  }}
>
  {#snippet template(args)}
    <div class="w-full max-w-full md:w-160">
      <MediaPlayer {...args} />
    </div>
  {/snippet}
</Story>

<!-- Vimeo Learner View Story -->
<Story
  name="VimeoLearnerView"
  args={{
    source: {
      type: 'vimeo',
      url: 'https://player.vimeo.com/video/76979871',
      metadata: {
        title: 'Vimeo Learner Experience'
      }
    },
    options: {
      isLearnerView: true
    }
  }}
>
  {#snippet template(args)}
    <div class="w-full max-w-full md:w-160">
      <MediaPlayer {...args} />
    </div>
  {/snippet}
</Story>
