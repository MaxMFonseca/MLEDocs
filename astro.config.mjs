import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { buildSnapshotSidebar } from './src/data/navigation.ts';
import { versions } from './src/data/versions.ts';

const currentVersion = versions.find((version) => version.status === 'current');
if (!currentVersion) throw new Error('The documentation manifest has no current version.');

export default defineConfig({
  site: 'https://maxmfonseca.github.io',
  base: '/MLEDocs',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'MLE',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        'pt-br': { label: 'Português (Brasil)', lang: 'pt-BR' },
      },
      customCss: [
        './src/styles/tokens.css',
        './src/styles/typography.css',
        './src/styles/global.css',
      ],
      components: {
        Header: './src/components/overrides/Header.astro',
        PageTitle: './src/components/overrides/PageTitle.astro',
        Hero: './src/components/overrides/NotFound.astro',
        FallbackContentNotice: './src/components/status/TranslationNotice.astro',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/MaxMFonseca/MLE',
        },
      ],
      sidebar: buildSnapshotSidebar(currentVersion.id),
    }),
  ],
});
