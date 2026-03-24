import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Vite plugin that reads the bundled SugarCube format.js, executes it in a
 * sandboxed context to capture the story HTML template, and exposes it as
 * the virtual module "virtual:sugarcube-template".
 *
 * The ~600 KB SugarCube runtime is extracted once at build time and bundled
 * into the app — no CDN, no network fetch at runtime.
 */
function sugarCubeTemplatePlugin(): Plugin {
  const virtualId = 'virtual:sugarcube-template';
  const resolvedId = '\0' + virtualId;

  return {
    name: 'sugarcube-template',
    resolveId(id: string) {
      if (id === virtualId) return resolvedId;
    },
    load(id: string) {
      if (id !== resolvedId) return;

      const formatPath = resolve(__dirname, 'src/assets/sugarcube-format.js');
      const code = readFileSync(formatPath, 'utf8');

      // Intercept the window.storyFormat() call to capture the template string
      let template = '';
      const mockWindow = {
        storyFormat(data: { source?: string }) {
          if (data.source) template = data.source;
        },
      };

      // Execute format.js with our mock window (runs synchronously)
      new Function('window', code)(mockWindow);

      if (!template) {
        throw new Error('sugarcube-template plugin: could not extract template from format.js');
      }

      return `export default ${JSON.stringify(template)};`;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sugarCubeTemplatePlugin()],
})
