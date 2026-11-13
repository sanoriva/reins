/**
 * stdout is the MCP channel, so every log from any library goes to stderr. This module is imported first in cli.ts so
 * it applies before anything else loads.
 */
console.log = console.error;
console.info = console.error;
console.warn = console.error;
console.debug = console.error;
