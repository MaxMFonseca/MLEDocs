import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { buildVersionedSidebar } from './src/data/navigation.ts';
import { versions } from './src/data/versions.ts';
import { getCurrentVersion } from './src/lib/versions/manifest.ts';

getCurrentVersion(versions);

// The scoped Search override adapts Starlight's installed Pagefind UI without making Starlight's
// transitive dependency a new direct project dependency. Resolve the pinned 1.5.2 package from the
// installed Starlight component, then expose only its existing ESM entry and stylesheet to Vite.
const projectRequire = createRequire(import.meta.url);
const starlightRequire = createRequire(
  projectRequire.resolve('@astrojs/starlight/components/Search.astro'),
);
const pagefindUiDirectory = dirname(starlightRequire.resolve('@pagefind/default-ui/package.json'));
const pagefindUiModule = join(pagefindUiDirectory, 'npm_dist/mjs/ui-core.mjs');
const pagefindUiStyles = join(pagefindUiDirectory, 'css/ui.css');

const keyboardScrollableCode = {
  name: 'Keyboard-scrollable code',
  hooks: {
    postprocessRenderedBlock: ({ renderData }) => {
      const pending = [renderData.blockAst];
      while (pending.length > 0) {
        const node = pending.pop();
        if (!node || node.type !== 'element') continue;
        if (node.tagName === 'pre') node.properties.tabindex = 0;
        for (const child of node.children) pending.push(child);
      }
    },
  },
};

export default defineConfig({
  site: 'https://maxmfonseca.github.io',
  base: '/MLEDocs',
  trailingSlash: 'always',
  vite: {
    resolve: {
      alias: [
        { find: '@pagefind/default-ui/css/ui.css', replacement: pagefindUiStyles },
        { find: '@pagefind/default-ui', replacement: pagefindUiModule },
      ],
    },
  },
  integrations: [
    starlight({
      title: 'MLE',
      favicon: '/favicon.png',
      expressiveCode: { plugins: [keyboardScrollableCode] },
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
        Head: './src/components/overrides/Head.astro',
        Header: './src/components/overrides/Header.astro',
        LanguageSelect: './src/components/overrides/LanguageSelect.astro',
        PageTitle: './src/components/overrides/PageTitle.astro',
        Search: './src/components/overrides/Search.astro',
        Sidebar: './src/components/overrides/Sidebar.astro',
        PageSidebar: './src/components/overrides/PageSidebar.astro',
        TwoColumnContent: './src/components/overrides/TwoColumnContent.astro',
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
      sidebar: buildVersionedSidebar(versions),
    }),
  ],
});
