import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FulcraBranding from './FulcraBranding';

describe('Fulcra branding', () => {
  it('invites visitors to build their own app with the starter skill', () => {
    const html = renderToStaticMarkup(createElement(FulcraBranding));
    expect(html).toContain('Powered by');
    expect(html).toContain('Fulcra');
    expect(html).toContain('Build your own app with Fulcra');
    expect(html).toContain(
      'href="https://github.com/fulcradynamics/community-skills/tree/main/skills/fulcra-app-starter"'
    );
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
