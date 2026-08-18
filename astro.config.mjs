import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/MaxMFonseca/MLE',
        },
      ],
    }),
  ],
});
