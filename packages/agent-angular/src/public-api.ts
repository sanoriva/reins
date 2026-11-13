export { AgentService } from './agent.service';
export { AgentContent } from './content.directive';
export { type AgentRouteData, provideAgent } from './provide-agent';
export { provideAgentActions } from './provide-agent-actions';
export { type AgentPanelSpec, type AgentPanelsConfig, type AgentPanelView, AgentPanels, provideAgentPanels } from './provide-agent-panels';
export { type AgentFormGroup, type AgentFormSpec, provideAgentForm } from './provide-agent-form';
/** Re-exported so apps can define actions without depending on agent-web directly. */
export { ActionError, defineAction } from '@reins-ai/web';
export type { AgentAction, AgentOptions, ChannelState, ConfirmationState, OpenPanel, SummaryLine } from '@reins-ai/web';
