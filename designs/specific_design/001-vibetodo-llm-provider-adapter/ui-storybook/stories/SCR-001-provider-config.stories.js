import template from '../components/SCR-001-provider-config.html?raw';

export default {
  title: 'Screens/SCR-001 LLM Provider Configuration',
  parameters: {
    layout: 'fullscreen',
  },
};

// Default: shows the full configuration schema for all providers
export const Default = () => template;
